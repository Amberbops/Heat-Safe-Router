"""Server-side Login with Amazon (LWA) OAuth 2.0 exchange and verification."""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request

LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token"
LWA_TOKENINFO_URL = "https://api.amazon.com/auth/o2/tokeninfo"
LWA_PROFILE_URL = "https://api.amazon.com/user/profile"


class AmazonAuthError(PermissionError):
    """Raised when Login with Amazon code exchange or verification fails."""


def _http_json(
    url: str,
    *,
    method: str = "GET",
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 10.0,
) -> dict:
    req = urllib.request.Request(
        url,
        data=data,
        headers=headers or {},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise AmazonAuthError("Unexpected response format from Amazon")
            return parsed
    except urllib.error.HTTPError as exc:
        detail = "Amazon authentication rejected"
        try:
            err_body = exc.read().decode("utf-8")
            err_json = json.loads(err_body)
            detail = err_json.get("error_description") or err_json.get("error") or detail
        except Exception:
            pass
        raise AmazonAuthError(detail) from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Unable to reach Amazon LWA service: {exc.reason}") from exc


def exchange_amazon_code(
    *,
    code: str,
    redirect_uri: str,
    client_id: str,
    client_secret: str | None = None,
    code_verifier: str | None = None,
) -> dict:
    """Exchange an LWA authorization code for an Amazon access token."""
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": client_id,
        "redirect_uri": redirect_uri,
    }
    if client_secret:
        payload["client_secret"] = client_secret
    if code_verifier:
        payload["code_verifier"] = code_verifier

    encoded = urllib.parse.urlencode(payload).encode("utf-8")
    token_data = _http_json(
        LWA_TOKEN_URL,
        method="POST",
        data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
    )
    if not token_data.get("access_token"):
        raise AmazonAuthError("Amazon token response missing access_token")
    return token_data


def verify_amazon_token_and_fetch_profile(
    *,
    access_token: str,
    expected_client_id: str,
) -> dict:
    """Verify the LWA token audience (aud) via tokeninfo and return the profile."""
    query = urllib.parse.urlencode({"access_token": access_token})
    token_info = _http_json(f"{LWA_TOKENINFO_URL}?{query}", method="GET")
    if token_info.get("aud") != expected_client_id:
        raise AmazonAuthError("Amazon access token audience mismatch")

    profile = _http_json(
        LWA_PROFILE_URL,
        method="GET",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    amazon_user_id = str(profile.get("user_id") or "").strip()
    email = str(profile.get("email") or "").strip().lower()
    name = str(profile.get("name") or "").strip()

    if not amazon_user_id or not email:
        raise AmazonAuthError("Amazon profile is missing user_id or email")
    token_uid = str(token_info.get("user_id") or "").strip()
    if token_uid and token_uid != amazon_user_id:
        raise AmazonAuthError("Amazon token user mismatch")

    return {
        "user_id": amazon_user_id,
        "email": email,
        "name": name or email.split("@")[0],
    }
