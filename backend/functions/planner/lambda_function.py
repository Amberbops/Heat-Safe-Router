import json
import os
import urllib.parse
import urllib.request
import math
import uuid
from decimal import Decimal
from datetime import datetime, timezone

import boto3


# ============================================================
# Configuration
# ============================================================

HEIGIT_API_KEY = os.environ["HEIGIT_API_KEY"]

DYNAMODB_TABLE_NAME = os.environ.get(
    "DYNAMODB_TABLE_NAME",
    "HeatSafe_RoutePlans"
)

dynamodb = boto3.resource("dynamodb")
route_plans_table = dynamodb.Table(DYNAMODB_TABLE_NAME)

WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

ROUTING_URL = (
    "https://api.heigit.org/openrouteservice/v2/"
    "directions/foot-walking/geojson"
)


# ============================================================
# HTTP Response Helpers
# ============================================================

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}


def api_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body),
    }


# ============================================================
# Utility
# ============================================================

def clamp(value, minimum=0.0, maximum=100.0):
    return max(minimum, min(maximum, value))


def haversine_km(point_a, point_b):
    """
    point = [longitude, latitude]
    """

    lon1, lat1 = point_a[:2]
    lon2, lat2 = point_b[:2]

    r = 6371.0

    lat1 = math.radians(lat1)
    lat2 = math.radians(lat2)

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(dlon / 2) ** 2
    )

    return r * 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )


def get_json(url, headers=None):

    request = urllib.request.Request(
        url,
        headers=headers or {}
    )

    with urllib.request.urlopen(
        request,
        timeout=15
    ) as response:

        return json.loads(
            response.read().decode("utf-8")
        )


def post_json(url, payload, headers=None):

    body = json.dumps(payload).encode("utf-8")

    request_headers = {
        "Content-Type": "application/json",
        "Accept": "application/geo+json, application/json",
    }

    if headers:
        request_headers.update(headers)

    request = urllib.request.Request(
        url,
        data=body,
        headers=request_headers,
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=20
    ) as response:

        return json.loads(
            response.read().decode("utf-8")
        )


# ============================================================
# DynamoDB Helpers
# ============================================================

def convert_to_dynamodb(value):
    """
    Convert Python values into DynamoDB-compatible values.

    boto3 DynamoDB does not accept Python float values directly,
    so floats are converted to Decimal using their string form.
    """

    if isinstance(value, float):

        return Decimal(
            str(value)
        )

    if isinstance(value, int):

        return value

    if isinstance(value, bool):

        return value

    if isinstance(value, dict):

        return {
            key: convert_to_dynamodb(val)
            for key, val in value.items()
        }

    if isinstance(value, list):

        return [
            convert_to_dynamodb(item)
            for item in value
        ]

    return value


def persist_route_plan(
    request_id,
    created_at,
    origin_lat,
    origin_lon,
    destination_lat,
    destination_lon,
    weather,
    routes,
    recommendations,
    recommended_route,
    model
):
    """
    Persist a compact analytical summary of the route plan.

    Geometry and full segment arrays are intentionally NOT stored
    in DynamoDB because they can become large. The API response
    still returns full geometry for frontend visualization.
    """

    stored_routes = []

    for route in routes:

        heat = route.get(
            "heat",
            {}
        )

        normalized = route.get(
            "normalized",
            {}
        )

        mode_scores = route.get(
            "mode_scores",
            {}
        )

        stored_routes.append({

            "route_id": route.get(
                "route_id"
            ),

            "distance_km": route.get(
                "distance_km"
            ),

            "duration_min": route.get(
                "duration_min"
            ),

            "heat_score": heat.get(
                "heat_score"
            ),

            "heat_category": heat.get(
                "category"
            ),

            "weather_heat": heat.get(
                "weather_heat"
            ),

            "environmental_exposure": heat.get(
                "environmental_exposure"
            ),

            "segment_count": len(
                heat.get(
                    "segments",
                    []
                )
            ),

            "components": heat.get(
                "components",
                {}
            ),

            "normalized": normalized,

            "mode_scores": mode_scores,
        })

    item = {

        "request_id": request_id,

        "created_at": created_at,

        "origin": {
            "latitude": origin_lat,
            "longitude": origin_lon,
        },

        "destination": {
            "latitude": destination_lat,
            "longitude": destination_lon,
        },

        "weather": weather,

        "route_count": len(routes),

        "routes": stored_routes,

        "recommendations": recommendations,

        "recommended_route": recommended_route,

        "model": model,
    }

    dynamodb_item = convert_to_dynamodb(
        item
    )

    route_plans_table.put_item(
        Item=dynamodb_item
    )


