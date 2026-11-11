"""Configuration for the dedicated Cool Spots Lambda."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class CoolSpotsSettings:
    region: str
    spots_table_name: str
    spots_city_index_name: str
    requests_table_name: str
    media_bucket_name: str
    allowed_origins: tuple[str, ...]
    max_image_bytes: int


def get_settings() -> CoolSpotsSettings:
    origins = tuple(
        origin.strip()
        for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )
    try:
        max_image_bytes = int(os.environ.get("COOL_SPOTS_MAX_IMAGE_BYTES", str(5 * 1024 * 1024)))
    except ValueError as exc:
        raise RuntimeError("COOL_SPOTS_MAX_IMAGE_BYTES must be an integer") from exc
    if max_image_bytes < 1 or max_image_bytes > 10 * 1024 * 1024:
        raise RuntimeError("COOL_SPOTS_MAX_IMAGE_BYTES must be between 1 and 10485760")
    return CoolSpotsSettings(
        region=os.environ.get("AWS_REGION", "us-east-1"),
        spots_table_name=os.environ.get("COOL_SPOTS_TABLE_NAME", "HeatSafe_CoolSpots"),
        spots_city_index_name=os.environ.get("COOL_SPOTS_CITY_INDEX_NAME", "CityIndex"),
        requests_table_name=os.environ.get("SPOT_REQUESTS_TABLE_NAME", "HeatSafe_SpotRequests"),
        media_bucket_name=os.environ.get("MEDIA_BUCKET_NAME", "heatsafe-coolspots-media"),
        allowed_origins=origins,
        max_image_bytes=max_image_bytes,
    )
