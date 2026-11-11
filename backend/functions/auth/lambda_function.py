"""Heat-Safe account and session API.

API Gateway REST proxy routes:
  POST /auth/register
  POST /auth/login
  POST /auth/verify-otp
  POST /auth/resend-otp
  POST /auth/amazon
  POST /auth/refresh
  POST /auth/logout
  GET  /auth/me

This Lambda does not decide admin permissions for business routes. Those are
protected by the separate API Gateway Lambda authorizer.
"""
from __future__ import annotations

import hmac
import re
import secrets
import time
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from backend.shared.auth.amazon_lwa import (
    AmazonAuthError,
    exchange_amazon_code,
    verify_amazon_token_and_fetch_profile,
)
from backend.shared.auth.config import get_auth_config
from backend.shared.auth.email_otp import OtpDeliveryError, send_otp_email
from backend.shared.auth.http import bearer_token, parse_json_body, response
from backend.shared.auth.passwords import hash_password, verify_password
from backend.shared.auth.repository import AuthRepository, DuplicateUserError, InvalidSessionError, utc_iso
from backend.shared.auth.tokens import (
    create_refresh_token,
    decode_access_token,
    decode_otp_challenge_token,
    hash_otp_code,
    hash_refresh_secret,
    issue_access_token,
    issue_otp_challenge_token,
    parse_refresh_token,
)
from backend.shared.aws.parameter_store import get_parameter_value

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_OTP_RE = re.compile(r"^\d{6}$")
# Fixed syntactically valid scrypt hash; never corresponds to an account.
_DUMMY_PASSWORD_HASH = "scrypt$32768$8$1$RCaB-VsXiJNDNks4h84zUQ$d5BwRU_J0h29LfdNXRXQeKAYm_Sh2Em8p-42APs3rs4"


def _dependencies():
    config = get_auth_config()
    dynamodb = boto3.resource("dynamodb", region_name=config["region"])
    repository = AuthRepository(
        dynamodb.Table(config["users_table"]),
        dynamodb.Table(config["sessions_table"]),
    )
    signing_secret = get_parameter_value(config["jwt_secret_parameter"], config["region"])
    return config, repository, signing_secret


def _issue_pair(user: dict, repository: AuthRepository, config: dict, secret: str, session_id: str | None = None) -> dict:
    now = int(time.time())
    refresh_ttl = int(config["refresh_token_ttl_seconds"])
    refresh_token, sid, refresh_hash = create_refresh_token(session_id)
    expires_at = now + refresh_ttl

    if session_id is None:
        repository.create_session({
            "session_id": sid,
            "user_id": user["user_id"],
            "email": user["email"],
            "refresh_token_hash": refresh_hash,
            "created_at": utc_iso(now),
            "updated_at": utc_iso(now),
            "expires_at": expires_at,
            "ttl": expires_at,
            "revoked": False,
        })

    access_token = issue_access_token(
        user_id=user["user_id"],
        email=user["email"],
        role=user["role"],
        session_id=sid,
        secret=secret,
        issuer=str(config["jwt_issuer"]),
        audience=str(config["jwt_audience"]),
        ttl_seconds=int(config["access_token_ttl_seconds"]),
        now=now,
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": int(config["access_token_ttl_seconds"]),
        "user": _public_user(user),
    }


def _public_user(user: dict) -> dict:
    result = {
        "user_id": str(user["user_id"]),
        "email": str(user["email"]),
        "role": str(user.get("role", "user")),
        "created_at": str(user.get("created_at", "")),
    }
    if user.get("name"):
        result["name"] = str(user["name"])
    if user.get("auth_provider"):
        result["auth_provider"] = str(user["auth_provider"])
    return result


def _decode_request_access_token(event: dict, config: dict, secret: str) -> dict:
    token = bearer_token(event)
    if not token:
        raise PermissionError("Authentication required")
    try:
        return decode_access_token(
            token,
            secret=secret,
            issuer=str(config["jwt_issuer"]),
            audience=str(config["jwt_audience"]),
        )
    except Exception as exc:
        raise PermissionError("Authentication required") from exc


class OtpVerificationError(PermissionError):
    """Raised when a 6-digit OTP verification or challenge fails."""


class OtpRateLimitError(Exception):
    """Raised when resend-otp is requested before cooldown elapses."""


