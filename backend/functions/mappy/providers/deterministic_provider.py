import re
from typing import Any, Dict, List
from .base import BaseAIProvider


class DeterministicProvider(BaseAIProvider):
    """
    Zero-cost deterministic intent parser for Mappy navigation commands.
    Guarantees navigation works when external AI APIs are unconfigured or offline.
    """

    DESTINATION_PATTERNS = [
        r"(?:route|way|walk|path|go|navigate|directions?)\s+(?:from\s+here\s+)?to\s+([a-zA-Z0-9\s,_-]+)",
        r"to\s+([a-zA-Z0-9\s,_-]+?)\s+from\s+(?:here|my\s+current\s+location|current\s+location)",
        r"reach\s+([a-zA-Z0-9\s,_-]+)",
    ]

    def generate_agent_response(
        self,
        messages: List[Dict[str, str]],
        available_tools: List[Dict[str, Any]],
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        user_text = ""
        for msg in reversed(messages):
            if msg.get("role") == "user":
                user_text = msg.get("content", "").strip()
                break

        lower = user_text.lower()
        city = context.get("city", "indore")
        session_id = context.get("session_id", "default-session")

        # 1. Stop navigation
        if any(k in lower for k in ["stop navigation", "cancel navigation", "end navigation", "stop"]):
            return {
                "provider": "deterministic",
                "reply": "Stopping active navigation.",
                "tool_calls": [{"name": "stop_navigation", "arguments": {"session_id": session_id}}],
            }

        # 2. Check navigation status
        if any(k in lower for k in ["navigation status", "am i on route", "how far", "progress"]):
            return {
                "provider": "deterministic",
                "reply": "Checking your live route progress.",
                "tool_calls": [{"name": "get_navigation_status", "arguments": {"session_id": session_id}}],
            }

        # 3. Reroute request
        if any(k in lower for k in ["reroute", "another way", "find another", "recalculate"]):
            return {
                "provider": "deterministic",
                "reply": "Recalculating routes from your current GPS position.",
                "tool_calls": [{"name": "request_reroute", "arguments": {"session_id": session_id}}],
            }

        # 4. Route selection ("select heat-safe", "choose optimal", "shortest", "route 2")
        if any(k in lower for k in ["select", "choose", "use", "switch to"]):
            route_match = re.search(r"route[-_\s]*([123])", lower)
            if route_match:
                r_id = f"route-{route_match.group(1)}"
                return {
                    "provider": "deterministic",
                    "reply": f"Selected {r_id}.",
                    "tool_calls": [
                        {"name": "select_route", "arguments": {"session_id": session_id, "route_id": r_id}}
                    ],
                }
            for pref, keywords in [
                ("heat-safe", ["heat-safe", "heat safe", "cooler", "coolest"]),
                ("optimal", ["optimal", "balanced"]),
                ("shortest", ["shortest", "fast", "quickest"]),
            ]:
                if any(kw in lower for kw in keywords):
                    return {
                        "provider": "deterministic",
                        "reply": f"Selected the {pref} route.",
                        "tool_calls": [
                            {"name": "select_route", "arguments": {"session_id": session_id, "preference": pref}}
                        ],
                    }

        # 5. Start navigation
        if any(k in lower for k in ["start navigation", "begin navigation", "yes start", "let's go"]):
            return {
                "provider": "deterministic",
                "reply": "Starting live walking navigation.",
                "tool_calls": [{"name": "start_navigation", "arguments": {"session_id": session_id}}],
            }

        # 6. Destination resolution & route planning
        for pattern in self.DESTINATION_PATTERNS:
            match = re.search(pattern, user_text, re.IGNORECASE)
            if match:
                raw_dest = match.group(1).strip(" .,!?")
                raw_dest = re.sub(
                    r"\s+from\s+(?:my\s+current\s+location|here|current\s+location).*$",
                    "",
                    raw_dest,
                    flags=re.IGNORECASE,
                ).strip()
                if raw_dest:
                    return {
                        "provider": "deterministic",
                        "reply": f"Resolving {raw_dest} and calculating heat-safe walking routes.",
                        "tool_calls": [
                            {"name": "resolve_destination", "arguments": {"query": raw_dest, "city": city}},
                            {"name": "plan_routes", "arguments": {"destination_query": raw_dest, "city": city}},
                        ],
                    }

        return {
            "provider": "deterministic",
            "reply": (
                "I'm Mappy, your heat-safe walking assistant. "
                "Ask me: 'Hey Mappy, find the best walking route to Rajwada from my current location.'"
            ),
            "tool_calls": [],
        }