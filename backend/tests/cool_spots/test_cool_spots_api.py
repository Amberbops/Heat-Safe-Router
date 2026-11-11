from __future__ import annotations

import json
from decimal import Decimal
from types import SimpleNamespace

import pytest

from backend.functions.cool_spots import lambda_function
from backend.functions.cool_spots.services.cool_spots_service import CoolSpotsService


class FakeMedia:
    def resolve_image(self, value: str, prefix: str) -> str:
        return f"https://media.example/{prefix}/uploaded.png" if value.startswith("data:") else value


class FakeRepository:
    def __init__(self):
        self.spots = []
        self.requests = []
        self.calls = []

    def list_spots(self, city):
        self.calls.append(("list_spots", city))
        return [dict(item) for item in self.spots if item["city"] == city]

    def get_spot(self, city, spot_id):
        self.calls.append(("get_spot", city, spot_id))
        return next((dict(x) for x in self.spots if x["city"] == city and x["spot_id"] == spot_id), None)

    def put_spot(self, item):
        self.calls.append(("put_spot", item["city"], item["spot_id"]))
        self.spots = [x for x in self.spots if not (x["city"] == item["city"] and x["spot_id"] == item["spot_id"])]
        self.spots.append(dict(item))

    def delete_spot(self, city, spot_id):
        self.calls.append(("delete_spot", city, spot_id))
        self.spots = [x for x in self.spots if not (x["city"] == city and x["spot_id"] == spot_id)]

    def create_request(self, item):
        self.calls.append(("create_request", item["request_id"]))
        self.requests.append(dict(item))

    def get_request(self, request_id):
        self.calls.append(("get_request", request_id))
        return next((dict(x) for x in self.requests if x["request_id"] == request_id), None)

    def list_requests(self):
        self.calls.append(("list_requests",))
        return [dict(x) for x in self.requests]

    def review_request(self, request_id, status, reviewer, reviewed_at, approved_spot):
        self.calls.append(("review_request", request_id, status, reviewer, approved_spot))
        item = next(x for x in self.requests if x["request_id"] == request_id)
        item["status"] = status
        item["reviewed_by"] = reviewer
        if approved_spot:
            self.put_spot(approved_spot)


def setup_api(monkeypatch):
    repository = FakeRepository()
    service = CoolSpotsService(repository, FakeMedia())
    settings = SimpleNamespace(allowed_origins=("http://localhost:5173",))
    monkeypatch.setattr(lambda_function, "_service", service)
    monkeypatch.setattr(lambda_function, "_settings", settings)
    return repository


def api_event(method, path, body=None, authorizer=None, path_parameters=None, query=None):
    return {
        "httpMethod": method,
        "path": path,
        "headers": {"Origin": "http://localhost:5173", "Content-Type": "application/json"},
        "body": json.dumps(body) if body is not None else None,
        "pathParameters": path_parameters or {},
        "queryStringParameters": query or {},
        "requestContext": {"authorizer": authorizer or {}},
    }


ADMIN = {"user_id": "admin-123", "email": "admin@example.com", "role": "admin", "session_id": "s-1"}
USER = {"user_id": "user-123", "email": "user@example.com", "role": "user", "session_id": "s-2"}


def response_body(response):
    return json.loads(response["body"])


def test_public_get_spots_is_read_only_and_returns_legacy_shape(monkeypatch):
    repository = setup_api(monkeypatch)
    repository.spots = [{"city": "indore", "spot_id": "s-1", "name": "Shade"}]

    result = lambda_function.lambda_handler(api_event("GET", "/cool-spots", query={"city": "indore"}), None)

    assert result["statusCode"] == 200
    body = response_body(result)
    assert body["city"] == "indore"
    assert body["count"] == 1
    assert body["spots"][0]["spot_id"] == "s-1"
    assert not any(call[0] in {"put_spot", "create_request", "review_request"} for call in repository.calls)


def test_public_nomination_ignores_client_controlled_status_and_request_id(monkeypatch):
    repository = setup_api(monkeypatch)
    event = api_event("POST", "/cool-spots/requests", authorizer=USER, body={
        "request_id": "caller-chosen-id",
        "status": "approved",
        "user_email": "attacker@example.com",
        "contact_email": "walker@example.com",
        "suggested_name": "Shaded public shelter",
        "message": "Water and shade",
        "lat": 22.72,
        "lon": 75.85,
        "suggested_logo": "tree_canopy",
        "spot_image_url": "",
    })

    result = lambda_function.lambda_handler(event, None)

    assert result["statusCode"] == 201
    request = response_body(result)["request"]
    assert request["request_id"] != "caller-chosen-id"
    assert request["status"] == "pending"
    assert request["user_email"] == USER["email"]
    assert request["submitter_user_id"] == USER["user_id"]
    assert request["contact_email"] == "walker@example.com"
    assert request["submitter_verified"] is True
    assert isinstance(request["lat"], float)
    assert repository.requests[0]["status"] == "pending"


def test_public_nomination_requires_verified_identity(monkeypatch):
    repository = setup_api(monkeypatch)
    result = lambda_function.lambda_handler(api_event(
        "POST", "/cool-spots/requests", body={"suggested_name": "No auth", "lat": 22.72, "lon": 75.85}
    ), None)
    assert result["statusCode"] == 401
    assert repository.requests == []


