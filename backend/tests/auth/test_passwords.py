from backend.shared.auth.passwords import hash_password, validate_password, verify_password


def test_scrypt_password_round_trip():
    encoded = hash_password("Correct-Horse-Battery-42")
    assert encoded.startswith("scrypt$")
    assert verify_password("Correct-Horse-Battery-42", encoded)
    assert not verify_password("Incorrect-Horse-Battery-42", encoded)


def test_password_policy_rejects_short_password():
    try:
        validate_password("short")
    except ValueError as exc:
        assert "12 characters" in str(exc)
    else:
        raise AssertionError("Expected short password to be rejected")
