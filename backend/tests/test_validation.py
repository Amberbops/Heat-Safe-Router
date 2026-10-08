import os
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock
import importlib


PLANNER_DIR = (
    Path(__file__).resolve().parents[1]
    / "functions"
    / "planner"
)

sys.path.insert(0, str(PLANNER_DIR))

os.environ["HEIGIT_API_KEY"] = "test-key"
os.environ["DYNAMODB_TABLE_NAME"] = "HeatSafe_RoutePlans"

mock_table = MagicMock()
mock_dynamodb = MagicMock()
mock_dynamodb.Table.return_value = mock_table


with patch("boto3.resource", return_value=mock_dynamodb):
    planner = importlib.import_module("lambda_function")


def test_missing_parameters():
    event = {
        "queryStringParameters": {
            "originLat": "22.7196",
            "originLon": "75.8577",
        }
    }

    response = planner.lambda_handler(
        event,
        None,
    )

    assert response["statusCode"] == 400

    assert "missing" in response["body"]


def test_invalid_coordinates():
    event = {
        "queryStringParameters": {
            "originLat": "999",
            "originLon": "75.8577",
            "destLat": "22.7256",
            "destLon": "75.8656",
        }
    }

    response = planner.lambda_handler(
        event,
        None,
    )

    assert response["statusCode"] == 400


def test_options():
    event = {
        "requestContext": {
            "http": {
                "method": "OPTIONS"
            }
        }
    }

    response = planner.lambda_handler(
        event,
        None,
    )

    assert response["statusCode"] == 204