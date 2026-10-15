import json
import math
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from backend.functions.planner.lambda_function import (
    SUPPORTED_CITIES,
    haversine_km,
    location_supported,
)

# Verified Indore landmarks within the 12 km pilot radius
INDORE_LANDMARKS: Dict[str, Dict[str, Any]] = {
    "rajwada": {"name": "Rajwada Palace, Indore", "lat": 22.7186, "lon": 75.8557},
    "sarafa": {"name": "Sarafa Bazaar, Indore", "lat": 22.7177, "lon": 75.8543},
    "chhappan": {"name": "56 Dukan (Chhappan Dukan), Indore", "lat": 22.7244, "lon": 75.8839},
    "56 dukan": {"name": "56 Dukan (Chhappan Dukan), Indore", "lat": 22.7244, "lon": 75.8839},
    "treasure island": {"name": "Treasure Island Mall, MG Road", "lat": 22.7218, "lon": 75.8788},
    "palasia": {"name": "Old Palasia Square, Indore", "lat": 22.7256, "lon": 75.8856},
    "regal square": {"name": "Regal Square, Indore", "lat": 22.7198, "lon": 75.8698},
    "lal bagh": {"name": "Lal Bagh Palace, Indore", "lat": 22.7009, "lon": 75.8471},
    "khajrana": {"name": "Khajrana Ganesh Mandir, Indore", "lat": 22.7352, "lon": 75.9062},
    "vijay nagar": {"name": "Vijay Nagar Square, Indore", "lat": 22.7533, "lon": 75.8937},
    "bhawarkuan": {"name": "Bhawarkuan Square, Indore", "lat": 22.6922, "lon": 75.8676},
    "railway station": {"name": "Indore Junction Railway Station", "lat": 22.7172, "lon": 75.8683},
    "holkar stadium": {"name": "Holkar Cricket Stadium, Indore", "lat": 22.7243, "lon": 75.8796},
}

MAPPY_TOOL_DECLARATIONS: List[Dict[str, Any]] = [
    {
        "name": "get_current_location",
        "description": "Obtain the user's current permitted GPS coordinates.",
        "parameters": {"type": "OBJECT", "properties": {}},
    },
    {
        "name": "resolve_destination",
        "description": "Resolve a destination name or landmark into geographical coordinates within the supported city.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "query": {"type": "STRING"},
                "city": {"type": "STRING"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "validate_location",
        "description": "Validate that origin and destination coordinates lie inside the city's supported service radius.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "city": {"type": "STRING"},
            },
        },
    },
    {
        "name": "plan_routes",
        "description": "Call the existing Heat-Safe planner for the origin and resolved destination.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "destination_query": {"type": "STRING"},
                "city": {"type": "STRING"},
            },
        },
    },
    {
        "name": "get_route_options",
        "description": "Retrieve the HEAT-SAFE, OPTIMAL, and SHORTEST route options for the session.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"session_id": {"type": "STRING"}},
        },
    },
    {
        "name": "select_route",
        "description": "Select a route by route_id or preference ('heat-safe', 'optimal', 'shortest').",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "session_id": {"type": "STRING"},
                "route_id": {"type": "STRING"},
                "preference": {"type": "STRING"},
            },
        },
    },
    {
        "name": "start_navigation",
        "description": "Start a live walking navigation session along the selected route.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"session_id": {"type": "STRING"}},
        },
    },
    {
        "name": "get_navigation_status",
        "description": "Get current route progress, detected route, and distance from route.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"session_id": {"type": "STRING"}},
        },
    },
    {
        "name": "request_reroute",
        "description": "Recalculate walking alternatives from the current confirmed GPS location to the destination.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"session_id": {"type": "STRING"}},
        },
    },
    {
        "name": "stop_navigation",
        "description": "End the active navigation session and stop GPS tracking.",
        "parameters": {
            "type": "OBJECT",
            "properties": {"session_id": {"type": "STRING"}},
        },
    },
]


def resolve_destination(query: str, city_id: str = "indore") -> Optional[Dict[str, Any]]:
    if not query or not isinstance(query, str):
        return None

    clean_q = query.strip().lower()
    city = SUPPORTED_CITIES.get(city_id.lower())
    if not city:
        return None

    for key, info in INDORE_LANDMARKS.items():
        if key in clean_q or clean_q in key:
            return {
                "name": info["name"],
                "latitude": info["lat"],
                "longitude": info["lon"],
                "source": "curated_landmark",
            }

    search_q = f"{query.strip()}, {city['name']}, India"
    params = urllib.parse.urlencode({"q": search_q, "format": "json", "limit": 1})
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "HeatSafeRouter-Mappy/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            results = json.loads(resp.read().decode("utf-8"))
            if results:
                return {
                    "name": results[0].get("display_name", query.strip()).split(",")[0],
                    "latitude": round(float(results[0]["lat"]), 5),
                    "longitude": round(float(results[0]["lon"]), 5),
                    "source": "nominatim_osm",
                }
    except Exception as exc:
        print("Nominatim lookup error:", str(exc))

    return None


def validate_location_pair(
    origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float, city_id: str = "indore"
) -> Tuple[bool, Optional[str], Optional[str]]:
    city = SUPPORTED_CITIES.get(city_id.lower())
    if not city:
        return False, "UNSUPPORTED_CITY", f"City '{city_id}' is not supported."
    if not all(math.isfinite(v) for v in (origin_lat, origin_lon, dest_lat, dest_lon)):
        return False, "INVALID_COORDINATES", "Coordinates must be finite numbers."
    if not location_supported(origin_lat, origin_lon, city):
        return False, "UNSUPPORTED_LOCATION", f"Origin is outside the supported {city['name']} area."
    if not location_supported(dest_lat, dest_lon, city):
        return False, "UNSUPPORTED_LOCATION", f"Destination is outside the supported {city['name']} area."
    if haversine_km([origin_lon, origin_lat], [destination_lon := dest_lon, destination_lat := dest_lat]) < 0.01:
        return False, "POINTS_TOO_CLOSE", "Origin and destination must be at least 10 metres apart."
    return True, None, None