# ============================================================
# Weather
# ============================================================

def get_weather(latitude, longitude):

    params = urllib.parse.urlencode({

        "latitude": latitude,

        "longitude": longitude,

        "current":
            "temperature_2m,"
            "relative_humidity_2m,"
            "wind_speed_10m",

        "timezone": "auto",
    })

    data = get_json(
        f"{WEATHER_URL}?{params}"
    )

    current = data["current"]

    return {

        "temperature_c":
            current["temperature_2m"],

        "humidity_percent":
            current["relative_humidity_2m"],

        "wind_speed_kmh":
            current["wind_speed_10m"],

        "timezone":
            data.get("timezone"),
    }


# ============================================================
# Heat Model
# ============================================================

def temperature_score(temp):

    return clamp(
        ((temp - 25.0) / 15.0) * 100.0
    )


def humidity_score(humidity):

    return clamp(
        ((humidity - 30.0) / 50.0) * 100.0
    )


def wind_score(wind):

    return clamp(
        ((20.0 - wind) / 20.0) * 100.0
    )


def duration_score(duration):

    return clamp(
        ((duration - 10.0) / 30.0) * 100.0
    )


def calculate_weather_heat(
    temperature,
    humidity,
    wind,
    duration
):

    components = {

        "temperature": round(
            temperature_score(temperature),
            1
        ),

        "humidity": round(
            humidity_score(humidity),
            1
        ),

        "wind": round(
            wind_score(wind),
            1
        ),

        "duration": round(
            duration_score(duration),
            1
        ),
    }

    weights = {

        "temperature": 0.50,

        "humidity": 0.15,

        "wind": 0.10,

        "duration": 0.25,
    }

    score = (

        components["temperature"]
        * weights["temperature"]

        + components["humidity"]
        * weights["humidity"]

        + components["wind"]
        * weights["wind"]

        + components["duration"]
        * weights["duration"]
    )

    return (
        round(
            clamp(score),
            1
        ),
        components,
        weights
    )


# ============================================================
# Environmental Proxy Model
# ============================================================

# Higher value = potentially greater heat exposure.
#
# These are NOT actual measured shade values.
# They are environmental proxies derived from OSM route metadata.

SURFACE_EXPOSURE = {

    0: 50,   # Unknown
    1: 75,   # Paved
    2: 45,   # Unpaved
    3: 90,   # Asphalt
    4: 85,   # Concrete
    6: 70,   # Metal
    7: 40,   # Wood
    8: 55,   # Compacted gravel
    10: 50,  # Gravel
    11: 40,  # Dirt
    12: 35,  # Ground
    13: 30,  # Ice/snow
    14: 75,  # Paving stones
    15: 45,  # Sand
    17: 20,  # Grass
    18: 25,  # Grass paver
}


WAYTYPE_EXPOSURE = {

    0: 50,   # Unknown
    1: 90,   # State road
    2: 80,   # Road
    3: 65,   # Street
    4: 40,   # Path
    5: 45,   # Track
    6: 45,   # Cycleway
    7: 35,   # Footway
    8: 50,   # Steps
    9: 60,   # Ferry
    10: 75,  # Construction
}


