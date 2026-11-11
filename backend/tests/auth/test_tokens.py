import time

import jwt
import pytest

from backend.shared.auth.tokens import (
    create_refresh_token,
    decode_access_token,
    hash_refresh_secret,
    issue_access_token,
    parse_refresh_token,
)

SECRET = "local-test-secret-material-at-least-32-bytes-long"
ISSUER = "https://test.heatsafe.invalid"
AUDIENCE = "heatsafe-tests"


def _issue(**overrides):
    values = {
        "user_id": "user-123",
        "email": "person@example.test",
        "role": "user",
        "session_id": "f54d3cb9-87c9-4a1e-b2da-c31bc488a25d",
        "secret": SECRET,
        "issuer": ISSUER,
        "audience": AUDIENCE,
        "ttl_seconds": 300,
    }
    values.update(overrides)
    return issue_access_token(**values)


def test_access_token_round_trip_and_claims():
    token = _issue()
    claims = decode_access_token(token, secret=SECRET, issuer=ISSUER, audience=AUDIENCE)
    assert claims["sub"] == "user-123"
    assert claims["role"] == "user"
    assert claims["token_use"] == "access"


def test_access_token_rejects_wrong_secret():
    token = _issue()
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token, secret="wrong-secret-material-at-least-32-bytes", issuer=ISSUER, audience=AUDIENCE)


def test_access_token_rejects_wrong_audience():
    token = _issue()
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token, secret=SECRET, issuer=ISSUER, audience="other-api")


def test_access_token_rejects_expired_token():
    token = _issue(ttl_seconds=-1, now=int(time.time()) - 5)
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token, secret=SECRET, issuer=ISSUER, audience=AUDIENCE)


def test_refresh_token_secret_is_hashed_and_parsed():
    token, session_id, digest = create_refresh_token()
    parsed_id, parsed_digest = parse_refresh_token(token)
    assert parsed_id == session_id
    assert parsed_digest == digest
    assert digest == hash_refresh_secret(token.split(".", 1)[1])
    assert token.split(".", 1)[1] != digest


def test_refresh_token_rejects_malformed_value():
    with pytest.raises(ValueError):
        parse_refresh_token("not-a-valid-refresh-token")


def test_access_token_rejects_unrecognized_role():
    token = _issue(role="superadmin")
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(token, secret=SECRET, issuer=ISSUER, audience=AUDIENCE)
