import json
import time

import pytest

from backend.functions.auth import lambda_function as auth


SECRET = "local-auth-test-signing-secret-with-32-bytes-plus"
CONFIG = {
    "region": "us-east-1",
    "users_table": "HeatSafe_Users",
    "sessions_table": "HeatSafe_Sessions",
    "jwt_secret_parameter": "/heatsafe/test/jwt-secret",
    "jwt_issuer": "https://test.heatsafe.invalid",
    "jwt_audience": "heatsafe-tests",
    "access_token_ttl_seconds": 300,
    "refresh_token_ttl_seconds": 3600,
    "allowed_origins": "http://localhost:5173",
    "amazon_client_id": "amzn1.application-oa2-client.test",
    "amazon_client_secret_parameter": "",
    "amazon_allowed_redirect_uris": ["http://localhost:5173/", "http://localhost:5173"],
    "otp_ttl_seconds": 600,
    "otp_resend_cooldown_seconds": 60,
    "otp_max_attempts": 5,
    "otp_sender_email": "sender@example.invalid",
    "otp_require_for_amazon": False,
}


class FakeRepository:
    def __init__(self):
        self.users = {}
        self.sessions = {}

    def create_user(self, item):
        if item["email"] in self.users:
            raise auth.DuplicateUserError
        self.users[item["email"]] = dict(item)

    def get_user(self, email):
        item = self.users.get(email)
        return dict(item) if item else None

    def link_amazon_account(
        self, *, email, amazon_user_id, name, auth_provider, now_iso, default_user_id=None
    ):
        item = self.users.get(email)
        if not item:
            raise AssertionError("Missing user for link_amazon_account")
        if item.get("amazon_user_id") and item["amazon_user_id"] != amazon_user_id:
            raise PermissionError("Amazon account mismatch for existing email")
        item.update(
            amazon_user_id=amazon_user_id,
            name=name,
            auth_provider=auth_provider,
            updated_at=now_iso,
        )
        if not item.get("user_id") and default_user_id:
            item["user_id"] = default_user_id
        item.setdefault("status", "active")
        item.setdefault("role", "user")
        item["email_verified"] = True
        return dict(item)

    def set_user_otp(self, *, email, otp_hash, otp_purpose, otp_expires_at, otp_sent_at, now_iso):
        item = self.users[email]
        item.update(
            otp_hash=otp_hash,
            otp_purpose=otp_purpose,
            otp_expires_at=otp_expires_at,
            otp_sent_at=otp_sent_at,
            otp_attempts=0,
            updated_at=now_iso,
        )

    def increment_otp_attempts(self, *, email, now_iso):
        item = self.users[email]
        item["otp_attempts"] = int(item.get("otp_attempts", 0)) + 1
        item["updated_at"] = now_iso
        return item["otp_attempts"]

    def mark_otp_verified(self, *, email, now_iso):
        item = self.users[email]
        item["email_verified"] = True
        item["updated_at"] = now_iso
        for field in ("otp_hash", "otp_purpose", "otp_expires_at", "otp_attempts"):
            item.pop(field, None)
        return dict(item)

    def create_session(self, item):
        self.sessions[item["session_id"]] = dict(item)

    def get_session(self, session_id):
        item = self.sessions.get(session_id)
        return dict(item) if item else None

    def rotate_session(self, *, session_id, old_hash, new_hash, expires_at, now_epoch, now_iso):
        item = self.sessions[session_id]
        if item["refresh_token_hash"] != old_hash or item["revoked"] or item["expires_at"] <= now_epoch:
            raise auth.InvalidSessionError
        item.update(refresh_token_hash=new_hash, expires_at=expires_at, ttl=expires_at, updated_at=now_iso)

    def revoke_session(self, *, session_id, token_hash, now_iso):
        item = self.sessions.get(session_id)
        if not item or item["refresh_token_hash"] != token_hash or item["revoked"]:
            return False
        item.update(revoked=True, revoked_at=now_iso)
        return True


def _event(method, path, body=None, headers=None):
    return {
        "httpMethod": method,
        "path": path,
        "headers": headers or {"Origin": "http://localhost:5173"},
        "body": json.dumps(body or {}),
    }


