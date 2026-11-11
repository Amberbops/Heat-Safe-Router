"""Small API Gateway REST proxy response helpers."""
from __future__ import annotations

import json
import os


def cors_headers(event: dict | None = None) -> dict[str, str]:
    allowed = {
        item.strip() for item in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if item.strip()
    }
    headers = (event or {}).get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin") or ""
    result = {
        "Content-Type": "application/json",
        "Vary": "Origin",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    }
    if origin in allowed:
        result["Access-Control-Allow-Origin"] = origin
    return result


def response(status_code: int, body: dict, event: dict | None = None) -> dict:
    return {
        "statusCode": status_code,
        "headers": cors_headers(event),
        "body": json.dumps(body, separators=(",", ":")),
    }


def parse_json_body(event: dict) -> dict:
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64
        body = base64.b64decode(body).decode("utf-8")
    parsed = json.loads(body)
    if not isinstance(parsed, dict):
        raise ValueError("JSON request body must be an object")
    return parsed


def bearer_token(event: dict) -> str:
    headers = event.get("headers") or {}
    value = headers.get("Authorization") or headers.get("authorization") or ""
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return ""
    return token.strip()
