"""API Gateway REST TOKEN authorizer for Heat-Safe protected endpoints."""
from __future__ import annotations

from backend.shared.auth.config import get_auth_config
from backend.shared.auth.tokens import decode_access_token
from backend.shared.aws.parameter_store import get_parameter_value


def _method_and_path(method_arn: str) -> tuple[str, str]:
    # arn:aws:execute-api:region:account:api-id/stage/VERB/resource/path
    arn_parts = method_arn.split(":", 5)
    if len(arn_parts) != 6:
        raise ValueError("Invalid API Gateway method ARN")
    resource_parts = arn_parts[5].split("/", 3)
    if len(resource_parts) < 3:
        raise ValueError("Invalid API Gateway method ARN")
    method = resource_parts[2].upper()
    path = "/" + resource_parts[3] if len(resource_parts) == 4 else "/"
    return method, path


def _requires_admin(method: str, path: str) -> bool:
    normalized = path.rstrip("/") or "/"
    return normalized == "/admin" or normalized.startswith("/admin/") or (
        normalized == "/cool-spots" and method == "POST"
    )


def _policy(principal_id: str, effect: str, resource: str, context: dict | None = None) -> dict:
    result = {
        "principalId": principal_id,
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [{
                "Action": "execute-api:Invoke",
                "Effect": effect,
                "Resource": resource,
            }],
        },
    }
    if context:
        result["context"] = context
    return result


def lambda_handler(event, context):
    token_value = event.get("authorizationToken") or ""
    method_arn = event.get("methodArn") or ""
    scheme, _, token = token_value.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise Exception("Unauthorized")

    try:
        config = get_auth_config()
        secret = get_parameter_value(config["jwt_secret_parameter"], config["region"])
        claims = decode_access_token(
            token,
            secret=secret,
            issuer=str(config["jwt_issuer"]),
            audience=str(config["jwt_audience"]),
        )
        method, path = _method_and_path(method_arn)
    except Exception:
        # API Gateway interprets this exact response as an authentication failure.
        raise Exception("Unauthorized")

    role = str(claims["role"])
    if _requires_admin(method, path) and role != "admin":
        return _policy(str(claims["sub"]), "Deny", method_arn)

    return _policy(
        str(claims["sub"]),
        "Allow",
        method_arn,
        {
            "user_id": str(claims["sub"]),
            "email": str(claims["email"]),
            "role": role,
            "session_id": str(claims["sid"]),
        },
    )
