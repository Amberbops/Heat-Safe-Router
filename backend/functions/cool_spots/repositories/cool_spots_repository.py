"""DynamoDB persistence for verified Cool Spots and nomination requests."""
from __future__ import annotations

import logging
from typing import Any
from decimal import Decimal

from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class RequestNotFoundError(Exception):
    pass


class RequestAlreadyReviewedError(Exception):
    pass


class CoolSpotsRepository:
    def __init__(self, spots_table: Any, requests_table: Any, dynamodb_client: Any, spots_city_index_name: str = "CityIndex"):
        self.spots = spots_table
        self.requests = requests_table
        self.spots_city_index_name = spots_city_index_name
        self.client = dynamodb_client
        self._serializer = TypeSerializer()

    def _to_dynamodb_value(self, value: Any) -> Any:
        if isinstance(value, float):
            return Decimal(str(value))
        if isinstance(value, dict):
            return {key: self._to_dynamodb_value(item) for key, item in value.items()}
        if isinstance(value, list):
            return [self._to_dynamodb_value(item) for item in value]
        return value

    def _marshal(self, item: dict) -> dict:
        normalized = self._to_dynamodb_value(item)
        return {key: self._serializer.serialize(value) for key, value in normalized.items() if value is not None}

    def list_spots(self, city: str) -> list[dict]:
        items: list[dict] = []
        # The deployed base table uses spot_id as its partition key. City lookups
        # must use the CityIndex GSI (partition key city, sort key spot_id).
        kwargs = {
            "IndexName": self.spots_city_index_name,
            "KeyConditionExpression": Key("city").eq(city),
        }
        while True:
            result = self.spots.query(**kwargs)
            items.extend(result.get("Items", []))
            last_key = result.get("LastEvaluatedKey")
            if not last_key:
                break
            kwargs["ExclusiveStartKey"] = last_key
        return items

    def get_spot(self, city: str, spot_id: str) -> dict | None:
        result = self.spots.get_item(Key={"spot_id": spot_id}, ConsistentRead=True)
        item = result.get("Item")
        if item and str(item.get("city", "")).lower() != city.lower():
            return None
        return item

    def put_spot(self, item: dict) -> None:
        self.spots.put_item(Item=item)

    def delete_spot(self, city: str, spot_id: str) -> None:
        # Base table primary key is spot_id; city is validated by the service
        # through get_spot before the delete is issued.
        self.spots.delete_item(Key={"spot_id": spot_id})

    def create_request(self, item: dict) -> None:
        self.requests.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(request_id)",
        )

    def get_request(self, request_id: str) -> dict | None:
        result = self.requests.get_item(Key={"request_id": request_id}, ConsistentRead=True)
        return result.get("Item")

    def list_requests(self) -> list[dict]:
        items: list[dict] = []
        kwargs: dict = {}
        while True:
            result = self.requests.scan(**kwargs)
            items.extend(result.get("Items", []))
            last_key = result.get("LastEvaluatedKey")
            if not last_key:
                break
            kwargs["ExclusiveStartKey"] = last_key
        items.sort(key=lambda item: str(item.get("created_at", "")), reverse=True)
        return items

    def review_request(self, request_id: str, status: str, reviewer: str, reviewed_at: str, approved_spot: dict | None) -> None:
        update = {
            "TableName": self.requests.name,
            "Key": self._marshal({"request_id": request_id}),
            "UpdateExpression": "SET #status = :status, reviewed_by = :reviewer, reviewed_at = :reviewed_at",
            "ConditionExpression": "attribute_exists(request_id) AND #status = :pending",
            "ExpressionAttributeNames": {"#status": "status"},
            "ExpressionAttributeValues": self._marshal({
                ":status": status,
                ":pending": "pending",
                ":reviewer": reviewer,
                ":reviewed_at": reviewed_at,
            }),
        }
        actions = [{"Update": update}]
        if approved_spot is not None:
            actions.append({
                "Put": {
                    "TableName": self.spots.name,
                    "Item": self._marshal(approved_spot),
                    "ConditionExpression": "attribute_not_exists(spot_id)",
                }
            })
        try:
            self.client.transact_write_items(TransactItems=actions)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            reasons = exc.response.get("CancellationReasons")
            logger.error("transact_write_items failed: code=%s, reasons=%s, error=%s", code, reasons, exc)
            if code == "TransactionCanceledException":
                reason_summary = ""
                if isinstance(reasons, list):
                    reason_codes = [str(r.get("Code", "None")) for r in reasons if isinstance(r, dict)]
                    if reason_codes:
                        reason_summary = f" ({', '.join(reason_codes)})"
                raise RequestAlreadyReviewedError(
                    f"Transaction canceled{reason_summary}"
                ) from exc
            raise