def test_public_nomination_requires_valid_coordinates(monkeypatch):
    repository = setup_api(monkeypatch)
    result = lambda_function.lambda_handler(api_event(
        "POST", "/cool-spots/requests", authorizer=USER,
        body={"suggested_name": "Bad coordinates", "lat": 200, "lon": 10},
    ), None)
    assert result["statusCode"] == 400
    assert repository.requests == []


def test_admin_request_queue_requires_verified_admin_context(monkeypatch):
    repository = setup_api(monkeypatch)

    no_identity = lambda_function.lambda_handler(api_event("GET", "/admin/cool-spots/requests"), None)
    user_identity = lambda_function.lambda_handler(api_event("GET", "/admin/cool-spots/requests", authorizer=USER), None)
    fake_bearer = api_event("GET", "/admin/cool-spots/requests")
    fake_bearer["headers"]["Authorization"] = "Bearer aws-cognito-mock-jwt-admin"
    mock_token = lambda_function.lambda_handler(fake_bearer, None)

    assert no_identity["statusCode"] == 403
    assert user_identity["statusCode"] == 403
    assert mock_token["statusCode"] == 403
    assert not any(call[0] == "list_requests" for call in repository.calls)


def test_admin_can_list_requests(monkeypatch):
    repository = setup_api(monkeypatch)
    repository.requests = [{"request_id": "r-1", "status": "pending"}]
    result = lambda_function.lambda_handler(api_event("GET", "/admin/cool-spots/requests", authorizer=ADMIN), None)
    assert result["statusCode"] == 200
    assert response_body(result)["count"] == 1


def test_admin_upsert_uses_verified_identity_and_composite_key(monkeypatch):
    repository = setup_api(monkeypatch)
    result = lambda_function.lambda_handler(api_event(
        "POST", "/admin/cool-spots", authorizer=ADMIN,
        body={
            "spot_id": "shade-1", "city": "indore", "name": "Verified Shade",
            "lat": 22.72, "lon": 75.85, "verified_by": "attacker@example.com",
        },
    ), None)
    assert result["statusCode"] == 200
    body = response_body(result)
    assert body["spot"]["verified_by"] == "admin@example.com"
    assert body["spot"]["city"] == "indore"
    assert body["spot"]["spot_id"] == "shade-1"
    assert repository.spots[0]["city"] == "indore"


def test_legacy_post_cool_spots_alias_is_admin_only(monkeypatch):
    setup_api(monkeypatch)
    body = {"spot_id": "shade-2", "city": "indore", "name": "Shade", "lat": 22.72, "lon": 75.85}
    denied = lambda_function.lambda_handler(api_event("POST", "/cool-spots", body=body), None)
    allowed = lambda_function.lambda_handler(api_event("POST", "/cool-spots", body=body, authorizer=ADMIN), None)
    assert denied["statusCode"] == 403
    assert allowed["statusCode"] == 200


def test_patch_approval_route_is_reachable_and_creates_spot(monkeypatch):
    repository = setup_api(monkeypatch)
    repository.requests = [{
        "request_id": "req-1", "city": "indore", "suggested_name": "Community Shade",
        "message": "Trees", "lat": Decimal("22.72"), "lon": Decimal("75.85"),
        "suggested_logo": "tree_canopy", "status": "pending", "user_email": "submitter@example.com",
    }]
    result = lambda_function.lambda_handler(api_event(
        "PATCH", "/admin/cool-spots/requests/req-1", authorizer=ADMIN,
        path_parameters={"id": "req-1"}, body={"status": "APPROVED"},
    ), None)

    assert result["statusCode"] == 200
    assert response_body(result)["status"] == "approved"
    assert repository.requests[0]["status"] == "approved"
    assert repository.spots[0]["spot_id"] == "req-1"
    assert repository.spots[0]["verified_by"] == "admin@example.com"


def test_patch_rejects_invalid_status(monkeypatch):
    setup_api(monkeypatch)
    result = lambda_function.lambda_handler(api_event(
        "PATCH", "/admin/cool-spots/requests/req-1", authorizer=ADMIN,
        path_parameters={"id": "req-1"}, body={"status": "admin"},
    ), None)
    assert result["statusCode"] == 400


def test_delete_uses_city_and_spot_id_key_from_greedy_proxy(monkeypatch):
    repository = setup_api(monkeypatch)
    repository.spots = [{"city": "indore", "spot_id": "shade-3", "name": "Shade"}]
    result = lambda_function.lambda_handler(api_event(
        "DELETE", "/admin/cool-spots/shade-3", authorizer=ADMIN,
        path_parameters={"proxy": "shade-3"}, query={"city": "indore"},
    ), None)
    assert result["statusCode"] == 200
    assert repository.spots == []
    assert ("delete_spot", "indore", "shade-3") in repository.calls


def test_options_and_unknown_route(monkeypatch):
    setup_api(monkeypatch)
    options = lambda_function.lambda_handler(api_event("OPTIONS", "/cool-spots"), None)
    unknown = lambda_function.lambda_handler(api_event("PUT", "/cool-spots"), None)
    assert options["statusCode"] == 204
    assert unknown["statusCode"] == 404


def test_disallowed_origin_does_not_receive_allow_origin_header(monkeypatch):
    setup_api(monkeypatch)
    event = api_event("GET", "/cool-spots")
    event["headers"]["Origin"] = "https://malicious.example"
    result = lambda_function.lambda_handler(event, None)
    assert "Access-Control-Allow-Origin" not in result["headers"]
