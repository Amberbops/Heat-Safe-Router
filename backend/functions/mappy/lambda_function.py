import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

from backend.functions.planner.lambda_function import (
    SUPPORTED_CITIES,
    api_error,
    api_response,
    calculate_route_heat,
    get_routes,
    get_weather,
    rank_routes,
)
from .providers.deterministic_provider import DeterministicProvider
from .providers.gemini_provider import GeminiProvider
from .tools import (
    MAPPY_TOOL_DECLARATIONS,
    build_mappy_recommendations,
    match_gps_to_routes,
    resolve_destination,
    validate_location_pair,
)


def get_ai_provider():
    provider_name = os.environ.get("MAPPY_AI_PROVIDER", "gemini").strip().lower()
    if provider_name == "gemini":
        return GeminiProvider()
    return DeterministicProvider()


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    http_method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or ""
    ).upper()

    if http_method == "OPTIONS":
        return api_response(204, {})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return api_error(400, "INVALID_JSON", "Request body must contain valid JSON.")

    action = body.get("action", "chat")
    session_id = body.get("session_id") or f"mappy-{uuid.uuid4()}"

    # 1. Live GPS Location Evaluation
    if action == "gps_update":
        gps = body.get("location") or {}
        routes = body.get("routes") or []
        selected_route_id = body.get("selected_route_id") or (
            routes[0]["route_id"] if routes else "route-1"
        )
        off_count = int(body.get("consecutive_off_route_count", 0))

        try:
            lat = float(gps["latitude"])
            lon = float(gps["longitude"])
            acc = float(gps.get("accuracy_m", 10.0))
        except (KeyError, TypeError, ValueError):
            return api_error(400, "INVALID_GPS", "Valid latitude and longitude are required.")

        nav_state = match_gps_to_routes(
            latitude=lat,
            longitude=lon,
            accuracy_m=acc,
            routes=routes,
            selected_route_id=selected_route_id,
            consecutive_off_route_count=off_count,
        )
        nav_state["session_id"] = session_id

        spoken_prompt = None
        if nav_state["status"] == "arrived":
            spoken_prompt = "Destination reached. Navigation complete."
        elif nav_state["status"] == "deviated":
            spoken_prompt = (
                "You appear to have moved away from the selected route. "
                "Would you like me to find another way?"
            )

        return api_response(
            200,
            {
                "status": "ok",
                "session_id": session_id,
                "navigation": nav_state,
                "assistant_message": spoken_prompt,
            },
        )

    # 2. Conversational Agent Turn
    messages = body.get("messages") or []
    city_id = str(body.get("city", "indore")).strip().lower()
    current_location = body.get("current_location")

    provider = get_ai_provider()
    decision = provider.generate_agent_response(
        messages=messages,
        available_tools=MAPPY_TOOL_DECLARATIONS,
        context={
            "city": city_id,
            "current_location": current_location,
            "session_id": session_id,
        },
    )

    tool_calls = decision.get("tool_calls") or []
    reply = decision.get("reply", "")
    plan_payload = None
    mappy_recs = None
    resolved_dest = None

    dest_query = None
    for call in tool_calls:
        t_name = call.get("name")
        t_args = call.get("arguments") or {}
        if t_name in ("resolve_destination", "plan_routes"):
            dest_query = t_args.get("query") or t_args.get("destination_query") or dest_query

    if dest_query:
        if not current_location or "latitude" not in current_location or "longitude" not in current_location:
            return api_response(
                200,
                {
                    "status": "needs_location_permission",
                    "session_id": session_id,
                    "provider": decision.get("provider"),
                    "reply": "Please allow GPS location access so I can find a route from your current position.",
                },
            )

        resolved_dest = resolve_destination(dest_query, city_id)
        if not resolved_dest:
            return api_response(
                200,
                {
                    "status": "destination_not_found",
                    "session_id": session_id,
                    "provider": decision.get("provider"),
                    "reply": f"I couldn't resolve '{dest_query}' in Indore. Try Rajwada, Sarafa, 56 Dukan, or Palasia.",
                },
            )

        origin_lat = float(current_location["latitude"])
        origin_lon = float(current_location["longitude"])
        dest_lat = float(resolved_dest["latitude"])
        dest_lon = float(resolved_dest["longitude"])

        valid, err_code, err_msg = validate_location_pair(
            origin_lat, origin_lon, dest_lat, dest_lon, city_id
        )
        if not valid:
            return api_error(422, err_code or "UNSUPPORTED_LOCATION", err_msg or "Unsupported location.")

        weather = get_weather(origin_lat, origin_lon)
        features = get_routes(origin_lat, origin_lon, dest_lat, dest_lon)
        if not features:
            return api_error(422, "NO_WALKING_ROUTE", "No walkable route was found between these locations.")

        routes = []
        for idx, feat in enumerate(features):
            summary = feat.get("properties", {}).get("summary", {})
            routes.append(
                {
                    "route_id": f"route-{idx + 1}",
                    "distance_km": round(summary.get("distance", 0) / 1000.0, 2),
                    "duration_min": round(summary.get("duration", 0) / 60.0, 1),
                    "geometry": feat.get("geometry"),
                    "heat": calculate_route_heat(feat, weather),
                }
            )

        planner_recs = rank_routes(routes)
        mappy_recs = build_mappy_recommendations(routes, planner_recs)
        hs_id = mappy_recs["heat_safe"]["route_id"]
        hs_route = next((r for r in routes if r["route_id"] == hs_id), routes[0])

        city = SUPPORTED_CITIES[city_id]
        plan_payload = {
            "status": "ok",
            "request_id": f"req-{uuid.uuid4()}",
            "city": {"id": city_id, "name": city["name"]},
            "origin": {"latitude": origin_lat, "longitude": origin_lon},
            "destination": {
                "latitude": dest_lat,
                "longitude": dest_lon,
                "name": resolved_dest["name"],
            },
            "weather": weather,
            "route_count": len(routes),
            "routes": routes,
            "recommendations": planner_recs,
            "mappy_recommendations": mappy_recs,
            "recommended_route": hs_id,
        }

        alt_phrase = (
            "1 walking route" if len(routes) == 1 else f"{len(routes)} walking alternatives"
        )
        reply = (
            f"I found {alt_phrase} to {resolved_dest['name']}. "
            f"The heat-safe route ({hs_id}) is {hs_route['distance_km']} km "
            f"({hs_route['duration_min']} min) with the lowest estimated exposure "
            f"({hs_route['heat']['heat_score']}/100). Would you like to start navigation?"
        )

    return api_response(
        200,
        {
            "status": "ok",
            "session_id": session_id,
            "provider": decision.get("provider"),
            "reply": reply,
            "tool_calls": tool_calls,
            "destination": resolved_dest,
            "plan": plan_payload,
            "mappy_recommendations": mappy_recs,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )