"""Dedicated API Gateway Lambda for Heat-Safe Cool Spots.

Routes:
  GET    /cool-spots                         public
  POST   /cool-spots                         admin (legacy alias)
  POST   /cool-spots/requests                public nomination
  GET    /admin/cool-spots                   admin
  POST   /admin/cool-spots                   admin
  GET    /admin/cool-spots/requests          admin
  PATCH  /admin/cool-spots/requests/{id}     admin
  DELETE /admin/cool-spots/{id}              admin

Administrative checks rely only on the verified context inserted by the
API Gateway Lambda authorizer. Raw bearer tokens and client-supplied roles are
never decoded or trusted here.
"""
from __future__ import annotations

import logging

import boto3
from botocore.exceptions import ClientError

from backend.functions.cool_spots.config import get_settings
from backend.functions.cool_spots.http import InvalidRequestBody, parse_body, response
from backend.functions.cool_spots.repositories.cool_spots_repository import (
    CoolSpotsRepository,
    RequestAlreadyReviewedError,
)
from backend.functions.cool_spots.services.cool_spots_service import CoolSpotsService
from backend.functions.cool_spots.services.media_service import MediaService, MediaValidationError
from backend.functions.cool_spots.validation import ValidationError
from backend.shared.auth.identity import get_verified_identity

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_service: CoolSpotsService | None = None
_settings = None


def _get_service() -> tuple[CoolSpotsService, tuple[str, ...]]:
    global _service, _settings
    if _service is None:
        settings = get_settings()
        dynamodb = boto3.resource("dynamodb", region_name=settings.region)
        dynamodb_client = boto3.client("dynamodb", region_name=settings.region)
        s3 = boto3.client("s3", region_name=settings.region)
        repository = CoolSpotsRepository(
            spots_table=dynamodb.Table(settings.spots_table_name),
            requests_table=dynamodb.Table(settings.requests_table_name),
            dynamodb_client=dynamodb_client,
            spots_city_index_name=settings.spots_city_index_name,
        )
        media = MediaService(s3, settings.media_bucket_name, settings.region, settings.max_image_bytes)
        _service = CoolSpotsService(repository, media)
        _settings = settings
    return _service, _settings.allowed_origins


def _method(event: dict) -> str:
    return str(
        event.get("httpMethod")
        or ((event.get("requestContext") or {}).get("http") or {}).get("method")
        or "GET"
    ).upper()


def _path(event: dict) -> str:
    path = str(event.get("path") or event.get("rawPath") or "/")
    # API Gateway REST proxy events normally omit the stage prefix. This small
    # normalization also makes direct test events with /dev/... behave sensibly.
    parts = path.split("/", 2)
    if len(parts) == 3 and parts[1] in {"dev", "prod", "test"}:
        path = "/" + parts[2]
    return path.rstrip("/") or "/"


def _admin_identity(event: dict) -> dict | None:
    identity = get_verified_identity(event)
    if not identity or identity.get("role") != "admin":
        return None
    return identity


def _require_admin(event: dict, origin_allowlist: tuple[str, ...]):
    identity = _admin_identity(event)
    if not identity:
        return None, response(403, {"error": "Forbidden: administrator access required"}, event, origin_allowlist)
    return identity, None


def _not_found(event: dict, allowed_origins: tuple[str, ...], method: str, path: str):
    return response(404, {"error": f"Route not found: {method} {path}"}, event, allowed_origins)


