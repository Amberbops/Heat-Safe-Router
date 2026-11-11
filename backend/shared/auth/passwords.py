"""Password hashing and verification using Python's scrypt implementation."""
from __future__ import annotations

import base64
import hashlib
import hmac
import os


# scrypt parameters: N=2^15, r=8, p=1. Tune only after measuring Lambda memory/latency.
_SCRYPT_N = 1 << 15
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16
_DKLEN = 32
_MAXMEM = 64 * 1024 * 1024
_MAX_PASSWORD_LENGTH = 256


def validate_password(password: str) -> None:
    if not isinstance(password, str) or len(password) < 12:
        raise ValueError("Password must contain at least 12 characters")
    if len(password) > _MAX_PASSWORD_LENGTH:
        raise ValueError("Password is too long")


def hash_password(password: str) -> str:
    validate_password(password)
    salt = os.urandom(_SALT_BYTES)
    derived = hashlib.scrypt(
        password.encode("utf-8"), salt=salt,
        n=_SCRYPT_N, r=_SCRYPT_R, p=_SCRYPT_P, dklen=_DKLEN, maxmem=_MAXMEM,
    )
    encode = lambda value: base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${encode(salt)}${encode(derived)}"


def verify_password(password: str, encoded_hash: str) -> bool:
    if not isinstance(password, str) or len(password) > _MAX_PASSWORD_LENGTH:
        return False
    try:
        algorithm, n, r, p, salt_b64, digest_b64 = encoded_hash.split("$", 5)
        if algorithm != "scrypt":
            return False
        salt = _b64decode(salt_b64)
        expected = _b64decode(digest_b64)
        actual = hashlib.scrypt(
            password.encode("utf-8"), salt=salt,
            n=int(n), r=int(r), p=int(p), dklen=len(expected), maxmem=_MAXMEM,
        )
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError, UnicodeError, MemoryError):
        return False


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
