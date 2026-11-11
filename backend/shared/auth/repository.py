"""DynamoDB repository for Heat-Safe users and refresh sessions.

The Users table uses ``email`` as its partition key. The currently provisioned
Sessions table uses the exact, case-sensitive key name ``session_Id``. The
application keeps ``session_id`` as its canonical Python/API field and maps it
at the repository boundary.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError


SESSION_TABLE_KEY = "session_Id"
SESSION_MODEL_KEY = "session_id"


def _log_client_error(operation: str, exc: ClientError) -> None:
    """Log AWS error metadata without logging request payloads or credentials."""
    error = exc.response.get("Error", {})
    metadata = exc.response.get("ResponseMetadata", {})
    print(
        "Auth DynamoDB ClientError:",
        f"operation={operation}",
        f"code={error.get('Code', 'Unknown')}",
        f"message={error.get('Message', 'No message')}",
        f"http_status={metadata.get('HTTPStatusCode', 'Unknown')}",
        f"request_id={metadata.get('RequestId', 'Unknown')}",
    )


class DuplicateUserError(Exception):
    pass


class InvalidSessionError(Exception):
    pass


class AuthRepository:
    def __init__(self, users_table: Any, sessions_table: Any):
        self.users = users_table
        self.sessions = sessions_table

    def create_user(self, item: dict) -> None:
        try:
            self.users.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(email)",
            )
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                raise DuplicateUserError from exc
            _log_client_error("PutItem:HeatSafe_Users", exc)
            raise

    def get_user(self, email: str) -> dict | None:
        try:
            response = self.users.get_item(Key={"email": email}, ConsistentRead=True)
            return response.get("Item")
        except ClientError as exc:
            _log_client_error("GetItem:HeatSafe_Users", exc)
            raise

    def link_amazon_account(
        self,
        *,
        email: str,
        amazon_user_id: str,
        name: str,
        auth_provider: str,
        now_iso: str,
        default_user_id: str | None = None,
    ) -> dict | None:
        """Link or refresh Login with Amazon metadata on an existing HeatSafe user."""
        try:
            expr = (
                "SET amazon_user_id = :az, auth_provider = :prov, #nm = :nm, "
                "email_verified = :true, "
                "#st = if_not_exists(#st, :active), "
                "#rl = if_not_exists(#rl, :default_role), "
                "updated_at = :now"
            )
            names = {"#nm": "name", "#st": "status", "#rl": "role"}
            values: dict[str, Any] = {
                ":az": amazon_user_id,
                ":prov": auth_provider,
                ":nm": name,
                ":true": True,
                ":active": "active",
                ":default_role": "user",
                ":now": now_iso,
            }
            if default_user_id:
                expr += ", user_id = if_not_exists(user_id, :uid)"
                values[":uid"] = default_user_id

            response = self.users.update_item(
                Key={"email": email},
                UpdateExpression=expr,
                ConditionExpression=(
                    "attribute_exists(email) AND "
                    "(attribute_not_exists(amazon_user_id) OR amazon_user_id = :az)"
                ),
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
                ReturnValues="ALL_NEW",
            )
            return response.get("Attributes")
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                raise PermissionError("Amazon account mismatch for existing email") from exc
            _log_client_error("UpdateItem:HeatSafe_Users:link_amazon", exc)
            raise

    def set_user_otp(
        self,
        *,
        email: str,
        otp_hash: str,
        otp_purpose: str,
        otp_expires_at: int,
        otp_sent_at: int,
        now_iso: str,
    ) -> None:
        try:
            self.users.update_item(
                Key={"email": email},
                UpdateExpression=(
                    "SET otp_hash = :oh, otp_purpose = :op, otp_expires_at = :oe, "
                    "otp_sent_at = :os, otp_attempts = :zero, updated_at = :now"
                ),
                ConditionExpression="attribute_exists(email)",
                ExpressionAttributeValues={
                    ":oh": otp_hash,
                    ":op": otp_purpose,
                    ":oe": otp_expires_at,
                    ":os": otp_sent_at,
                    ":zero": 0,
                    ":now": now_iso,
                },
            )
        except ClientError as exc:
            _log_client_error("UpdateItem:HeatSafe_Users:set_otp", exc)
            raise

    def increment_otp_attempts(self, *, email: str, now_iso: str) -> int:
        try:
            res = self.users.update_item(
                Key={"email": email},
                UpdateExpression="SET otp_attempts = if_not_exists(otp_attempts, :zero) + :one, updated_at = :now",
                ExpressionAttributeValues={":zero": 0, ":one": 1, ":now": now_iso},
                ReturnValues="UPDATED_NEW",
            )
            return int((res.get("Attributes") or {}).get("otp_attempts", 1))
        except ClientError as exc:
            _log_client_error("UpdateItem:HeatSafe_Users:otp_attempts", exc)
            raise

    def mark_otp_verified(self, *, email: str, now_iso: str) -> dict | None:
        try:
            res = self.users.update_item(
                Key={"email": email},
                UpdateExpression=(
                    "SET email_verified = :true, updated_at = :now "
                    "REMOVE otp_hash, otp_purpose, otp_expires_at, otp_attempts"
                ),
                ConditionExpression="attribute_exists(email)",
                ExpressionAttributeValues={":true": True, ":now": now_iso},
                ReturnValues="ALL_NEW",
            )
            return res.get("Attributes")
        except ClientError as exc:
            _log_client_error("UpdateItem:HeatSafe_Users:verify_otp", exc)
            raise

    def create_session(self, item: dict) -> None:
        """Create a refresh session, mapping the model key to the table key."""
        try:
            if not item.get(SESSION_MODEL_KEY):
                raise ValueError("Session item is missing session_id")
            stored_item = dict(item)
            stored_item[SESSION_TABLE_KEY] = str(item[SESSION_MODEL_KEY])
            self.sessions.put_item(
                Item=stored_item,
                ConditionExpression=f"attribute_not_exists({SESSION_TABLE_KEY})",
            )
        except ClientError as exc:
            _log_client_error("PutItem:HeatSafe_Sessions", exc)
            raise

    def get_session(self, session_id: str) -> dict | None:
        try:
            response = self.sessions.get_item(
                Key={SESSION_TABLE_KEY: session_id},
                ConsistentRead=True,
            )
            return response.get("Item")
        except ClientError as exc:
            _log_client_error("GetItem:HeatSafe_Sessions", exc)
            raise

    def rotate_session(
        self, *, session_id: str, old_hash: str, new_hash: str,
        expires_at: int, now_epoch: int, now_iso: str,
    ) -> None:
        try:
            self.sessions.update_item(
                Key={SESSION_TABLE_KEY: session_id},
                UpdateExpression="SET refresh_token_hash = :new, expires_at = :exp, #ttl = :ttl, updated_at = :now",
                ConditionExpression="refresh_token_hash = :old AND revoked = :false AND expires_at > :epoch",
                ExpressionAttributeNames={"#ttl": "ttl"},
                ExpressionAttributeValues={
                    ":new": new_hash, ":old": old_hash, ":exp": expires_at,
                    ":ttl": expires_at, ":now": now_iso, ":false": False, ":epoch": now_epoch,
                },
            )
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                raise InvalidSessionError from exc
            _log_client_error("UpdateItem:HeatSafe_Sessions:rotate", exc)
            raise

    def revoke_session(self, *, session_id: str, token_hash: str, now_iso: str) -> bool:
        try:
            self.sessions.update_item(
                Key={SESSION_TABLE_KEY: session_id},
                UpdateExpression="SET revoked = :true, revoked_at = :now",
                ConditionExpression="refresh_token_hash = :hash AND revoked = :false",
                ExpressionAttributeValues={
                    ":true": True, ":false": False, ":hash": token_hash, ":now": now_iso,
                },
            )
            return True
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
                return False
            _log_client_error("UpdateItem:HeatSafe_Sessions:revoke", exc)
            raise


def utc_iso(epoch: int | None = None) -> str:
    value = datetime.fromtimestamp(epoch, tz=timezone.utc) if epoch is not None else datetime.now(timezone.utc)
    return value.isoformat()
