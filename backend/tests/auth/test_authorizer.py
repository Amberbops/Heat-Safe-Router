from backend.functions.authorizer.lambda_function import _method_and_path, _requires_admin, _policy


def test_method_arn_parser():
    arn = "arn:aws:execute-api:us-east-1:123456789012:abc123/dev/PATCH/admin/cool-spots/requests/req-1"
    assert _method_and_path(arn) == ("PATCH", "/admin/cool-spots/requests/req-1")


def test_admin_routes_require_admin_role():
    assert _requires_admin("GET", "/admin/cool-spots")
    assert _requires_admin("PATCH", "/admin/cool-spots/requests/id-1")
    assert _requires_admin("POST", "/cool-spots")
    assert not _requires_admin("GET", "/cool-spots")
    assert not _requires_admin("POST", "/cool-spots/requests")


def test_policy_is_scoped_to_exact_method_arn():
    arn = "arn:aws:execute-api:us-east-1:123456789012:abc123/dev/GET/admin/cool-spots"
    policy = _policy("user-1", "Allow", arn, {"role": "admin"})
    assert policy["policyDocument"]["Statement"][0]["Resource"] == arn
    assert policy["context"]["role"] == "admin"


def test_authorizer_allows_admin_and_denies_regular_user(monkeypatch):
    import time
    from backend.functions.authorizer import lambda_function as authorizer
    from backend.shared.auth.tokens import issue_access_token

    config = {
        "region": "us-east-1",
        "jwt_secret_parameter": "/heatsafe/test/jwt-secret",
        "jwt_issuer": "https://test.heatsafe.invalid",
        "jwt_audience": "heatsafe-tests",
    }
    secret = "local-authorizer-test-secret-with-over-32-bytes"
    monkeypatch.setattr(authorizer, "get_auth_config", lambda: config)
    monkeypatch.setattr(authorizer, "get_parameter_value", lambda *args: secret)

    common = {
        "user_id": "u-1",
        "email": "admin@example.test",
        "session_id": "f54d3cb9-87c9-4a1e-b2da-c31bc488a25d",
        "secret": secret,
        "issuer": config["jwt_issuer"],
        "audience": config["jwt_audience"],
        "ttl_seconds": 300,
        "now": int(time.time()),
    }
    method_arn = "arn:aws:execute-api:us-east-1:123456789012:abc123/dev/POST/admin/cool-spots"
    user_token = issue_access_token(**common, role="user")
    admin_token = issue_access_token(**common, role="admin")

    denied = authorizer.lambda_handler({
        "type": "TOKEN", "authorizationToken": f"Bearer {user_token}", "methodArn": method_arn,
    }, None)
    assert denied["policyDocument"]["Statement"][0]["Effect"] == "Deny"

    allowed = authorizer.lambda_handler({
        "type": "TOKEN", "authorizationToken": f"Bearer {admin_token}", "methodArn": method_arn,
    }, None)
    assert allowed["policyDocument"]["Statement"][0]["Effect"] == "Allow"
    assert allowed["context"]["role"] == "admin"
    assert allowed["context"]["user_id"] == "u-1"
