"""AWS Lambda function for HeatSafe Cool Spots & Community Nominations.

Storage Services Used:
1. Amazon DynamoDB:
   - HeatSafe_CoolSpots (Partition Key: city, Sort Key: spot_id)
   - HeatSafe_SpotRequests (Partition Key: request_id)
2. Amazon S3:
   - heatsafe-coolspots-media (for user uploaded photos)
"""

import base64
import json
import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal
import boto3
from boto3.dynamodb.conditions import Key, Attr

# ============================================================
# Environment & AWS Clients
# ============================================================
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
COOL_SPOTS_TABLE_NAME = os.environ.get("COOL_SPOTS_TABLE_NAME", "HeatSafe_CoolSpots")
SPOT_REQUESTS_TABLE_NAME = os.environ.get("SPOT_REQUESTS_TABLE_NAME", "HeatSafe_SpotRequests")
MEDIA_BUCKET_NAME = os.environ.get("MEDIA_BUCKET_NAME", "heatsafe-coolspots-media")

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
s3_client = boto3.client("s3", region_name=AWS_REGION)

cool_spots_table = dynamodb.Table(COOL_SPOTS_TABLE_NAME)
spot_requests_table = dynamodb.Table(SPOT_REQUESTS_TABLE_NAME)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
}

# ============================================================
# Helpers
# ============================================================
def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def api_response(status_code: int, body: dict):
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, default=decimal_default),
    }

def convert_floats_to_decimals(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: convert_floats_to_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_floats_to_decimals(item) for item in obj]
    return obj

def upload_base64_image_to_s3(base64_str: str, file_prefix: str = "spots") -> str:
    """Decodes a base64 image data URI and uploads it to S3, returning the URL."""
    if not base64_str or not base64_str.startswith("data:image"):
        return base64_str  # Already a normal URL or empty

    try:
        header, encoded = base64_str.split(",", 1)
        ext = "jpg"
        if "png" in header:
            ext = "png"
        elif "webp" in header:
            ext = "webp"

        image_bytes = base64.b64decode(encoded)
        filename = f"{file_prefix}/{uuid.uuid4().hex}.{ext}"

        s3_client.put_object(
            Bucket=MEDIA_BUCKET_NAME,
            Key=filename,
            Body=image_bytes,
            ContentType=f"image/{ext}",
        )

        return f"https://{MEDIA_BUCKET_NAME}.s3.{AWS_REGION}.amazonaws.com/{filename}"
    except Exception as err:
        print(f"[S3 Upload Warning] Failed to upload image to S3: {err}")
        return ""

def is_admin_authorized(event) -> bool:
    """Verifies whether the request originates from a user belonging to the Cognito 'Admins' group."""
    # 1. API Gateway Cognito Authorizer claims
    auth_ctx = event.get("requestContext", {}).get("authorizer", {})
    claims = auth_ctx.get("claims", {})
    if claims:
        groups = claims.get("cognito:groups", "")
        if isinstance(groups, list) and any(str(g).lower() == "admins" for g in groups):
            return True
        if isinstance(groups, str) and any(g.strip().lower() == "admins" for g in groups.split(",")):
            return True

    # 2. Authorization Bearer Token inspection
    headers = event.get("headers") or {}
    auth_header = headers.get("Authorization") or headers.get("authorization") or ""
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            parts = token.split(".")
            if len(parts) >= 2:
                payload_b64 = parts[1]
                payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
                payload_json = base64.b64decode(payload_b64).decode("utf-8")
                token_claims = json.loads(payload_json)
                groups = token_claims.get("cognito:groups", [])
                if isinstance(groups, list) and any(str(g).lower() == "admins" for g in groups):
                    return True
                if isinstance(groups, str) and any(g.strip().lower() == "admins" for g in groups.split(",")):
                    return True
        except Exception:
            pass

    # Support development test tokens
    if "aws-cognito-mock-jwt-admin" in auth_header:
        return True

    return False

