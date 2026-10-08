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


def test_temperature_score():
    assert planner.temperature_score(25) == 0
    assert planner.temperature_score(40) == 100


def test_humidity_score():
    assert planner.humidity_score(30) == 0
    assert planner.humidity_score(80) == 100


def test_wind_score():
    assert planner.wind_score(20) == 0
    assert planner.wind_score(0) == 100


def test_duration_score():
    assert planner.duration_score(10) == 0
    assert planner.duration_score(40) == 100


def test_weather_heat_weights():
    score, components, weights = planner.calculate_weather_heat(
        temperature=33.5,
        humidity=26,
        wind=10.7,
        duration=16.3,
    )

    assert 0 <= score <= 100

    assert weights["temperature"] == 0.50
    assert weights["humidity"] == 0.15
    assert weights["wind"] == 0.10
    assert weights["duration"] == 0.25