"""Read identity context produced by the API Gateway Lambda authorizer."""
from __future__ import annotations


def get_verified_identity(event: dict) -> dict | None:
    authorizer = (event.get("requestContext") or {}).get("authorizer") or {}
    # REST API Lambda authorizer context is exposed directly under authorizer.
    user_id = authorizer.get("user_id")
    role = authorizer.get("role")
    email = authorizer.get("email")
    session_id = authorizer.get("session_id")
    if not user_id or role not in {"user", "admin"}:
        return None
    return {
        "user_id": str(user_id),
        "email": str(email or ""),
        "role": str(role),
        "session_id": str(session_id or ""),
    }


def is_admin(event: dict) -> bool:
    identity = get_verified_identity(event)
    return bool(identity and identity["role"] == "admin")
