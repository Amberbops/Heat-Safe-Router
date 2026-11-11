import pytest

from backend.shared.aws import parameter_store


class FakeSSM:
    def __init__(self, value):
        self.value = value
        self.request = None

    def get_parameter(self, **kwargs):
        self.request = kwargs
        return {"Parameter": {"Name": kwargs["Name"], "Type": "SecureString", "Value": self.value}}


def test_get_parameter_requests_decryption(monkeypatch):
    fake = FakeSSM("x" * 64)
    monkeypatch.setattr(parameter_store.boto3, "client", lambda service, region_name: fake)
    parameter_store.get_parameter_value.cache_clear()

    value = parameter_store.get_parameter_value("/heatsafe/auth/jwt-signing-key", "us-east-1")

    assert value == "x" * 64
    assert fake.request == {
        "Name": "/heatsafe/auth/jwt-signing-key",
        "WithDecryption": True,
    }
    parameter_store.get_parameter_value.cache_clear()


def test_parameter_name_must_be_absolute_path():
    parameter_store.get_parameter_value.cache_clear()
    with pytest.raises(RuntimeError, match="absolute Parameter Store path"):
        parameter_store.get_parameter_value("heatsafe/auth/jwt-signing-key", "us-east-1")


def test_signing_parameter_must_be_at_least_32_bytes(monkeypatch):
    fake = FakeSSM("short")
    monkeypatch.setattr(parameter_store.boto3, "client", lambda service, region_name: fake)
    parameter_store.get_parameter_value.cache_clear()
    with pytest.raises(RuntimeError, match="at least 32 UTF-8 bytes"):
        parameter_store.get_parameter_value("/heatsafe/auth/jwt-signing-key", "us-east-1")
    parameter_store.get_parameter_value.cache_clear()