# Default initial verified spots for Indore if DynamoDB table is newly provisioned
INITIAL_VERIFIED_SPOTS = [
    {
        "spot_id": "spot_indore_vallabh_garden",
        "city": "indore",
        "name": "vallabh garden khatiwala tank",
        "description": "pyau and extensive shade throughout the path nearby",
        "category": "canopy_park",
        "lat": 22.6973,
        "lon": 75.8626,
        "coords": {"lat": 22.6973, "lon": 75.8626},
        "logo_id": "tree_canopy",
        "coolingOffsetC": 3.5,
        "openHours": "06:00 - 21:00",
        "upvotes": 38,
        "verified_by": "admin@heatsafe.in",
        "created_at": "2024-01-01T00:00:00Z",
    },
    {
        "spot_id": "spot_indore_nehru_park",
        "city": "indore",
        "name": "Nehru Park Shaded Banyan Walk",
        "description": "Thick canopy cover with public drinking water tap nearby.",
        "category": "canopy_park",
        "lat": 22.7150,
        "lon": 75.8620,
        "coords": {"lat": 22.7150, "lon": 75.8620},
        "logo_id": "tree_canopy",
        "coolingOffsetC": 4.2,
        "openHours": "06:00 - 21:00",
        "upvotes": 63,
        "verified_by": "admin@heatsafe.in",
        "created_at": "2024-01-01T00:00:00Z",
    },
    {
        "spot_id": "spot_indore_regional_park",
        "city": "indore",
        "name": "Regional Park Shaded Promenade",
        "description": "Dense neem & banyan canopy with mist breeze near canal bank.",
        "category": "canopy_park",
        "lat": 22.6845,
        "lon": 75.8521,
        "coords": {"lat": 22.6845, "lon": 75.8521},
        "logo_id": "tree_canopy",
        "coolingOffsetC": 3.5,
        "openHours": "06:00 - 21:00",
        "upvotes": 48,
        "verified_by": "admin@heatsafe.in",
        "created_at": "2024-01-01T00:00:00Z",
    },
    {
        "spot_id": "spot_indore_rajwada_kiosk",
        "city": "indore",
        "name": "Rajwada Heritage Hydration Kiosk",
        "description": "Filtered cold drinking water station and shaded stone arcade.",
        "category": "hydration",
        "lat": 22.7186,
        "lon": 75.8547,
        "coords": {"lat": 22.7186, "lon": 75.8547},
        "logo_id": "water_station",
        "coolingOffsetC": 2.0,
        "openHours": "08:00 - 22:00",
        "upvotes": 112,
        "verified_by": "admin@heatsafe.in",
        "created_at": "2024-01-01T00:00:00Z",
    },
]

# ============================================================
# Handlers
# ============================================================
def handle_get_cool_spots(event):
    params = event.get("queryStringParameters") or {}
    city = (params.get("city") or "indore").lower()

    try:
        res = cool_spots_table.query(
            KeyConditionExpression=Key("city").eq(city)
        )
        spots = res.get("Items", [])

        # If table is empty for this city, seed initial spots into DynamoDB
        if not spots and city == "indore":
            for seed in INITIAL_VERIFIED_SPOTS:
                cool_spots_table.put_item(Item=convert_floats_to_decimals(seed))
            spots = INITIAL_VERIFIED_SPOTS

        return api_response(200, {"city": city, "spots": spots, "count": len(spots)})
    except Exception as err:
        print(f"[DynamoDB Error] Failed to fetch cool spots: {err}")
        return api_response(200, {"city": city, "spots": INITIAL_VERIFIED_SPOTS, "count": len(INITIAL_VERIFIED_SPOTS)})

def handle_upsert_cool_spot(event):
    try:
        body = json.loads(event.get("body") or "{}")
        city = (body.get("city") or "indore").lower()
        spot_id = body.get("spot_id") or f"spot_{uuid.uuid4().hex[:10]}"

        # Handle S3 image upload if base64 passed
        image_url = body.get("image_url", "")
        if image_url and image_url.startswith("data:image"):
            image_url = upload_base64_image_to_s3(image_url, "verified_spots")

        lat = float(body.get("lat") or 0)
        lon = float(body.get("lon") or 0)

        item = {
            "city": city,
            "spot_id": spot_id,
            "id": spot_id,
            "name": body.get("name", "Unnamed Spot"),
            "description": body.get("description", ""),
            "category": body.get("category", "canopy_park"),
            "lat": lat,
            "lon": lon,
            "coords": {"lat": lat, "lon": lon},
            "logo_id": body.get("logo_id", "tree_canopy"),
            "coolingOffsetC": float(body.get("coolingOffsetC", 3.0)),
            "openHours": body.get("openHours", "06:00 - 22:00"),
            "upvotes": int(body.get("upvotes", 0)),
            "verified_by": body.get("verified_by", "Admin Verified"),
            "created_at": body.get("created_at") or datetime.now(timezone.utc).isoformat(),
            "image_url": image_url,
        }

        cool_spots_table.put_item(Item=convert_floats_to_decimals(item))
        return api_response(200, {"message": "Cool spot upserted successfully", "spot": item})
    except Exception as err:
        return api_response(500, {"error": str(err)})

def handle_delete_cool_spot(event):
    if not is_admin_authorized(event):
        return api_response(403, {"error": "Forbidden: Requires 'Admins' group privileges"})

    try:
        path_params = event.get("pathParameters") or {}
        spot_id = path_params.get("id")
        query_params = event.get("queryStringParameters") or {}
        city = (query_params.get("city") or "indore").lower()

        if not spot_id:
            return api_response(400, {"error": "Missing spot id"})

        cool_spots_table.delete_item(
            Key={"city": city, "spot_id": spot_id}
        )
        return api_response(200, {"message": f"Deleted spot {spot_id}"})
    except Exception as err:
        return api_response(500, {"error": str(err)})