def _response(result):
    return result["statusCode"], json.loads(result["body"])


def test_registration_cannot_assign_admin_and_login_me_refresh_logout(monkeypatch):
    repository = FakeRepository()
    sent_otps = []
    monkeypatch.setattr(auth, "_dependencies", lambda: (CONFIG, repository, SECRET))
    monkeypatch.setattr(
        auth,
        "send_otp_email",
        lambda *, recipient_email, otp_code, purpose, config, ttl_minutes=10: sent_otps.append(
            (recipient_email, otp_code, purpose)
        ),
    )

    status, registration = _response(auth.lambda_handler(_event("POST", "/auth/register", {
        "email": "Person@Example.test",
        "password": "Correct-Horse-Battery-42",
        "role": "admin",
        "is_admin": True,
    }), None))
    assert status == 201
    assert registration["requires_2fa"] is True
    assert registration["user"]["role"] == "user"
    assert repository.users["person@example.test"]["role"] == "user"
    assert repository.users["person@example.test"]["email_verified"] is False
    assert sent_otps[-1][0] == "person@example.test"
    assert sent_otps[-1][2] == "register"

    # Wrong 6-digit code fails and increments attempts
    status, bad_otp = _response(auth.lambda_handler(_event("POST", "/auth/verify-otp", {
        "email": "person@example.test",
        "otp_code": "000000" if sent_otps[-1][1] != "000000" else "999999",
        "challenge_token": registration["challenge_token"],
    }), None))
    assert status == 401
    assert "attempt(s) remaining" in bad_otp["error"]

    # Correct 6-digit code completes registration and issues HeatSafe tokens
    status, verified_reg = _response(auth.lambda_handler(_event("POST", "/auth/verify-otp", {
        "email": "person@example.test",
        "otp_code": sent_otps[-1][1],
        "challenge_token": registration["challenge_token"],
    }), None))
    assert status == 200
    assert verified_reg["access_token"]
    assert repository.users["person@example.test"]["email_verified"] is True

    # Password login requires 2FA 6-digit OTP too
    status, login_challenge = _response(auth.lambda_handler(_event("POST", "/auth/login", {
        "email": "person@example.test",
        "password": "Correct-Horse-Battery-42",
    }), None))
    assert status == 200
    assert login_challenge["requires_2fa"] is True
    assert "access_token" not in login_challenge
    assert sent_otps[-1][2] == "login"

    # Immediate resend hits 60s cooldown
    status, rate_limited = _response(auth.lambda_handler(_event("POST", "/auth/resend-otp", {
        "email": "person@example.test",
        "challenge_token": login_challenge["challenge_token"],
    }), None))
    assert status == 429

    status, login = _response(auth.lambda_handler(_event("POST", "/auth/verify-otp", {
        "email": "person@example.test",
        "otp_code": sent_otps[-1][1],
        "challenge_token": login_challenge["challenge_token"],
    }), None))
    assert status == 200
    old_refresh = login["refresh_token"]
    access_token = login["access_token"]

    status, profile = _response(auth.lambda_handler(_event(
        "GET", "/auth/me", headers={
            "Origin": "http://localhost:5173",
            "Authorization": f"Bearer {access_token}",
        }
    ), None))
    assert status == 200
    assert profile["user"]["email"] == "person@example.test"

    status, refreshed = _response(auth.lambda_handler(_event("POST", "/auth/refresh", {
        "refresh_token": old_refresh,
    }), None))
    assert status == 200
    assert refreshed["refresh_token"] != old_refresh

    status, failed_replay = _response(auth.lambda_handler(_event("POST", "/auth/refresh", {
        "refresh_token": old_refresh,
    }), None))
    assert status == 401

    status, logout = _response(auth.lambda_handler(_event("POST", "/auth/logout", {
        "refresh_token": refreshed["refresh_token"],
    }), None))
    assert status == 200
    assert logout["logged_out"] is True

    status, failed_after_logout = _response(auth.lambda_handler(_event("POST", "/auth/refresh", {
        "refresh_token": refreshed["refresh_token"],
    }), None))
    assert status == 401


