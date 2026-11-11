"""Validated image upload handling for Cool Spots media."""
from __future__ import annotations

import base64
import binascii
import re
import uuid
from typing import Any


_DATA_URI_RE = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$", re.IGNORECASE)
_SIGNATURES = {
    "image/jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
    "image/png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
    "image/webp": lambda data: len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP",
}
_EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class MediaValidationError(ValueError):
    pass


class MediaService:
    def __init__(self, s3_client: Any, bucket_name: str, region: str, max_bytes: int):
        self.s3 = s3_client
        self.bucket = bucket_name
        self.region = region
        self.max_bytes = max_bytes

    def resolve_image(self, value: str, prefix: str) -> str:
        if not value:
            return ""
        if not value.startswith("data:"):
            if value.startswith("https://"):
                return value
            raise MediaValidationError("Only HTTPS image URLs are accepted")

        match = _DATA_URI_RE.fullmatch(value)
        if not match:
            raise MediaValidationError("Only base64 JPEG, PNG and WebP images are accepted")
        content_type, encoded = match.groups()
        try:
            image_bytes = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise MediaValidationError("Image data is not valid base64") from exc
        if not image_bytes:
            raise MediaValidationError("Image file is empty")
        if len(image_bytes) > self.max_bytes:
            raise MediaValidationError(f"Image exceeds the {self.max_bytes}-byte upload limit")
        if not _SIGNATURES[content_type.lower()](image_bytes):
            raise MediaValidationError("Image content does not match its declared MIME type")

        extension = _EXTENSIONS[content_type.lower()]
        key = f"{prefix.strip('/')}/{uuid.uuid4().hex}.{extension}"
        self.s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=image_bytes,
            ContentType=content_type.lower(),
            ServerSideEncryption="AES256",
        )
        return f"https://{self.bucket}.s3.{self.region}.amazonaws.com/{key}"
