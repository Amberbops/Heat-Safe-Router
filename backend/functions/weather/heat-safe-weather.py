import json
import urllib.request
import urllib.parse


def lambda_handler(event, context):

    # Get latitude and longitude from API Gateway query parameters
    query_params = event.get("queryStringParameters") or {}

    latitude = query_params.get("latitude")
    longitude = query_params.get("longitude")

    # Validate input
    if not latitude or not longitude:
        return {
            "statusCode": 400,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,OPTIONS"
            },
            "body": json.dumps({
                "error": "latitude and longitude are required",
                "example": "/weather?latitude=22.7196&longitude=75.8577"
            })
        }

    try:
        # Build Open-Meteo request
        params = urllib.parse.urlencode({
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
            "timezone": "auto"
        })

        url = f"https://api.open-meteo.com/v1/forecast?{params}"

        # Call Open-Meteo
        with urllib.request.urlopen(url, timeout=10) as response:
            weather_data = json.loads(response.read().decode())

        current = weather_data.get("current", {})

        result = {
            "latitude": latitude,
            "longitude": longitude,
            "temperature_c": current.get("temperature_2m"),
            "humidity_percent": current.get("relative_humidity_2m"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "timezone": weather_data.get("timezone")
        }

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,OPTIONS"
            },
            "body": json.dumps(result)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "GET,OPTIONS"
            },
            "body": json.dumps({
                "error": "Failed to fetch weather data",
                "details": str(e)
            })
        }