def handle_submit_request(event):
    try:
        body = json.loads(event.get("body") or "{}")
        request_id = body.get("request_id") or f"req_{int(datetime.now(timezone.utc).timestamp()*1000)}"
        city = (body.get("city") or "indore").lower()

        # Handle photo upload to S3
        spot_image_url = body.get("spot_image_url", "")
        if spot_image_url and spot_image_url.startswith("data:image"):
            spot_image_url = upload_base64_image_to_s3(spot_image_url, "user_nominations")

        lat = float(body.get("lat") or 0)
        lon = float(body.get("lon") or 0)

        item = {
            "request_id": request_id,
            "city": city,
            "user_email": body.get("user_email", "walker@indore.in"),
            "suggested_name": body.get("suggested_name", ""),
            "message": body.get("message", ""),
            "lat": lat,
            "lon": lon,
            "suggested_logo": body.get("suggested_logo", "tree_canopy"),
            "spot_image_url": spot_image_url,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        spot_requests_table.put_item(Item=convert_floats_to_decimals(item))
        return api_response(201, {"message": "Request submitted to DynamoDB", "request": item})
    except Exception as err:
        return api_response(500, {"error": str(err)})

def handle_list_requests(event):
    try:
        res = spot_requests_table.scan()
        requests = res.get("Items", [])
        return api_response(200, {"requests": requests, "count": len(requests)})
    except Exception as err:
        return api_response(500, {"error": str(err)})

def handle_update_request_status(event):
    if not is_admin_authorized(event):
        return api_response(403, {"error": "Forbidden: Requires 'Admins' group privileges"})

    try:
        path_params = event.get("pathParameters") or {}
        request_id = path_params.get("id")
        body = json.loads(event.get("body") or "{}")
        status = (body.get("status") or "APPROVED").upper()

        if not request_id:
            return api_response(400, {"error": "Missing request_id"})

        # Get the request
        get_res = spot_requests_table.get_item(Key={"request_id": request_id})
        req_item = get_res.get("Item")
        if not req_item:
            return api_response(404, {"error": "Request not found"})

        # Update status in DynamoDB
        spot_requests_table.update_item(
            Key={"request_id": request_id},
            UpdateExpression="SET #s = :status",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":status": status.lower()},
        )

        # If approved, automatically create a verified cool spot in HeatSafe_CoolSpots table!
        if status in ("APPROVED", "approved"):
            city = req_item.get("city", "indore").lower()
            new_spot = {
                "city": city,
                "spot_id": request_id,
                "id": request_id,
                "name": req_item.get("suggested_name", "Verified Cool Spot"),
                "description": req_item.get("message", ""),
                "category": "canopy_park",
                "lat": req_item.get("lat"),
                "lon": req_item.get("lon"),
                "coords": {"lat": req_item.get("lat"), "lon": req_item.get("lon")},
                "logo_id": req_item.get("suggested_logo", "tree_canopy"),
                "coolingOffsetC": Decimal("3.5"),
                "openHours": "06:00 - 21:00",
                "upvotes": 1,
                "verified_by": f"Verified ({req_item.get('user_email', 'Admin')})",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "image_url": req_item.get("spot_image_url", ""),
            }
            cool_spots_table.put_item(Item=new_spot)

        return api_response(200, {"message": f"Request status updated to {status}", "request_id": request_id})
    except Exception as err:
        return api_response(500, {"error": str(err)})

# ============================================================
# Main Entry Point
# ============================================================
def lambda_handler(event, context):
    http_method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method", "GET")
    path = event.get("path") or event.get("rawPath", "")

    # CORS Preflight
    if http_method == "OPTIONS":
        return api_response(200, {"message": "OK"})

    if path.endswith("/cool-spots") or path.endswith("/cool-spots/"):
        if http_method == "GET":
            return handle_get_cool_spots(event)
        if http_method == "POST":
            return handle_upsert_cool_spot(event)

    elif "/cool-spots/" in path and http_method == "DELETE":
        return handle_delete_cool_spot(event)

    elif "cool-spots/requests" in path:
        if http_method == "POST":
            return handle_submit_request(event)
        if http_method == "GET":
            return handle_list_requests(event)

    elif "/admin/cool-spots/requests/" in path or "/cool-spots/requests/" in path:
        if http_method in ("PATCH", "PUT", "POST"):
            return handle_update_request_status(event)

    return api_response(404, {"error": f"Route not found: {http_method} {path}"})