def get_surface_exposure(surface_id):

    return SURFACE_EXPOSURE.get(
        int(surface_id),
        50
    )


def get_waytype_exposure(waytype_id):

    return WAYTYPE_EXPOSURE.get(
        int(waytype_id),
        50
    )


# ============================================================
# Route Metadata Helpers
# ============================================================

def build_lookup(values):

    """
    Convert:

        [[0, 10, 3], [10, 20, 1]]

    into a function-friendly list.
    """

    result = []

    for item in values or []:

        if len(item) < 3:
            continue

        result.append({

            "start": int(
                item[0]
            ),

            "end": int(
                item[1]
            ),

            "value": int(
                item[2]
            ),
        })

    return result


def value_for_waypoint(
    index,
    lookup,
    default=0
):

    for item in lookup:

        if (
            item["start"]
            <= index
            < item["end"]
        ):

            return item["value"]

    return default


# ============================================================
# Segment Route
# ============================================================

def segment_route(route):

    geometry = route[
        "geometry"
    ][
        "coordinates"
    ]

    extras = route.get(
        "properties",
        {}
    ).get(
        "extras",
        {}
    )

    surface_data = extras.get(
        "surface",
        {}
    ).get(
        "values",
        []
    )

    # Newer ORS responses use "waytype".
    # Some older responses used "waytypes".

    waytype_data = extras.get(
        "waytype",
        {}
    ).get(
        "values",
        []
    )

    if not waytype_data:

        waytype_data = extras.get(
            "waytypes",
            {}
        ).get(
            "values",
            []
        )

    surface_lookup = build_lookup(
        surface_data
    )

    waytype_lookup = build_lookup(
        waytype_data
    )

    segments = []

    for i in range(
        len(geometry) - 1
    ):

        start_point = geometry[i]

        end_point = geometry[i + 1]

        distance_km = haversine_km(
            start_point,
            end_point
        )

        surface_id = value_for_waypoint(
            i,
            surface_lookup,
            0
        )

        waytype_id = value_for_waypoint(
            i,
            waytype_lookup,
            0
        )

        surface_exposure = (
            get_surface_exposure(
                surface_id
            )
        )

        waytype_exposure = (
            get_waytype_exposure(
                waytype_id
            )
        )

        # Environmental proxy:
        #
        # 60% surface
        # 40% way type
        #
        # This can later be replaced with
        # actual tree/shade/GIS data.

        environmental_exposure = (

            surface_exposure * 0.60

            + waytype_exposure * 0.40
        )

        segments.append({

            "start_point": {

                "longitude":
                    round(
                        start_point[0],
                        6
                    ),

                "latitude":
                    round(
                        start_point[1],
                        6
                    ),
            },

            "end_point": {

                "longitude":
                    round(
                        end_point[0],
                        6
                    ),

                "latitude":
                    round(
                        end_point[1],
                        6
                    ),
            },

            "distance_km":
                round(
                    distance_km,
                    4
                ),

            "surface_id":
                surface_id,

            "surface_exposure":
                surface_exposure,

            "waytype_id":
                waytype_id,

            "waytype_exposure":
                waytype_exposure,

            "environmental_exposure":
                round(
                    environmental_exposure,
                    1
                ),
        })

    return segments


# ============================================================
# Calculate Route Heat
# ============================================================

