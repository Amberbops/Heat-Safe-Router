import os
import sys

# Ensure project root is on sys.path and HEIGIT_API_KEY is set for offline unit tests
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
os.environ.setdefault("HEIGIT_API_KEY", "test-heigit-key-offline")

from backend.functions.mappy.providers.deterministic_provider import DeterministicProvider
from backend.functions.mappy.providers.gemini_provider import GeminiProvider
from backend.functions.mappy.tools import (
    build_mappy_recommendations,
    match_gps_to_routes,
    resolve_destination,
    validate_location_pair,
)


def test_deterministic_intent_extraction():
    provider = DeterministicProvider()
    res = provider.generate_agent_response(
        messages=[
            {
                "role": "user",
                "content": "Hey Mappy, find the best walking route to Rajwada from my current location.",
            }
        ],
        available_tools=[],
        context={"city": "indore", "session_id": "test-1"},
    )
    assert res["provider"] == "deterministic"
    tool_names = [t["name"] for t in res["tool_calls"]]
    assert "resolve_destination" in tool_names or "resolve_and_plan" in tool_names


def test_gemini_fallback_when_no_key_present():
    os.environ.pop("GEMINI_API_KEY", None)
    provider = GeminiProvider(api_key="")
    res = provider.generate_agent_response(
        messages=[{"role": "user", "content": "Mappy, find me a cooler way to Sarafa."}],
        available_tools=[],
        context={"city": "indore", "session_id": "test-2"},
    )
    assert res["provider"] == "deterministic"
    assert len(res["tool_calls"]) >= 1


def test_indore_landmark_resolution_and_validation():
    dest = resolve_destination("Rajwada", "indore")
    assert dest is not None
    assert dest["source"] == "curated_landmark"
    valid, code, _ = validate_location_pair(
        22.7196, 75.8577, dest["latitude"], dest["longitude"], "indore"
    )
    assert valid is True
    assert code is None


def test_mappy_three_recommendation_modes():
    routes = [
        {"route_id": "route-1", "distance_km": 1.48, "duration_min": 18.0},
        {"route_id": "route-2", "distance_km": 1.19, "duration_min": 14.5},
        {"route_id": "route-3", "distance_km": 1.34, "duration_min": 16.2},
    ]
    planner_recs = {
        "heat-safe": {"route_id": "route-3"},
        "balanced": {"route_id": "route-1"},
        "fast": {"route_id": "route-2"},
    }
    mappy_recs = build_mappy_recommendations(routes, planner_recs)
    assert mappy_recs["heat_safe"]["route_id"] == "route-3"
    assert mappy_recs["optimal"]["route_id"] == "route-1"
    assert mappy_recs["shortest"]["route_id"] == "route-2"


def test_live_route_matching_deviation_and_arrival():
    routes = [
        {
            "route_id": "route-1",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [75.8577, 22.7196],
                    [75.8615, 22.7225],
                    [75.8656, 22.7256],
                ],
            },
        }
    ]
    # 1. On route
    s1 = match_gps_to_routes(22.7225, 75.8615, 8.0, routes, "route-1", 0)
    assert s1["status"] == "on_route"

    # 2. First off-route sample -> drift warning only (hysteresis)
    s2 = match_gps_to_routes(22.7280, 75.8577, 8.0, routes, "route-1", 0)
    assert s2["status"] == "gps_drift_warning"

    # 3. Second consecutive off-route sample -> confirmed deviation
    s3 = match_gps_to_routes(
        22.7280, 75.8577, 8.0, routes, "route-1", s2["consecutive_off_route_count"]
    )
    assert s3["status"] == "deviated"

    # 4. Arrival at destination
    s4 = match_gps_to_routes(22.7256, 75.8656, 6.0, routes, "route-1", 0)
    assert s4["status"] == "arrived"
    assert s4["progress_percent"] == 100.0