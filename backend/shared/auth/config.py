"""Configuration shared by the Heat-Safe auth API and API Gateway authorizer."""
from __future__ import annotations

import os


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_auth_config() -> dict[str, str | int | list[str]]:
    raw_redirects = os.environ.get(
        "AMAZON_ALLOWED_REDIRECT_URIS",
        "http://localhost:5173/,http://localhost:5173",
    )
    allowed_redirects = [item.strip() for item in raw_redirects.split(",") if item.strip()]
    return {
        "region": os.environ.get("AWS_REGION", "us-east-1"),
        "users_table": os.environ.get("AUTH_USERS_TABLE", "HeatSafe_Users"),
        "sessions_table": os.environ.get("AUTH_SESSIONS_TABLE", "HeatSafe_Sessions"),
        "jwt_secret_parameter": required_env("HEATSAFE_JWT_SECRET_PARAMETER"),
        "jwt_issuer": os.environ.get("HEATSAFE_JWT_ISSUER", "urn:heatsafe:route-planner:auth"),
        "jwt_audience": os.environ.get("HEATSAFE_JWT_AUDIENCE", "heatsafe-route-planner"),
        "access_token_ttl_seconds": int(os.environ.get("ACCESS_TOKEN_TTL_SECONDS", "600")),
        "refresh_token_ttl_seconds": int(os.environ.get("REFRESH_TOKEN_TTL_SECONDS", "2592000")),
        "allowed_origins": os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173"),
        "amazon_client_id": os.environ.get("AMAZON_CLIENT_ID", "").strip(),
        "amazon_client_secret_parameter": os.environ.get("AMAZON_CLIENT_SECRET_PARAMETER", "").strip(),
        "amazon_allowed_redirect_uris": allowed_redirects,
        "otp_ttl_seconds": int(os.environ.get("OTP_TTL_SECONDS", "600")),
        "otp_resend_cooldown_seconds": int(os.environ.get("OTP_RESEND_COOLDOWN_SECONDS", "60")),
        "otp_max_attempts": int(os.environ.get("OTP_MAX_ATTEMPTS", "5")),
        "otp_sender_email": os.environ.get("OTP_SENDER_EMAIL", "ambersaluja2006@gmail.com").strip(),
        "smtp_host": os.environ.get("SMTP_HOST", "smtp.gmail.com").strip(),
        "smtp_port": int(os.environ.get("SMTP_PORT", "465")),
        "smtp_user": os.environ.get("SMTP_USER", "").strip(),
        "smtp_password_parameter": os.environ.get("SMTP_PASSWORD_PARAMETER", "").strip(),
        "otp_require_for_amazon": os.environ.get("OTP_REQUIRE_FOR_AMAZON", "false").strip().lower() == "true",
    }
