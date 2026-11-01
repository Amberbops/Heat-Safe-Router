#!/usr/bin/env python3
"""Provision AWS Storage Services for HeatSafe Route Planner.

Services created:
1. DynamoDB Table: HeatSafe_CoolSpots
2. DynamoDB Table: HeatSafe_SpotRequests
3. S3 Bucket: heatsafe-coolspots-media
4. Seed initial verified Indore Cool Spots (including 'vallabh garden khatiwala tank')
"""

import sys
import os
import time
from decimal import Decimal
import boto3
from botocore.exceptions import ClientError

REGION = os.environ.get("AWS_REGION", "us-east-1")
COOL_SPOTS_TABLE_NAME = "HeatSafe_CoolSpots"
SPOT_REQUESTS_TABLE_NAME = "HeatSafe_SpotRequests"
MEDIA_BUCKET_NAME = os.environ.get("MEDIA_BUCKET_NAME", "heatsafe-coolspots-media")

def convert_floats_to_decimals(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: convert_floats_to_decimals(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_floats_to_decimals(item) for item in obj]
    return obj

INITIAL_VERIFIED_SPOTS = [
    {
        "spot_id": "spot_indore_vallabh_garden",
        "id": "spot_indore_vallabh_garden",
        "city": "indore",
        "name": "vallabh garden khatiwala tank",
        "description": "pyau and extensive shade throughout the path nearby",
        "category": "canopy_park",
        "lat": 22.6973,
        "lon": 75.8626,
        "coords": {"lat": 22.6973, "lon": 75.8626},
        "logo_id": "tree_canopy",
        "coolingOffsetC": 3.5,
        "openHours": "06:00 - 21:00",
        "upvotes": 38,
        "verified_by": "admin@heatsafe.in",
        "created_at": "2024-01-01T00:00:00Z",
    },
    {
        "spot_id": "spot_indore_nehru_park",
        "id": "spot_indore_nehru_park",
        "city": "indore",
        "name": "Nehru Park Shaded Banyan Walk",
        "description": "Thick canopy cover with public drinking water tap nearby.",
        "category": "canopy_park",
        "lat": 22.7150,
        "lon": 75.8620,
        "coords": {"lat": 22.7150, "lon": 75.8620},
        "logo_id": "tree_canopy",
        "coolingOffsetC": 4.2,
        "openHours": "06:00 - 21:00",
        "upvotes": 63,
        "verified_by": "admin@heatsafe.in",
        "created_at": "2024-01-01T00:00:00Z",
    },
    {
        "spot_id": "spot_indore_regional_park",
        "id": "spot_indore_regional_park",
        "city": "indore",
        "name": "Regional Park Shaded Promenade",
        "description": "Dense neem & banyan canopy with mist breeze near canal bank.",
        "category": "canopy_park",
        "lat": 22.6845,
        "lon": 75.8521,
        "coords": {"lat": 22.6845, "lon": 75.8521},
        "logo_id": "tree_canopy",
        "coolingOffsetC": 3.5,
        "openHours": "06:00 - 21:00",
        "upvotes": 48,
        "verified_by": "admin@heatsafe.in",
        "created_at": "2024-01-01T00:00:00Z",
    },
    {
        "spot_id": "spot_indore_rajwada_kiosk",
        "id": "spot_indore_rajwada_kiosk",
        "city": "indore",
        "name": "Rajwada Heritage Hydration Kiosk",
        "description": "Filtered cold drinking water station and shaded stone arcade.",
        "category": "hydration",
        "lat": 22.7186,
        "lon": 75.8547,
        "coords": {"lat": 22.7186, "lon": 75.8547},
        "logo_id": "water_station",
        "coolingOffsetC": 2.0,
        "openHours": "08:00 - 22:00",
        "upvotes": 112,
        "verified_by": "admin@heatsafe.in",
        "created_at": "2024-01-01T00:00:00Z",
    },
]

def create_dynamodb_tables(dynamodb):
    print("🔹 Checking/Creating DynamoDB Tables...")

    # 1. HeatSafe_CoolSpots table
    try:
        table = dynamodb.create_table(
            TableName=COOL_SPOTS_TABLE_NAME,
            KeySchema=[
                {"AttributeName": "city", "KeyType": "HASH"},
                {"AttributeName": "spot_id", "KeyType": "RANGE"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "city", "AttributeType": "S"},
                {"AttributeName": "spot_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"  ⏳ Creating {COOL_SPOTS_TABLE_NAME}...")
        table.wait_until_exists()
        print(f"  ✅ Created {COOL_SPOTS_TABLE_NAME}")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            print(f"  ℹ️ Table {COOL_SPOTS_TABLE_NAME} already exists.")
        else:
            print(f"  ❌ Error creating {COOL_SPOTS_TABLE_NAME}: {e}")

    # 2. HeatSafe_SpotRequests table
    try:
        table = dynamodb.create_table(
            TableName=SPOT_REQUESTS_TABLE_NAME,
            KeySchema=[
                {"AttributeName": "request_id", "KeyType": "HASH"},
            ],
            AttributeDefinitions=[
                {"AttributeName": "request_id", "AttributeType": "S"},
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"  ⏳ Creating {SPOT_REQUESTS_TABLE_NAME}...")
        table.wait_until_exists()
        print(f"  ✅ Created {SPOT_REQUESTS_TABLE_NAME}")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceInUseException":
            print(f"  ℹ️ Table {SPOT_REQUESTS_TABLE_NAME} already exists.")
        else:
            print(f"  ❌ Error creating {SPOT_REQUESTS_TABLE_NAME}: {e}")

def seed_verified_cool_spots(dynamodb):
    print("🔹 Seeding Verified Cool Spots into DynamoDB...")
    table = dynamodb.Table(COOL_SPOTS_TABLE_NAME)
    for spot in INITIAL_VERIFIED_SPOTS:
        try:
            table.put_item(Item=convert_floats_to_decimals(spot))
            print(f"  ✅ Seeded spot: {spot['name']}")
        except Exception as err:
            print(f"  ❌ Failed to seed spot {spot['name']}: {err}")

def create_s3_bucket(s3_client):
    print("🔹 Checking/Creating S3 Media Bucket...")
    try:
        if REGION == "us-east-1":
            s3_client.create_bucket(Bucket=MEDIA_BUCKET_NAME)
        else:
            s3_client.create_bucket(
                Bucket=MEDIA_BUCKET_NAME,
                CreateBucketConfiguration={"LocationConstraint": REGION},
            )
        print(f"  ✅ Created S3 Bucket: {MEDIA_BUCKET_NAME}")
    except ClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
            print(f"  ℹ️ S3 Bucket {MEDIA_BUCKET_NAME} already exists.")
        else:
            print(f"  ⚠️ Note on S3 Bucket {MEDIA_BUCKET_NAME}: {e}")

def main():
    print("=" * 60)
    print("🚀 HeatSafe Route Planner - AWS Storage Provisioning")
    print(f"Region: {REGION}")
    print("=" * 60)

    try:
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        s3 = boto3.client("s3", region_name=REGION)

        create_dynamodb_tables(dynamodb)
        seed_verified_cool_spots(dynamodb)
        create_s3_bucket(s3)

        print("\n🎉 AWS Storage Setup Complete!")
        print(f"1. DynamoDB Table: {COOL_SPOTS_TABLE_NAME} (Active & Seeded)")
        print(f"2. DynamoDB Table: {SPOT_REQUESTS_TABLE_NAME} (Active)")
        print(f"3. S3 Media Bucket: {MEDIA_BUCKET_NAME}")
    except Exception as e:
        print(f"\n❌ AWS Error: {e}")
        print("Please ensure your AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) are configured.")

if __name__ == "__main__":
    main()
