"""Input validation and data normalization for Cool Spots."""
from __future__ import annotations

import math
import re
from typing import Any


class ValidationError(ValueError):
    pass


_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_CITY_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
_ALLOWED_LOGOS = {
    "water_station", "tree_canopy", "shaded_stall", "ac_refuge", "hydration",
    "shaded_vendor", "canopy_park", "shaded_park", "cooling_shelter", "mist_zone",
    "transit_shade", "medical_aid",
}


def normalize_city(value: Any) -> str:
    city = str(value or "indore").strip().lower().replace(" ", "-")
    if not _CITY_RE.fullmatch(city):
        raise ValidationError("City must contain only lowercase letters, numbers and hyphens")
    return city


def _number(value: Any, field: str, minimum: float, maximum: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be a number") from exc
    if not math.isfinite(number) or number < minimum or number > maximum:
        raise ValidationError(f"{field} must be between {minimum} and {maximum}")
    return number


def coordinates(body: dict) -> tuple[float, float]:
    lat = _number(body.get("lat"), "lat", -90.0, 90.0)
    lon = _number(body.get("lon"), "lon", -180.0, 180.0)
    return lat, lon


def optional_email(value: Any) -> str:
    email = str(value or "").strip().lower()
    if email and (len(email) > 254 or not _EMAIL_RE.fullmatch(email)):
        raise ValidationError("user_email must be a valid email address")
    return email


def required_text(value: Any, field: str, maximum: int) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValidationError(f"{field} is required")
    if len(text) > maximum:
        raise ValidationError(f"{field} must be no longer than {maximum} characters")
    return text


def optional_text(value: Any, field: str, maximum: int, default: str = "") -> str:
    text = str(value or "").strip()
    if len(text) > maximum:
        raise ValidationError(f"{field} must be no longer than {maximum} characters")
    return text or default


def logo_id(value: Any) -> str:
    logo = str(value or "tree_canopy").strip()
    if logo not in _ALLOWED_LOGOS:
        raise ValidationError("suggested_logo/logo_id is not supported")
    return logo


def nonnegative_number(value: Any, field: str, default: float, maximum: float) -> float:
    if value is None or value == "":
        return default
    return _number(value, field, 0.0, maximum)


def nonnegative_integer(value: Any, field: str, default: int, maximum: int) -> int:
    if value is None or value == "":
        return default
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"{field} must be an integer") from exc
    if number < 0 or number > maximum:
        raise ValidationError(f"{field} must be between 0 and {maximum}")
    return number


def image_url_value(value: Any) -> str:
    image_url = str(value or "").strip()
    if not image_url:
        return ""
    if image_url.startswith("data:image/"):
        return image_url
    if image_url.startswith("https://"):
        return image_url
    raise ValidationError("image_url must be an HTTPS URL or an allowed image data URI")
