from __future__ import annotations

import base64

import pytest

from backend.functions.cool_spots.services.media_service import MediaService, MediaValidationError


class FakeS3:
    def __init__(self):
        self.calls = []

    def put_object(self, **kwargs):
        self.calls.append(kwargs)


def test_uploads_valid_png_data_uri():
    s3 = FakeS3()
    # PNG signature followed by harmless fixture bytes; this is a unit test of signature/flow,
    # not an image decoder validation test.
    png = b"\x89PNG\r\n\x1a\n" + b"fixture"
    data_uri = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
    service = MediaService(s3, "heatsafe-coolspots-media", "us-east-1", 1024)
    url = service.resolve_image(data_uri, "verified_spots")
    assert url.startswith("https://heatsafe-coolspots-media.s3.us-east-1.amazonaws.com/verified_spots/")
    assert s3.calls[0]["ContentType"] == "image/png"
    assert s3.calls[0]["ServerSideEncryption"] == "AES256"


def test_rejects_svg_data_uri():
    service = MediaService(FakeS3(), "bucket", "us-east-1", 1024)
    with pytest.raises(MediaValidationError):
        service.resolve_image("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "spots")


def test_rejects_mime_signature_mismatch():
    service = MediaService(FakeS3(), "bucket", "us-east-1", 1024)
    jpeg_bytes = b"\xff\xd8\xff\xd9"
    data_uri = "data:image/png;base64," + base64.b64encode(jpeg_bytes).decode("ascii")
    with pytest.raises(MediaValidationError):
        service.resolve_image(data_uri, "spots")


def test_rejects_oversized_image():
    service = MediaService(FakeS3(), "bucket", "us-east-1", 8)
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"too large"
    data_uri = "data:image/png;base64," + base64.b64encode(png_bytes).decode("ascii")
    with pytest.raises(MediaValidationError):
        service.resolve_image(data_uri, "spots")


def test_accepts_https_image_url_without_upload():
    s3 = FakeS3()
    service = MediaService(s3, "bucket", "us-east-1", 1024)
    url = "https://images.example/photo.png"
    assert service.resolve_image(url, "spots") == url
    assert s3.calls == []