def test_login_error_is_generic_for_unknown_email(monkeypatch):
    repository = FakeRepository()
    monkeypatch.setattr(auth, "_dependencies", lambda: (CONFIG, repository, SECRET))
    status, body = _response(auth.lambda_handler(_event("POST", "/auth/login", {
        "email": "not-present@example.test",
        "password": "Correct-Horse-Battery-42",
    }), None))
    assert status == 401
    assert body["error"] == "Invalid credentials or session"


def test_me_rejects_invalid_bearer_token_as_unauthorized(monkeypatch):
    repository = FakeRepository()
    monkeypatch.setattr(auth, "_dependencies", lambda: (CONFIG, repository, SECRET))
    status, body = _response(auth.lambda_handler(_event(
        "GET", "/auth/me", headers={
            "Origin": "http://localhost:5173",
            "Authorization": "Bearer forged.token.value",
        }
    ), None))
    assert status == 401
    assert body["error"] == "Invalid credentials or session"


def test_amazon_login_registers_user_preserves_admin_role_and_links_local(monkeypatch):
    repository = FakeRepository()
    monkeypatch.setattr(auth, "_dependencies", lambda: (CONFIG, repository, SECRET))

    mocked_profiles = {
        "code-new": ("amzn1.account.NEW1", "Alice@Example.test", "Alice Walker"),
        "code-local": ("amzn1.account.LOC1", "local@example.test", "Local User"),
        "code-hijack": ("amzn1.account.OTHER", "local@example.test", "Attacker"),
    }

    def fake_exchange(*, code, redirect_uri, client_id, client_secret=None, code_verifier=None):
        assert redirect_uri == "http://localhost:5173/"
        assert client_id == CONFIG["amazon_client_id"]
        assert code_verifier == "pkce-verifier-123"
        return {"access_token": f"az-token-{code}"}

    def fake_verify(*, access_token, expected_client_id):
        assert expected_client_id == CONFIG["amazon_client_id"]
        code = access_token.replace("az-token-", "")
        az_id, email, name = mocked_profiles[code]
        return {"user_id": az_id, "email": email.lower(), "name": name}

    monkeypatch.setattr(auth, "exchange_amazon_code", fake_exchange)
    monkeypatch.setattr(auth, "verify_amazon_token_and_fetch_profile", fake_verify)
    monkeypatch.setattr(auth, "send_otp_email", lambda **kwargs: None)

    # 1. First Amazon sign-in auto-registers user with role=user in DynamoDB
    status, az_res = _response(auth.lambda_handler(_event("POST", "/auth/amazon", {
        "code": "code-new",
        "redirect_uri": "http://localhost:5173/",
        "code_verifier": "pkce-verifier-123",
    }), None))
    assert status == 200
    assert az_res["user"]["email"] == "alice@example.test"
    assert az_res["user"]["role"] == "user"
    assert az_res["user"]["auth_provider"] == "amazon"
    assert len(repository.sessions) == 1

    # /auth/me works with the issued HeatSafe JWT
    status, me_res = _response(auth.lambda_handler(_event(
        "GET", "/auth/me", headers={
            "Origin": "http://localhost:5173",
            "Authorization": f"Bearer {az_res['access_token']}",
        }
    ), None))
    assert status == 200
    assert me_res["user"]["name"] == "Alice Walker"

    # 2. Promoting Amazon user in DynamoDB grants admin JWT on next sign-in
    repository.users["alice@example.test"]["role"] = "admin"
    status, az_admin = _response(auth.lambda_handler(_event("POST", "/auth/amazon", {
        "code": "code-new",
        "redirect_uri": "http://localhost:5173/",
        "code_verifier": "pkce-verifier-123",
    }), None))
    assert status == 200
    assert az_admin["user"]["role"] == "admin"

    # 3. Existing local password user links Amazon account cleanly without losing password_hash
    status, reg = _response(auth.lambda_handler(_event("POST", "/auth/register", {
        "email": "local@example.test",
        "password": "Correct-Horse-Battery-42",
    }), None))
    assert status == 201
    status, linked = _response(auth.lambda_handler(_event("POST", "/auth/amazon", {
        "code": "code-local",
        "redirect_uri": "http://localhost:5173/",
        "code_verifier": "pkce-verifier-123",
    }), None))
    assert status == 200
    assert linked["user"]["auth_provider"] == "local,amazon"
    assert "password_hash" in repository.users["local@example.test"]

    # 4. Different Amazon ID cannot hijack an already linked email
    status, hijack = _response(auth.lambda_handler(_event("POST", "/auth/amazon", {
        "code": "code-hijack",
        "redirect_uri": "http://localhost:5173/",
        "code_verifier": "pkce-verifier-123",
    }), None))
    assert status == 401
    assert "different Amazon account" in hijack["error"]