def lambda_handler(event, context):
    method = _method(event)
    path = _path(event)

    # Preflight requests do not need to initialize DynamoDB or S3 clients.
    try:
        allowed_origins = get_settings().allowed_origins
    except Exception:
        allowed_origins = ("http://localhost:5173",)
    if method == "OPTIONS":
        return response(204, {}, event, allowed_origins)

    try:
        service, allowed_origins = _get_service()
    except Exception as exc:
        logger.error("Cool Spots dependency initialization failed: %s", type(exc).__name__)
        return response(500, {"error": "Cool Spots service unavailable"}, event, allowed_origins)

    try:
        if method == "GET" and path == "/cool-spots":
            query = event.get("queryStringParameters") or {}
            return response(200, service.list_spots(query.get("city", "indore")), event, allowed_origins)

        if method == "POST" and path == "/cool-spots/requests":
            identity = get_verified_identity(event)
            if not identity:
                return response(401, {"error": "Authentication required"}, event, allowed_origins)
            body = parse_body(event)
            result = service.submit_request(body, identity)
            return response(201, result, event, allowed_origins)

        if method == "GET" and path == "/admin/cool-spots":
            _, denied = _require_admin(event, allowed_origins)
            if denied:
                return denied
            query = event.get("queryStringParameters") or {}
            return response(200, service.list_spots(query.get("city", "indore")), event, allowed_origins)

        if method == "GET" and path == "/admin/cool-spots/requests":
            _, denied = _require_admin(event, allowed_origins)
            if denied:
                return denied
            return response(200, service.list_requests(), event, allowed_origins)

        if method == "POST" and path in {"/admin/cool-spots", "/cool-spots"}:
            identity, denied = _require_admin(event, allowed_origins)
            if denied:
                return denied
            body = parse_body(event)
            result = service.upsert_spot(body, identity)
            return response(200, result, event, allowed_origins)

        if method == "PATCH" and path.startswith("/admin/cool-spots/requests/"):
            identity, denied = _require_admin(event, allowed_origins)
            if denied:
                return denied
            request_id = (event.get("pathParameters") or {}).get("id") or path.rsplit("/", 1)[-1]
            body = parse_body(event)
            result = service.review_request(request_id, body, identity)
            if result is None:
                return response(404, {"error": "Request not found"}, event, allowed_origins)
            return response(200, result, event, allowed_origins)

        if method == "DELETE" and path.startswith("/admin/cool-spots/"):
            identity, denied = _require_admin(event, allowed_origins)
            if denied:
                return denied
            spot_id = (event.get("pathParameters") or {}).get("id")
            if not spot_id:
                proxy_value = (event.get("pathParameters") or {}).get("proxy")
                spot_id = str(proxy_value).rsplit("/", 1)[-1] if proxy_value else path.rsplit("/", 1)[-1]
            query = event.get("queryStringParameters") or {}
            result = service.delete_spot(query.get("city", "indore"), str(spot_id or ""))
            if not result["deleted"]:
                return response(404, {"error": "Cool spot not found", "spot_id": result["spot_id"]}, event, allowed_origins)
            return response(200, {"message": f"Deleted spot {result['spot_id']}"}, event, allowed_origins)

        return _not_found(event, allowed_origins, method, path)

    except (InvalidRequestBody, ValidationError, MediaValidationError) as exc:
        logger.warning("Validation error on %s %s: %s", method, path, exc)
        return response(400, {"error": str(exc)}, event, allowed_origins)
    except RequestAlreadyReviewedError as exc:
        logger.warning("Nomination review conflict on %s %s: %s", method, path, exc)
        detail = str(exc).strip()
        msg = (
            f"This nomination has already been reviewed or its spot already exists ({detail})"
            if detail
            else "This nomination has already been reviewed or its spot already exists"
        )
        return response(409, {"error": msg}, event, allowed_origins)
    except ClientError as exc:
        error = exc.response.get("Error", {})
        metadata = exc.response.get("ResponseMetadata", {})
        logger.error(
            "Cool Spots AWS operation failed: code=%s status=%s request_id=%s",
            error.get("Code", "Unknown"),
            metadata.get("HTTPStatusCode", "Unknown"),
            metadata.get("RequestId", "Unknown"),
        )
        return response(500, {"error": "Cool Spots storage operation failed"}, event, allowed_origins)
    except Exception as exc:
        logger.error("Cool Spots request failed: %s", type(exc).__name__)
        return response(500, {"error": "Cool Spots service unavailable"}, event, allowed_origins)