def calculate_route_heat(
    route,
    weather
):

    distance_km = (
        route["properties"]["summary"]["distance"]
        / 1000.0
    )

    duration_min = (
        route["properties"]["summary"]["duration"]
        / 60.0
    )

    weather_heat, components, weights = (
        calculate_weather_heat(

            weather["temperature_c"],

            weather["humidity_percent"],

            weather["wind_speed_kmh"],

            duration_min
        )
    )

    segments = segment_route(
        route
    )

    if segments:

        total_distance = sum(
            s["distance_km"]
            for s in segments
        )

        if total_distance > 0:

            environmental_exposure = (
                sum(
                    s["environmental_exposure"]
                    * s["distance_km"]
                    for s in segments
                )
                / total_distance
            )

        else:

            environmental_exposure = 50

    else:

        environmental_exposure = 50

    # Weather remains dominant.
    #
    # 80% weather-based heat
    # 20% environmental proxy
    #
    # Later this 20% can become actual
    # shade/tree/solar exposure data.

    final_heat = (

        weather_heat * 0.80

        + environmental_exposure * 0.20
    )

    final_heat = round(
        clamp(final_heat),
        1
    )

    if final_heat <= 25:

        category = "Low"

    elif final_heat <= 50:

        category = "Moderate"

    elif final_heat <= 75:

        category = "High"

    else:

        category = "Very High"

    return {

        "heat_score":
            final_heat,

        "category":
            category,

        "weather_heat":
            weather_heat,

        "environmental_exposure":
            round(
                environmental_exposure,
                1
            ),

        "components":
            components,

        "weights":
            weights,

        "segments":
            segments,
    }


# ============================================================
# Route Ranking
# ============================================================

ROUTE_MODES = {

    "fast": {

        "time": 0.60,

        "distance": 0.20,

        "heat": 0.20,
    },

    "balanced": {

        "time": 0.35,

        "distance": 0.25,

        "heat": 0.40,
    },

    "heat-safe": {

        "time": 0.15,

        "distance": 0.15,

        "heat": 0.70,
    },
}


def normalize(values):

    if not values:

        return []

    minimum = min(values)

    maximum = max(values)

    if maximum == minimum:

        return [
            0.0
            for _ in values
        ]

    return [
        (
            value - minimum
        )
        / (
            maximum - minimum
        )
        for value in values
    ]


def rank_routes(routes):

    times = [
        r["duration_min"]
        for r in routes
    ]

    distances = [
        r["distance_km"]
        for r in routes
    ]

    heats = [
        r["heat"]["heat_score"]
        for r in routes
    ]

    normalized_time = normalize(
        times
    )

    normalized_distance = normalize(
        distances
    )

    normalized_heat = normalize(
        heats
    )

    for index, route in enumerate(
        routes
    ):

        route["normalized"] = {

            "time": round(
                normalized_time[index],
                3
            ),

            "distance": round(
                normalized_distance[index],
                3
            ),

            "heat": round(
                normalized_heat[index],
                3
            ),
        }

        for mode_name, weights in (
            ROUTE_MODES.items()
        ):

            score = (

                normalized_time[index]
                * weights["time"]

                + normalized_distance[index]
                * weights["distance"]

                + normalized_heat[index]
                * weights["heat"]
            )

            route.setdefault(
                "mode_scores",
                {}
            )[mode_name] = round(
                score,
                3
            )

    # Best route = lowest score.

    recommendations = {}

    for mode_name in ROUTE_MODES:

        best = min(
            routes,
            key=lambda r:
                r["mode_scores"][mode_name]
        )

        recommendations[mode_name] = {

            "route_id":
                best["route_id"],

            "reason": (
                f"Best {mode_name} option based on "
                f"time, distance and estimated heat exposure."
            ),
        }

    return recommendations


# ============================================================
# HeiGIT Routing
# ============================================================

def get_routes(
    origin_lat,
    origin_lon,
    destination_lat,
    destination_lon
):

    payload = {

        "coordinates": [

            [
                origin_lon,
                origin_lat
            ],

            [
                destination_lon,
                destination_lat
            ]
        ],

        "alternative_routes": {

            "target_count": 3,

            "share_factor": 0.8,

            "weight_factor": 1.5
        },

        "extra_info": [

            "surface",

            "waytype"
        ]
    }

    response = post_json(

        ROUTING_URL,

        payload,

        {
            "Authorization":
                HEIGIT_API_KEY,
        }
    )

    return response.get(
        "features",
        []
    )