def _start_otp_challenge(
    *,
    user: dict,
    purpose: str,
    repository: AuthRepository,
    config: dict,
    secret: str,
    persist_otp: bool = True,
) -> dict:
    now = int(time.time())
    otp_ttl = int(config.get("otp_ttl_seconds", 600))
    cooldown = int(config.get("otp_resend_cooldown_seconds", 60))
    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    email = str(user["email"]).strip().lower()
    otp_hash = hash_otp_code(email, otp_code, secret)
    expires_at = now + otp_ttl

    if persist_otp:
        repository.set_user_otp(
            email=email,
            otp_hash=otp_hash,
            otp_purpose=purpose,
            otp_expires_at=expires_at,
            otp_sent_at=now,
            now_iso=utc_iso(now),
        )
    else:
        user["otp_hash"] = otp_hash
        user["otp_purpose"] = purpose
        user["otp_expires_at"] = expires_at
        user["otp_sent_at"] = now
        user["otp_attempts"] = 0

    send_otp_email(
        recipient_email=email,
        otp_code=otp_code,
        purpose=purpose,
        config=config,
        ttl_minutes=max(1, otp_ttl // 60),
    )

    challenge_token = issue_otp_challenge_token(
        user_id=str(user["user_id"]),
        email=email,
        purpose=purpose,
        secret=secret,
        issuer=str(config["jwt_issuer"]),
        audience=str(config["jwt_audience"]),
        ttl_seconds=otp_ttl,
        now=now,
    )
    return {
        "requires_2fa": True,
        "purpose": purpose,
        "email": email,
        "challenge_token": challenge_token,
        "expires_in": otp_ttl,
        "cooldown_seconds": cooldown,
        "message": f"A 6-digit verification code has been sent to {email}.",
    }


def _register(body: dict, repository: AuthRepository, config: dict, secret: str) -> dict:
    email = str(body.get("email", "")).strip().lower()
    password = body.get("password")
    if not _EMAIL_RE.match(email) or len(email) > 254:
        raise ValueError("A valid email address is required")
    if not isinstance(password, str):
        raise ValueError("A password is required")

    now = int(time.time())
    otp_ttl = int(config.get("otp_ttl_seconds", 600))
    cooldown = int(config.get("otp_resend_cooldown_seconds", 60))
    otp_code = f"{secrets.randbelow(1_000_000):06d}"
    otp_hash = hash_otp_code(email, otp_code, secret)

    user = {
        "user_id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(password),
        "auth_provider": "local",
        "email_verified": False,
        "role": "user",  # Public registration can never assign admin.
        "status": "active",
        "otp_hash": otp_hash,
        "otp_purpose": "register",
        "otp_expires_at": now + otp_ttl,
        "otp_sent_at": now,
        "otp_attempts": 0,
        "created_at": utc_iso(now),
    }
    try:
        repository.create_user(user)
    except DuplicateUserError:
        existing = repository.get_user(email)
        if (
            existing
            and existing.get("email_verified") is False
            and verify_password(password, str(existing.get("password_hash") or ""))
        ):
            return _start_otp_challenge(
                user=existing,
                purpose="register",
                repository=repository,
                config=config,
                secret=secret,
            )
        raise

    send_otp_email(
        recipient_email=email,
        otp_code=otp_code,
        purpose="register",
        config=config,
        ttl_minutes=max(1, otp_ttl // 60),
    )
    challenge_token = issue_otp_challenge_token(
        user_id=user["user_id"],
        email=email,
        purpose="register",
        secret=secret,
        issuer=str(config["jwt_issuer"]),
        audience=str(config["jwt_audience"]),
        ttl_seconds=otp_ttl,
        now=now,
    )
    return {
        "requires_2fa": True,
        "purpose": "register",
        "email": email,
        "challenge_token": challenge_token,
        "expires_in": otp_ttl,
        "cooldown_seconds": cooldown,
        "user": _public_user(user),
        "message": f"A 6-digit verification code has been sent to {email}.",
    }


def _merge_auth_provider(existing: dict) -> str:
    current = str(existing.get("auth_provider") or "").strip()
    if current == "local,amazon" or existing.get("password_hash") or "local" in current:
        return "local,amazon"
    return "amazon"


def _amazon_login(body: dict, repository: AuthRepository, config: dict, secret: str) -> dict:
    code = body.get("code")
    redirect_uri = str(body.get("redirect_uri") or "").strip()
    code_verifier = body.get("code_verifier")

    if not isinstance(code, str) or not code.strip() or len(code) > 2048:
        raise ValueError("A valid Amazon authorization code is required")

    allowed_redirects = config.get("amazon_allowed_redirect_uris") or []
    if not redirect_uri or redirect_uri not in allowed_redirects:
        raise ValueError("Invalid redirect_uri for Amazon login")

    if code_verifier is not None and (not isinstance(code_verifier, str) or not code_verifier.strip()):
        raise ValueError("Invalid code_verifier")

    client_id = str(config.get("amazon_client_id") or "").strip()
    if not client_id:
        raise RuntimeError("AMAZON_CLIENT_ID is not configured")

    client_secret: str | None = None
    secret_param = str(config.get("amazon_client_secret_parameter") or "").strip()
    if secret_param:
        client_secret = get_parameter_value(secret_param, str(config["region"]), min_bytes=1)

    verifier_str = code_verifier.strip() if isinstance(code_verifier, str) else None
    if not client_secret and not verifier_str:
        raise RuntimeError("Amazon authentication requires client secret parameter or code_verifier")

    token_data = exchange_amazon_code(
        code=code.strip(),
        redirect_uri=redirect_uri,
        client_id=client_id,
        client_secret=client_secret,
        code_verifier=verifier_str,
    )
    profile = verify_amazon_token_and_fetch_profile(
        access_token=token_data["access_token"],
        expected_client_id=client_id,
    )

    email = profile["email"]
    if not _EMAIL_RE.match(email) or len(email) > 254:
        raise AmazonAuthError("Amazon account did not provide a valid email address")

    amazon_user_id = profile["user_id"]
    name = profile["name"]
    now_iso = datetime.now(timezone.utc).isoformat()

    existing = repository.get_user(email)
    if existing is None:
        user = {
            "user_id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "auth_provider": "amazon",
            "amazon_user_id": amazon_user_id,
            "email_verified": True,
            "role": "user",  # Public registration can never assign admin.
            "status": "active",
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        try:
            repository.create_user(user)
        except DuplicateUserError:
            existing = repository.get_user(email)
        else:
            if config.get("otp_require_for_amazon"):
                return _start_otp_challenge(
                    user=user,
                    purpose="amazon",
                    repository=repository,
                    config=config,
                    secret=secret,
                )
            return _issue_pair(user, repository, config, secret)

    if not existing:
        raise AmazonAuthError("Unable to load user record")

    raw_status = existing.get("status")
    if raw_status is not None and str(raw_status).strip().lower() != "active":
        raise AmazonAuthError("Your HeatSafe account is disabled or inactive")

    normalized_role = str(existing.get("role") or "user").strip().lower()
    if normalized_role not in {"user", "admin"}:
        raise AmazonAuthError(
            f"Unsupported role '{normalized_role}' on user record; expected 'user' or 'admin'"
        )

    existing_az_id = existing.get("amazon_user_id")
    if existing_az_id and existing_az_id != amazon_user_id:
        raise AmazonAuthError("This email is already linked to a different Amazon account")

    merged_provider = _merge_auth_provider(existing)
    try:
        updated = repository.link_amazon_account(
            email=email,
            amazon_user_id=amazon_user_id,
            name=name,
            auth_provider=merged_provider,
            now_iso=now_iso,
            default_user_id=str(existing.get("user_id") or uuid.uuid4()),
        )
    except PermissionError as exc:
        raise AmazonAuthError("This email is already linked to a different Amazon account") from exc

    resolved_user = dict(updated or existing)
    resolved_user["role"] = str(resolved_user.get("role") or normalized_role).strip().lower()
    if resolved_user["role"] not in {"user", "admin"}:
        resolved_user["role"] = normalized_role

    if config.get("otp_require_for_amazon"):
        return _start_otp_challenge(
            user=resolved_user,
            purpose="amazon",
            repository=repository,
            config=config,
            secret=secret,
        )
    return _issue_pair(resolved_user, repository, config, secret)


def _login(body: dict, repository: AuthRepository, config: dict, secret: str) -> dict:
    email = str(body.get("email", "")).strip().lower()
    password = body.get("password")
    if not isinstance(password, str) or not password or len(password) > 256 or not email:
        raise PermissionError("Invalid email or password")

    user = repository.get_user(email)
    # Verify a fixed dummy hash for unknown emails to reduce obvious timing differences.
    dummy_hash = _DUMMY_PASSWORD_HASH
    stored_hash = (user or {}).get("password_hash") or dummy_hash
    valid_password = verify_password(password, stored_hash)
    if not user or not valid_password or user.get("status") != "active":
        raise PermissionError("Invalid email or password")
    if user.get("role") not in {"user", "admin"}:
        raise PermissionError("Invalid email or password")

    return _start_otp_challenge(
        user=user,
        purpose="login",
        repository=repository,
        config=config,
        secret=secret,
    )


def _verify_otp(body: dict, repository: AuthRepository, config: dict, secret: str) -> dict:
    email = str(body.get("email", "")).strip().lower()
    otp_code = re.sub(r"\s+", "", str(body.get("otp_code", "")))
    challenge_token = str(body.get("challenge_token") or "").strip()

    if not _EMAIL_RE.match(email):
        raise ValueError("A valid email address is required")
    if not _OTP_RE.fullmatch(otp_code):
        raise ValueError("Please enter the 6-digit verification code")
    if not challenge_token:
        raise OtpVerificationError("Verification session expired. Please sign in again.")

    try:
        claims = decode_otp_challenge_token(
            challenge_token,
            secret=secret,
            issuer=str(config["jwt_issuer"]),
            audience=str(config["jwt_audience"]),
        )
    except Exception as exc:
        raise OtpVerificationError("Verification session expired. Please sign in again.") from exc

    if str(claims.get("email", "")).lower() != email:
        raise OtpVerificationError("Email does not match verification session.")

    user = repository.get_user(email)
    if (
        not user
        or user.get("status") != "active"
        or user.get("role") not in {"user", "admin"}
        or user.get("user_id") != claims.get("sub")
    ):
        raise OtpVerificationError("Invalid verification session.")

    now = int(time.time())
    stored_hash = str(user.get("otp_hash") or "")
    expires_at = int(user.get("otp_expires_at") or 0)
    attempts = int(user.get("otp_attempts") or 0)
    max_attempts = int(config.get("otp_max_attempts", 5))

    if not stored_hash or expires_at <= now:
        raise OtpVerificationError("Verification code expired. Click Resend Code to get a new one.")
    if attempts >= max_attempts:
        raise OtpVerificationError("Too many incorrect attempts. Click Resend Code to get a new code.")

    expected_hash = hash_otp_code(email, otp_code, secret)
    if not hmac.compare_digest(expected_hash, stored_hash):
        new_attempts = repository.increment_otp_attempts(email=email, now_iso=utc_iso(now))
        remaining = max(0, max_attempts - new_attempts)
        if remaining == 0:
            raise OtpVerificationError("Too many incorrect attempts. Click Resend Code to get a new code.")
        raise OtpVerificationError(f"Incorrect 6-digit code ({remaining} attempt(s) remaining).")

    verified_user = repository.mark_otp_verified(email=email, now_iso=utc_iso(now))
    return _issue_pair(verified_user or user, repository, config, secret)


def _resend_otp(body: dict, repository: AuthRepository, config: dict, secret: str) -> dict:
    email = str(body.get("email", "")).strip().lower()
    challenge_token = str(body.get("challenge_token") or "").strip()

    if not _EMAIL_RE.match(email):
        raise ValueError("A valid email address is required")
    if not challenge_token:
        raise OtpVerificationError("Verification session expired. Please sign in again.")

    try:
        claims = decode_otp_challenge_token(
            challenge_token,
            secret=secret,
            issuer=str(config["jwt_issuer"]),
            audience=str(config["jwt_audience"]),
        )
    except Exception as exc:
        raise OtpVerificationError("Verification session expired. Please sign in again.") from exc

    if str(claims.get("email", "")).lower() != email:
        raise OtpVerificationError("Email does not match verification session.")

    user = repository.get_user(email)
    if not user or user.get("status") != "active" or user.get("user_id") != claims.get("sub"):
        raise OtpVerificationError("Invalid verification session.")

    now = int(time.time())
    cooldown = int(config.get("otp_resend_cooldown_seconds", 60))
    last_sent = int(user.get("otp_sent_at") or 0)
    elapsed = now - last_sent
    if last_sent and elapsed < cooldown:
        raise OtpRateLimitError(f"Please wait {cooldown - elapsed}s before requesting a new code.")

    return _start_otp_challenge(
        user=user,
        purpose=str(claims.get("purpose") or "login"),
        repository=repository,
        config=config,
        secret=secret,
    )


def _refresh(body: dict, repository: AuthRepository, config: dict, secret: str) -> dict:
    raw_token = body.get("refresh_token")
    try:
        session_id, old_hash = parse_refresh_token(raw_token)
    except ValueError as exc:
        raise InvalidSessionError from exc
    session = repository.get_session(session_id)
    now = int(time.time())
    if (
        not session
        or session.get("revoked") is not False
        or int(session.get("expires_at", 0)) <= now
        or session.get("refresh_token_hash") != old_hash
    ):
        raise InvalidSessionError

    user = repository.get_user(str(session.get("email", "")))
    if not user or user.get("status") != "active" or user.get("user_id") != session.get("user_id"):
        raise InvalidSessionError

    new_token, _, new_hash = create_refresh_token(session_id)
    new_expiry = now + int(config["refresh_token_ttl_seconds"])
    repository.rotate_session(
        session_id=session_id,
        old_hash=old_hash,
        new_hash=new_hash,
        expires_at=new_expiry,
        now_epoch=now,
        now_iso=utc_iso(now),
    )
    access_token = issue_access_token(
        user_id=user["user_id"],
        email=user["email"],
        role=user["role"],
        session_id=session_id,
        secret=secret,
        issuer=str(config["jwt_issuer"]),
        audience=str(config["jwt_audience"]),
        ttl_seconds=int(config["access_token_ttl_seconds"]),
        now=now,
    )
    return {
        "access_token": access_token,
        "refresh_token": new_token,
        "token_type": "Bearer",
        "expires_in": int(config["access_token_ttl_seconds"]),
        "user": _public_user(user),
    }


def lambda_handler(event, context):
    method = (event.get("httpMethod") or "").upper()
    path = event.get("path") or ""

    if method == "OPTIONS":
        return response(204, {}, event)

    route = (method, path.rstrip("/") or "/")
    try:
        config, repository, signing_secret = _dependencies()
        body = parse_json_body(event) if method == "POST" else {}

        if route == ("POST", "/auth/register"):
            try:
                result = _register(body, repository, config, signing_secret)
            except DuplicateUserError:
                return response(409, {"error": "An account with this email already exists. Sign in to verify or access your account."}, event)
            return response(201, result, event)

        if route == ("POST", "/auth/login"):
            return response(200, _login(body, repository, config, signing_secret), event)

        if route == ("POST", "/auth/verify-otp"):
            return response(200, _verify_otp(body, repository, config, signing_secret), event)

        if route == ("POST", "/auth/resend-otp"):
            return response(200, _resend_otp(body, repository, config, signing_secret), event)

        if route == ("POST", "/auth/amazon"):
            return response(200, _amazon_login(body, repository, config, signing_secret), event)

        if route == ("POST", "/auth/refresh"):
            return response(200, _refresh(body, repository, config, signing_secret), event)

        if route == ("POST", "/auth/logout"):
            try:
                session_id, token_hash = parse_refresh_token(body.get("refresh_token"))
            except ValueError as exc:
                raise InvalidSessionError from exc
            revoked = repository.revoke_session(
                session_id=session_id,
                token_hash=token_hash,
                now_iso=utc_iso(),
            )
            return response(200, {"logged_out": bool(revoked)}, event)

        if route == ("GET", "/auth/me"):
            claims = _decode_request_access_token(event, config, signing_secret)
            user = repository.get_user(str(claims["email"]))
            if not user or user.get("status") != "active" or user.get("user_id") != claims["sub"]:
                return response(401, {"error": "Authentication required"}, event)
            return response(200, {"user": _public_user(user)}, event)

        return response(404, {"error": "Route not found"}, event)

    except ValueError as exc:
        return response(400, {"error": str(exc)}, event)
    except OtpDeliveryError as exc:
        return response(502, {"error": str(exc)}, event)
    except OtpRateLimitError as exc:
        return response(429, {"error": str(exc)}, event)
    except OtpVerificationError as exc:
        return response(401, {"error": str(exc)}, event)
    except AmazonAuthError as exc:
        return response(401, {"error": str(exc)}, event)
    except PermissionError:
        # Deliberately generic to avoid confirming whether an account exists.
        return response(401, {"error": "Invalid credentials or session"}, event)
    except InvalidSessionError:
        return response(401, {"error": "Invalid credentials or session"}, event)
    except ClientError as exc:
        error = exc.response.get("Error", {})
        metadata = exc.response.get("ResponseMetadata", {})
        print(
            "Auth AWS ClientError:",
            f"code={error.get('Code', 'Unknown')}",
            f"message={error.get('Message', 'No message')}",
            f"http_status={metadata.get('HTTPStatusCode', 'Unknown')}",
            f"request_id={metadata.get('RequestId', 'Unknown')}",
        )
        return response(500, {"error": "Authentication service unavailable"}, event)
    except Exception as exc:
        print("Auth service error:", type(exc).__name__)
        return response(500, {"error": "Authentication service unavailable"}, event)