def build_mappy_recommendations(
    routes: List[Dict[str, Any]], planner_recs: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Maps backend routes to Mappy's three required modes:
    - HEAT-SAFE: Lowest heat-safe ranking score from existing backend.
    - OPTIMAL: Existing balanced recommendation.
    - SHORTEST: Minimum distance_km among the alternatives actually returned by HeiGIT.
    """
    if not routes:
        return {}

    shortest_route = min(routes, key=lambda r: float(r.get("distance_km", 999999.0)))
    heat_safe_id = planner_recs.get("heat-safe", {}).get("route_id", routes[0]["route_id"])
    optimal_id = planner_recs.get("balanced", {}).get("route_id", routes[0]["route_id"])

    return {
        "heat_safe": {
            "route_id": heat_safe_id,
            "label": "HEAT-SAFE",
            "reason": "Lowest estimated heat exposure among returned alternatives.",
        },
        "optimal": {
            "route_id": optimal_id,
            "label": "OPTIMAL",
            "reason": "Balanced trade-off between walking time, distance, and estimated heat.",
        },
        "shortest": {
            "route_id": shortest_route["route_id"],
            "label": "SHORTEST",
            "reason": "Shortest distance among the walking alternatives returned by HeiGIT.",
        },
    }


def _point_to_segment_distance_m(
    lat: float, lon: float, seg_start: List[float], seg_end: List[float]
) -> Tuple[float, float]:
    lon1, lat1 = float(seg_start[0]), float(seg_start[1])
    lon2, lat2 = float(seg_end[0]), float(seg_end[1])

    cos_lat = math.cos(math.radians((lat1 + lat2 + lat) / 3.0))
    m_per_deg_lat = 111132.0
    m_per_deg_lon = 111320.0 * cos_lat

    px = (lon - lon1) * m_per_deg_lon
    py = (lat - lat1) * m_per_deg_lat
    dx = (lon2 - lon1) * m_per_deg_lon
    dy = (lat2 - lat1) * m_per_deg_lat

    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq <= 1e-9:
        return math.hypot(px, py), 0.0

    t = max(0.0, min(1.0, (px * dx + py * dy) / seg_len_sq))
    return math.hypot(px - t * dx, py - t * dy), t


def match_gps_to_routes(
    latitude: float,
    longitude: float,
    accuracy_m: float,
    routes: List[Dict[str, Any]],
    selected_route_id: str,
    consecutive_off_route_count: int = 0,
) -> Dict[str, Any]:
    """
    Deterministic geospatial route-matching, progress, deviation, and arrival engine.
    """
    route_metrics: Dict[str, Dict[str, float]] = {}

    for route in routes:
        r_id = route["route_id"]
        coords = route.get("geometry", {}).get("coordinates") or []
        if len(coords) < 2:
            continue

        min_dist_m = float("inf")
        best_covered_km = 0.0
        cumulative_km = 0.0

        for i in range(len(coords) - 1):
            seg_km = haversine_km(coords[i], coords[i + 1])
            dist_m, frac = _point_to_segment_distance_m(
                latitude, longitude, coords[i], coords[i + 1]
            )
            if dist_m < min_dist_m:
                min_dist_m = dist_m
                best_covered_km = cumulative_km + seg_km * frac
            cumulative_km += seg_km

        total_km = max(0.001, cumulative_km)
        progress_pct = round(max(0.0, min(100.0, (best_covered_km / total_km) * 100.0)), 1)
        dest_pt = coords[-1]
        dist_to_dest_m = haversine_km([longitude, latitude], dest_pt) * 1000.0

        route_metrics[r_id] = {
            "distance_from_route_m": round(min_dist_m, 1),
            "progress_percent": progress_pct,
            "distance_to_destination_m": round(dist_to_dest_m, 1),
        }

    if not route_metrics:
        return {"status": "unknown", "distance_from_route_m": 0.0, "progress_percent": 0.0}

    detected_route_id = min(
        route_metrics.keys(), key=lambda k: route_metrics[k]["distance_from_route_m"]
    )
    selected_info = route_metrics.get(selected_route_id) or route_metrics[detected_route_id]

    dist_from_selected_m = selected_info["distance_from_route_m"]
    dist_to_dest_m = selected_info["distance_to_destination_m"]
    progress_pct = selected_info["progress_percent"]

    effective_threshold_m = max(35.0, min(80.0, 25.0 + float(accuracy_m or 10.0) * 1.2))
    arrival_threshold_m = max(22.0, min(45.0, 18.0 + float(accuracy_m or 10.0) * 0.8))

    if dist_to_dest_m <= arrival_threshold_m and float(accuracy_m or 10.0) <= 50.0:
        status = "arrived"
        new_off_count = 0
    elif dist_from_selected_m > effective_threshold_m:
        new_off_count = consecutive_off_route_count + 1
        status = "deviated" if new_off_count >= 2 else "gps_drift_warning"
    else:
        status = "on_route"
        new_off_count = 0

    return {
        "selected_route_id": selected_route_id,
        "detected_route_id": detected_route_id,
        "distance_from_route_m": dist_from_selected_m,
        "distance_to_destination_m": dist_to_dest_m,
        "progress_percent": 100.0 if status == "arrived" else progress_pct,
        "status": status,
        "consecutive_off_route_count": new_off_count,
    }