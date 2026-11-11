"""HTTP and JSON helpers for API Gateway REST Lambda proxy events."""
from __future__ import annotations

import base64
import json
from decimal import Decimal
from typing import Any


class InvalidRequestBody(ValueError):
    pass


def _json_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def response(status_code: int, body: dict, event: dict | None = None, allowed_origins: tuple[str, ...] = ()) -> dict:
    headers_in = (event or {}).get("headers") or {}
    origin = headers_in.get("origin") or headers_in.get("Origin") or ""
    headers = {
        "Content-Type": "application/json",
        "Vary": "Origin",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    }
    if origin and ("*" in allowed_origins or origin in allowed_origins):
        headers["Access-Control-Allow-Origin"] = origin
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(body, default=_json_value, separators=(",", ":")),
    }


def parse_body(event: dict) -> dict:
    raw = event.get("body")
    if not raw:
        return {}
    if event.get("isBase64Encoded"):
        try:
            raw = base64.b64decode(raw, validate=True).decode("utf-8")
        except Exception as exc:
            raise InvalidRequestBody("Request body is not valid base64-encoded UTF-8") from exc
    try:
        result = json.loads(raw)
    except (TypeError, json.JSONDecodeError) as exc:
        raise InvalidRequestBody("Request body must contain valid JSON") from exc
    if not isinstance(result, dict):
        raise InvalidRequestBody("Request body must be a JSON object")
    return result
