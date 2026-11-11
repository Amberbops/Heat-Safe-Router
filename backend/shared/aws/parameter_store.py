"""Cached AWS Systems Manager Parameter Store SecureString retrieval."""
from __future__ import annotations

import os
from functools import lru_cache

import boto3


@lru_cache(maxsize=8)
def get_parameter_value(
    parameter_name: str,
    region_name: str | None = None,
    min_bytes: int = 32,
) -> str:
    """Retrieve and cache a decrypted SecureString parameter.

    The Lambda execution role needs ssm:GetParameter on this parameter.
    With the AWS-managed aws/ssm key, Parameter Store/KMS performs decryption
    on behalf of the caller. Standard-tier parameters are limited to 4 KB.
    """
    name = str(parameter_name or "").strip()
    if not name.startswith("/"):
        raise RuntimeError("JWT signing parameter name must be an absolute Parameter Store path")

    region = region_name or os.environ.get("AWS_REGION", "us-east-1")
    response = boto3.client("ssm", region_name=region).get_parameter(
        Name=name,
        WithDecryption=True,
    )
    parameter = response.get("Parameter") or {}
    value = parameter.get("Value")
    if not isinstance(value, str) or len(value.encode("utf-8")) < min_bytes:
        if min_bytes >= 32:
            raise RuntimeError("JWT signing parameter must contain at least 32 UTF-8 bytes")
        raise RuntimeError(f"Parameter {name} value is missing or empty")
    return value