def test_amazon_login_supports_manual_dynamodb_row_without_status(monkeypatch):
    repository = FakeRepository()
    repository.users["manual-admin@example.test"] = {
        "email": "manual-admin@example.test",
        "role": "Admin",
    }
    monkeypatch.setattr(auth, "_dependencies", lambda: (CONFIG, repository, SECRET))
    monkeypatch.setattr(
        auth,
        "exchange_amazon_code",
        lambda **kwargs: {"access_token": "az-manual"},
    )
    monkeypatch.setattr(
        auth,
        "verify_amazon_token_and_fetch_profile",
        lambda **kwargs: {
            "user_id": "amzn1.account.MAN1",
            "email": "manual-admin@example.test",
            "name": "Manual Admin",
        },
    )

    status, body = _response(auth.lambda_handler(_event("POST", "/auth/amazon", {
        "code": "manual-code",
        "redirect_uri": "http://localhost:5173/",
        "code_verifier": "pkce-verifier-123",
    }), None))
    assert status == 200
    assert body["user"]["role"] == "admin"
    assert body["user"]["user_id"]


def test_amazon_login_rejects_unallowed_redirect_uri(monkeypatch):
    repository = FakeRepository()
    monkeypatch.setattr(auth, "_dependencies", lambda: (CONFIG, repository, SECRET))
    status, body = _response(auth.lambda_handler(_event("POST", "/auth/amazon", {
        "code": "some-code",
        "redirect_uri": "https://evil.example/callback",
        "code_verifier": "pkce-verifier-123",
    }), None))
    assert status == 400
    assert "redirect_uri" in body["error"]


def test_otp_lockout_and_admin_role_verification(monkeypatch):
    repository = FakeRepository()
    sent_otps = []
    monkeypatch.setattr(auth, "_dependencies", lambda: (CONFIG, repository, SECRET))
    monkeypatch.setattr(
        auth,
        "send_otp_email",
        lambda *, recipient_email, otp_code, purpose, **kwargs: sent_otps.append(
            (recipient_email, otp_code, purpose)
        ),
    )

    # Seed an admin user with password and unverified/verified state
    status, reg = _response(auth.lambda_handler(_event("POST", "/auth/register", {
        "email": "admin-2fa@example.test",
        "password": "Correct-Horse-Battery-42",
    }), None))
    assert status == 201
    repository.users["admin-2fa@example.test"]["role"] = "admin"

    # Exhaust 5 invalid attempts -> should lock out OTP
    challenge_token = reg["challenge_token"]
    for attempt in range(5):
        status, bad = _response(auth.lambda_handler(_event("POST", "/auth/verify-otp", {
            "email": "admin-2fa@example.test",
            "otp_code": "000000" if sent_otps[-1][1] != "000000" else "111111",
            "challenge_token": challenge_token,
        }), None))
        assert status == 401
        if attempt == 4:
            assert "Too many" in bad["error"]

    # Force expiry / resend after clearing otp_sent_at cooldown -> admin receives admin role after verify
    repository.users["admin-2fa@example.test"]["otp_sent_at"] = 0
    status, resent = _response(auth.lambda_handler(_event("POST", "/auth/resend-otp", {
        "email": "admin-2fa@example.test",
        "challenge_token": challenge_token,
    }), None))
    assert status == 200
    status, verified = _response(auth.lambda_handler(_event("POST", "/auth/verify-otp", {
        "email": "admin-2fa@example.test",
        "otp_code": sent_otps[-1][1],
        "challenge_token": resent["challenge_token"],
    }), None))
    assert status == 200
    assert verified["user"]["role"] == "admin"
    assert verified["access_token"]
