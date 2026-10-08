import json
import os
import urllib.request


HEIGIT_API_KEY = os.environ.get("HEIGIT_API_KEY")

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS"
}


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body)
    }


def lambda_handler(event, context):

    # Get query parameters
    query_params = event.get("queryStringParameters") or {}

    origin_lat = query_params.get("originLat")
    origin_lon = query_params.get("originLon")
    dest_lat = query_params.get("destLat")
    dest_lon = query_params.get("destLon")

    # Validate coordinates
    if not all([origin_lat, origin_lon, dest_lat, dest_lon]):
        return response(400, {
            "error": "Missing coordinates",
            "required": [
                "originLat",
                "originLon",
                "destLat",
                "destLon"
            ],
            "example": (
                "/routes?"
                "originLat=22.7196&"
                "originLon=75.8577&"
                "destLat=22.7256&"
                "destLon=75.8656"
            )
        })

    # Check API key
    if not HEIGIT_API_KEY:
        return response(500, {
            "error": "HEIGIT_API_KEY environment variable is not configured"
        })

    try:

        # openrouteservice uses [longitude, latitude]
        coordinates = [
            [float(origin_lon), float(origin_lat)],
            [float(dest_lon), float(dest_lat)]
        ]

        request_body = {
            "coordinates": coordinates
        }

        url = (
            "https://api.heigit.org/"
            "openrouteservice/v2/directions/"
            "foot-walking"
        )

        request = urllib.request.Request(
            url,
            data=json.dumps(request_body).encode("utf-8"),
            headers={
                "Authorization": HEIGIT_API_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            method="POST"
        )

        with urllib.request.urlopen(request, timeout=15) as api_response:
            route_data = json.loads(
                api_response.read().decode("utf-8")
            )

        # Extract first route
        route = route_data["routes"][0]

        summary = route["summary"]

        distance_m = summary["distance"]
        duration_s = summary["duration"]

        result = {
            "status": "ok",
            "profile": "foot-walking",
            "distance_km": round(distance_m / 1000, 2),
            "duration_min": round(duration_s / 60, 1),
            "geometry": route.get("geometry")
        }

        return response(200, result)

    except urllib.error.HTTPError as e:

        error_body = e.read().decode("utf-8", errors="replace")

        return response(e.code, {
            "error": "HeiGIT routing API error",
            "status_code": e.code,
            "details": error_body
        })

    except Exception as e:

        return response(500, {
            "error": "Failed to calculate route",
            "details": str(e)
        })
