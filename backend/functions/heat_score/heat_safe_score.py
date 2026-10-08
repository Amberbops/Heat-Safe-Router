import json


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


def clamp(value, minimum=0, maximum=100):
    return max(minimum, min(value, maximum))


def temperature_score(temp):
    """
    Relative temperature contribution.

    <= 25 C  -> low contribution
    >= 40 C  -> maximum contribution
    """

    score = ((temp - 25) / 15) * 100
    return clamp(score)


def humidity_score(humidity):
    """
    Relative humidity contribution.

    <= 30% -> low contribution
    >= 80% -> maximum contribution
    """

    score = ((humidity - 30) / 50) * 100
    return clamp(score)


def wind_score(wind):
    """
    Higher wind generally reduces perceived heat exposure.

    >= 20 km/h -> low contribution
    <= 0 km/h  -> maximum contribution
    """

    score = ((20 - wind) / 20) * 100
    return clamp(score)


def duration_score(duration):
    """
    Walking exposure duration.

    <= 10 min -> low contribution
    >= 40 min -> maximum contribution
    """

    score = ((duration - 10) / 30) * 100
    return clamp(score)


def get_category(score):

    if score <= 25:
        return "Low"

    if score <= 50:
        return "Moderate"

    if score <= 75:
        return "High"

    return "Very High"


def lambda_handler(event, context):

    query_params = event.get("queryStringParameters") or {}

    try:

        temperature = float(query_params["temperature"])
        humidity = float(query_params["humidity"])
        wind = float(query_params["wind"])
        duration = float(query_params["duration"])

    except (KeyError, TypeError, ValueError):

        return response(400, {
            "error": "Missing or invalid parameters",
            "required": [
                "temperature",
                "humidity",
                "wind",
                "duration"
            ],
            "example": (
                "/heat-score?"
                "temperature=33.5&"
                "humidity=26&"
                "wind=10.7&"
                "duration=16.3"
            )
        })

    # Calculate individual components
    temp_component = temperature_score(temperature)
    humidity_component = humidity_score(humidity)
    wind_component = wind_score(wind)
    duration_component = duration_score(duration)

    # Weighted heat exposure score
    heat_score = (
    temp_component * 0.50
    + humidity_component * 0.15
    + wind_component * 0.10
    + duration_component * 0.25
    )

    heat_score = round(clamp(heat_score), 1)

    category = get_category(heat_score)

    return response(200, {
        "status": "ok",
        "heat_score": heat_score,
        "category": category,

        "inputs": {
            "temperature_c": temperature,
            "humidity_percent": humidity,
            "wind_speed_kmh": wind,
            "duration_min": duration
        },

        "components": {
            "temperature": round(temp_component, 1),
            "humidity": round(humidity_component, 1),
            "wind": round(wind_component, 1),
            "duration": round(duration_component, 1)
        },

        "weights": {
            "temperature": 0.50,
            "humidity": 0.15,
            "wind": 0.10,
            "duration": 0.25
        }
    })