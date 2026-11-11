"""Business workflows for public Cool Spots and administrative review."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from backend.functions.cool_spots.repositories.cool_spots_repository import (
    CoolSpotsRepository,
    RequestAlreadyReviewedError,
)
from backend.functions.cool_spots.services.media_service import MediaService
from backend.functions.cool_spots.validation import (
    ValidationError,
    coordinates,
    image_url_value,
    logo_id,
    nonnegative_integer,
    nonnegative_number,
    normalize_city,
    optional_email,
    optional_text,
    required_text,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decimalize(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _decimalize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_decimalize(item) for item in value]
    return value


class CoolSpotsService:
    def __init__(self, repository: CoolSpotsRepository, media: MediaService):
        self.repository = repository
        self.media = media

    def list_spots(self, city_value: Any) -> dict:
        city = normalize_city(city_value)
        spots = self.repository.list_spots(city)
        return {"city": city, "spots": spots, "count": len(spots)}

    def submit_request(self, body: dict, submitter_identity: dict | None = None) -> dict:
        if not submitter_identity or submitter_identity.get("role") not in {"user", "admin"}:
            raise ValidationError("Verified user identity is required")

        city = normalize_city(body.get("city"))
        suggested_name = required_text(body.get("suggested_name"), "suggested_name", 120)
        lat, lon = coordinates(body)
        verified_email = str(submitter_identity.get("email") or "")
        verified_user_id = str(submitter_identity["user_id"])
        contact_email = optional_email(body.get("contact_email") or body.get("user_email"))
        message = optional_text(body.get("message"), "message", 2000)
        suggested_logo = logo_id(body.get("suggested_logo"))
        spot_image = image_url_value(body.get("spot_image_url"))
        if spot_image.startswith("data:"):
            spot_image = self.media.resolve_image(spot_image, "user_nominations")

        # request_id/status/created_at from the caller are deliberately ignored.
        request_item = {
            "request_id": f"req_{uuid.uuid4().hex}",
            "city": city,
            "user_email": verified_email or contact_email or "anonymous",
            "submitter_user_id": verified_user_id,
            "contact_email": contact_email,
            "submitter_verified": True,
            "suggested_name": suggested_name,
            "message": message,
            "lat": Decimal(str(lat)),
            "lon": Decimal(str(lon)),
            "suggested_logo": suggested_logo,
            "spot_image_url": spot_image,
            "status": "pending",
            "created_at": _now_iso(),
        }
        self.repository.create_request(request_item)
        return {"saved": True, "request_id": request_item["request_id"], "request": request_item}

    def upsert_spot(self, body: dict, admin_identity: dict) -> dict:
        city = normalize_city(body.get("city"))
        name = required_text(body.get("name"), "name", 120)
        lat, lon = coordinates(body)
        spot_id = optional_text(body.get("spot_id") or body.get("id"), "spot_id", 128) or f"spot_{uuid.uuid4().hex}"
        description = optional_text(body.get("description"), "description", 2000)
        category = logo_id(body.get("category") or body.get("logo_id"))
        offset = nonnegative_number(body.get("coolingOffsetC"), "coolingOffsetC", 3.0, 15.0)
        upvotes = nonnegative_integer(body.get("upvotes"), "upvotes", 0, 1_000_000)
        open_hours = optional_text(body.get("openHours"), "openHours", 80, "06:00 - 22:00")
        image_url = image_url_value(body.get("image_url"))
        if image_url.startswith("data:"):
            image_url = self.media.resolve_image(image_url, "verified_spots")

        existing = self.repository.get_spot(city, spot_id)
        verified_by = str(admin_identity.get("email") or f"admin:{admin_identity['user_id']}")
        item = {
            "city": city,
            "spot_id": spot_id,
            "id": spot_id,
            "name": name,
            "description": description,
            "category": category,
            "lat": Decimal(str(lat)),
            "lon": Decimal(str(lon)),
            "coords": {"lat": Decimal(str(lat)), "lon": Decimal(str(lon))},
            "logo_id": str(body.get("logo_id") or category),
            "coolingOffsetC": Decimal(str(offset)),
            "openHours": open_hours,
            "upvotes": upvotes,
            "verified_by": verified_by,
            "created_at": str((existing or {}).get("created_at") or _now_iso()),
            "image_url": image_url,
        }
        self.repository.put_spot(item)
        return {"message": "Cool spot upserted successfully", "spot": item}

    def delete_spot(self, city_value: Any, spot_id: str) -> dict:
        city = normalize_city(city_value)
        spot_id = required_text(spot_id, "spot_id", 128)
        existing = self.repository.get_spot(city, spot_id)
        if not existing:
            return {"deleted": False, "spot_id": spot_id}
        self.repository.delete_spot(city, spot_id)
        return {"deleted": True, "spot_id": spot_id}

    def list_requests(self) -> dict:
        requests = self.repository.list_requests()
        return {"requests": requests, "count": len(requests)}

    def review_request(self, request_id: str, body: dict, admin_identity: dict) -> dict:
        request_id = required_text(request_id, "request_id", 128)
        status = str(body.get("status", "")).strip().lower()
        if status not in {"approved", "rejected"}:
            raise ValidationError("status must be either APPROVED or REJECTED")
        request_item = self.repository.get_request(request_id)
        if not request_item:
            return None
        if str(request_item.get("status", "")).lower() != "pending":
            raise RequestAlreadyReviewedError

        approved_spot = None
        if status == "approved":
            city = normalize_city(request_item.get("city"))
            lat, lon = coordinates(request_item)
            reviewer = str(admin_identity.get("email") or f"admin:{admin_identity['user_id']}")
            approved_spot = {
                "city": city,
                "spot_id": request_id,
                "id": request_id,
                "name": required_text(request_item.get("suggested_name"), "suggested_name", 120),
                "description": optional_text(request_item.get("message"), "message", 2000),
                "category": "canopy_park",
                "lat": Decimal(str(lat)),
                "lon": Decimal(str(lon)),
                "coords": {"lat": Decimal(str(lat)), "lon": Decimal(str(lon))},
                "logo_id": str(request_item.get("suggested_logo") or "tree_canopy"),
                "coolingOffsetC": Decimal("3.5"),
                "openHours": "06:00 - 21:00",
                "upvotes": 1,
                # The reviewer, not the submitter, verifies the spot.
                "verified_by": reviewer,
                "created_at": _now_iso(),
                "image_url": str(request_item.get("spot_image_url") or ""),
            }
        else:
            reviewer = str(admin_identity.get("email") or f"admin:{admin_identity['user_id']}")

        self.repository.review_request(
            request_id=request_id,
            status=status,
            reviewer=reviewer,
            reviewed_at=_now_iso(),
            approved_spot=approved_spot,
        )
        return {"updated": True, "request_id": request_id, "status": status}