# ============================================================
# Lambda
# ============================================================

def lambda_handler(event, context):

    # --------------------------------------------------------
    # CORS preflight
    # --------------------------------------------------------

    request_context = event.get(
        "requestContext",
        {}
    )

    http_method = (
        request_context.get(
            "http",
            {}
        ).get(
            "method"
        )
        or event.get(
            "httpMethod"
        )
        or ""
    ).upper()

    if http_method == "OPTIONS":

        return api_response(
            204,
            {}
        )

    try:

        query = event.get(
            "queryStringParameters"
        ) or {}

        body = {}

        if event.get("body"):

            try:

                body = json.loads(
                    event["body"]
                )

            except json.JSONDecodeError:

                return api_response(
                    400,
                    {
                        "status": "error",
                        "message":
                            "Request body must contain valid JSON."
                    }
                )

        # ----------------------------------------------------
        # Support GET query parameters
        # and POST JSON bodies.
        # ----------------------------------------------------

        origin_lat_raw = body.get(
            "originLat",
            query.get("originLat")
        )

        origin_lon_raw = body.get(
            "originLon",
            query.get("originLon")
        )

        destination_lat_raw = body.get(
            "destLat",
            query.get("destLat")
        )

        destination_lon_raw = body.get(
            "destLon",
            query.get("destLon")
        )

        required_values = {

            "originLat":
                origin_lat_raw,

            "originLon":
                origin_lon_raw,

            "destLat":
                destination_lat_raw,

            "destLon":
                destination_lon_raw,
        }

        missing = [

            name

            for name, value
            in required_values.items()

            if value is None
            or value == ""
        ]

        if missing:

            return api_response(
                400,
                {
                    "status":
                        "error",

                    "message":
                        "Missing required parameters.",

                    "missing":
                        missing,
                }
            )

        try:

            origin_lat = float(
                origin_lat_raw
            )

            origin_lon = float(
                origin_lon_raw
            )

            destination_lat = float(
                destination_lat_raw
            )

            destination_lon = float(
                destination_lon_raw
            )

        except (
            TypeError,
            ValueError
        ):

            return api_response(
                400,
                {
                    "status":
                        "error",

                    "message":
                        (
                            "Coordinates must be valid "
                            "numeric values."
                        ),
                }
            )

        # ----------------------------------------------------
        # Coordinate validation
        # ----------------------------------------------------

        if not (
            -90 <= origin_lat <= 90
            and -180 <= origin_lon <= 180
            and -90 <= destination_lat <= 90
            and -180 <= destination_lon <= 180
        ):

            return api_response(
                400,
                {
                    "status":
                        "error",

                    "message":
                        (
                            "Invalid coordinate range. "
                            "Latitude must be between -90 and 90; "
                            "longitude must be between -180 and 180."
                        ),
                }
            )

        # ----------------------------------------------------
        # Generate request ID
        # ----------------------------------------------------

        request_id = (
            f"req-{uuid.uuid4()}"
        )

        created_at = (
            datetime.now(
                timezone.utc
            ).isoformat()
        )

        # ----------------------------------------------------
        # Weather
        # ----------------------------------------------------

        weather = get_weather(

            origin_lat,

            origin_lon
        )

        # ----------------------------------------------------
        # Routes
        # ----------------------------------------------------

        route_features = get_routes(

            origin_lat,

            origin_lon,

            destination_lat,

            destination_lon
        )

        if not route_features:

            raise Exception(
                "No walking routes were returned."
            )

        routes = []

        for index, feature in enumerate(
            route_features
        ):

            properties = feature.get(
                "properties",
                {}
            )

            summary = properties.get(
                "summary",
                {}
            )

            distance_km = (

                summary.get(
                    "distance",
                    0
                )

                / 1000.0
            )

            duration_min = (

                summary.get(
                    "duration",
                    0
                )

                / 60.0
            )

            route = {

                "route_id":
                    f"route-{index + 1}",

                "distance_km":
                    round(
                        distance_km,
                        2
                    ),

                "duration_min":
                    round(
                        duration_min,
                        1
                    ),

                "geometry":
                    feature.get(
                        "geometry"
                    ),

                "heat":
                    calculate_route_heat(
                        feature,
                        weather
                    ),
            }

            routes.append(
                route
            )

        # ----------------------------------------------------
        # Ranking
        # ----------------------------------------------------

        recommendations = rank_routes(
            routes
        )

        # ----------------------------------------------------
        # Find overall heat-safe route
        # ----------------------------------------------------

        heat_safe_route = next(

            r

            for r in routes

            if r["route_id"]
            == recommendations[
                "heat-safe"
            ][
                "route_id"
            ]
        )

        # ----------------------------------------------------
        # Model metadata
        # ----------------------------------------------------

        model = {

            "description":
                "Relative Heat Exposure Score",

            "weather_weights": {

                "temperature":
                    0.50,

                "humidity":
                    0.15,

                "wind":
                    0.10,

                "duration":
                    0.25,
            },

            "environmental_proxy_weights": {

                "surface":
                    0.60,

                "waytype":
                    0.40,
            },

            "final_heat_weights": {

                "weather":
                    0.80,

                "environmental_proxy":
                    0.20,
            },

            "note": (
                "Environmental exposure currently uses "
                "OpenStreetMap surface and waytype proxies. "
                "It is not a direct measurement of shade, "
                "tree cover or solar radiation."
            ),
        }

        # ----------------------------------------------------
        # Final response
        # ----------------------------------------------------

        result = {

            "status":
                "ok",

            "request_id":
                request_id,

            "origin": {

                "latitude":
                    origin_lat,

                "longitude":
                    origin_lon,
            },

            "destination": {

                "latitude":
                    destination_lat,

                "longitude":
                    destination_lon,
            },

            "weather":
                weather,

            "route_count":
                len(routes),

            "routes":
                routes,

            "recommendations":
                recommendations,

            "recommended_route":
                heat_safe_route[
                    "route_id"
                ],

            "model":
                model,

            "storage":
                {
                    "status":
                        "pending",
                    "table":
                        DYNAMODB_TABLE_NAME,
                },
        }

        # ----------------------------------------------------
        # Persist to DynamoDB
        # ----------------------------------------------------

        try:

            persist_route_plan(

                request_id=

                    request_id,

                created_at=

                    created_at,

                origin_lat=

                    origin_lat,

                origin_lon=

                    origin_lon,

                destination_lat=

                    destination_lat,

                destination_lon=

                    destination_lon,

                weather=

                    weather,

                routes=

                    routes,

                recommendations=

                    recommendations,

                recommended_route=

                    heat_safe_route[
                        "route_id"
                    ],

                model=

                    model,
            )

            result["storage"]["status"] = (
                "saved"
            )

        except Exception as db_error:

            print(
                "DynamoDB persistence failed:",
                str(db_error)
            )

            # Routing itself succeeded, but the complete
            # backend operation did not because persistence
            # failed. Return an explicit error rather than
            # pretending the record was stored.

            return api_response(
                500,
                {
                    "status":
                        "error",

                    "message":
                        (
                            "Route planning succeeded, "
                            "but saving the result to DynamoDB failed."
                        ),

                    "request_id":
                        request_id,

                    "storage":
                        {
                            "status":
                                "failed",

                            "table":
                                DYNAMODB_TABLE_NAME,
                        },
                }
            )

        # ----------------------------------------------------
        # Success
        # ----------------------------------------------------

        return api_response(
            200,
            result
        )

    except Exception as e:

        print(
            "Planner error:",
            str(e)
        )

        return api_response(
            500,
            {
                "status":
                    "error",

                "message":
                    str(e),
            }
        )