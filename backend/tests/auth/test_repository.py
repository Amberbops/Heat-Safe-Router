from backend.shared.auth.repository import AuthRepository, SESSION_TABLE_KEY


class FakeTable:
    def __init__(self):
        self.calls = []
        self.response = {"Item": {"session_id": "sid-1", "email": "test@example.invalid"}}

    def put_item(self, **kwargs):
        self.calls.append(("put_item", kwargs))

    def get_item(self, **kwargs):
        self.calls.append(("get_item", kwargs))
        return self.response

    def update_item(self, **kwargs):
        self.calls.append(("update_item", kwargs))


def test_create_session_maps_model_key_to_actual_table_key():
    sessions = FakeTable()
    repo = AuthRepository(FakeTable(), sessions)
    repo.create_session({"session_id": "sid-1", "user_id": "user-1", "revoked": False})

    operation, kwargs = sessions.calls[-1]
    assert operation == "put_item"
    assert kwargs["Item"]["session_Id"] == "sid-1"
    assert kwargs["Item"]["session_id"] == "sid-1"
    assert kwargs["ConditionExpression"] == "attribute_not_exists(session_Id)"


def test_get_session_uses_actual_table_key():
    sessions = FakeTable()
    repo = AuthRepository(FakeTable(), sessions)
    repo.get_session("sid-1")

    operation, kwargs = sessions.calls[-1]
    assert operation == "get_item"
    assert kwargs["Key"] == {SESSION_TABLE_KEY: "sid-1"}


def test_rotate_session_uses_actual_table_key():
    sessions = FakeTable()
    repo = AuthRepository(FakeTable(), sessions)
    repo.rotate_session(
        session_id="sid-1", old_hash="old", new_hash="new",
        expires_at=200, now_epoch=100, now_iso="2026-11-03T00:00:00+00:00",
    )

    operation, kwargs = sessions.calls[-1]
    assert operation == "update_item"
    assert kwargs["Key"] == {SESSION_TABLE_KEY: "sid-1"}


def test_link_amazon_account_guards_amazon_user_id():
    users = FakeTable()
    users.response = {"Attributes": {"email": "a@b.com", "amazon_user_id": "amzn1.account.1"}}
    users.update_item = lambda **kwargs: (users.calls.append(("update_item", kwargs)), users.response)[1]
    repo = AuthRepository(users, FakeTable())
    updated = repo.link_amazon_account(
        email="a@b.com",
        amazon_user_id="amzn1.account.1",
        name="Alice",
        auth_provider="amazon",
        now_iso="2026-11-11T00:00:00+00:00",
    )

    assert updated["amazon_user_id"] == "amzn1.account.1"
    operation, kwargs = users.calls[-1]
    assert operation == "update_item"
    assert kwargs["Key"] == {"email": "a@b.com"}
    assert "attribute_not_exists(amazon_user_id) OR amazon_user_id = :az" in kwargs["ConditionExpression"]


def test_revoke_session_uses_actual_table_key():
    sessions = FakeTable()
    repo = AuthRepository(FakeTable(), sessions)
    assert repo.revoke_session(
        session_id="sid-1", token_hash="digest", now_iso="2026-11-03T00:00:00+00:00"
    ) is True

    operation, kwargs = sessions.calls[-1]
    assert operation == "update_item"
    assert kwargs["Key"] == {SESSION_TABLE_KEY: "sid-1"}


def test_link_amazon_account_guards_amazon_user_id():
    users = FakeTable()
    users.response = {"Attributes": {"email": "a@b.com", "amazon_user_id": "amzn1.account.1"}}
    users.update_item = lambda **kwargs: (users.calls.append(("update_item", kwargs)), users.response)[1]
    repo = AuthRepository(users, FakeTable())
    updated = repo.link_amazon_account(
        email="a@b.com",
        amazon_user_id="amzn1.account.1",
        name="Alice",
        auth_provider="amazon",
        now_iso="2026-11-11T00:00:00+00:00",
    )

    assert updated["amazon_user_id"] == "amzn1.account.1"
    operation, kwargs = users.calls[-1]
    assert operation == "update_item"
    assert kwargs["Key"] == {"email": "a@b.com"}
    assert "attribute_not_exists(amazon_user_id) OR amazon_user_id = :az" in kwargs["ConditionExpression"]
