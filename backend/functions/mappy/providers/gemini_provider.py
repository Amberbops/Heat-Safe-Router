import json
import os
import urllib.request
from typing import Any, Dict, List
from .base import BaseAIProvider
from .deterministic_provider import DeterministicProvider


MAPPY_SYSTEM_PROMPT = """You are MAPPY, a concise, practical, and friendly walking-navigation companion for Heat-Safe Router.
STRICT RULES:
1. Never fabricate coordinates, distances, walking durations, weather values, heat scores, or arrival events.
2. Always use the provided tools (`resolve_destination`, `plan_routes`, `select_route`, `start_navigation`, `get_navigation_status`, `request_reroute`, `stop_navigation`) to perform actions.
3. Keep responses short and easy to understand while walking.
4. Heat exposure scores are relative route comparisons (80% weather + 20% OSM surface/waytype proxies), not medical risk assessments."""


class GeminiProvider(BaseAIProvider):
    """
    Google Gemini Developer API provider invoked server-side via standard library urllib.
    Automatically falls back to DeterministicProvider on missing credentials or network errors.
    """

    def __init__(self, api_key: str = "", model_name: str = ""):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model_name = model_name or os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
        self.fallback = DeterministicProvider()

    def generate_agent_response(
        self,
        messages: List[Dict[str, str]],
        available_tools: List[Dict[str, Any]],
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not self.api_key:
            return self.fallback.generate_agent_response(messages, available_tools, context)

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model_name}:generateContent?key={self.api_key}"
        )

        contents = []
        for msg in messages[-8:]:
            role = "model" if msg.get("role") == "assistant" else "user"
            text = str(msg.get("content", "")).strip()
            if text:
                contents.append({"role": role, "parts": [{"text": text}]})

        ctx_line = (
            f"Context: city={context.get('city', 'indore')}, "
            f"has_gps={bool(context.get('current_location'))}, "
            f"session_id={context.get('session_id', 'none')}"
        )

        payload: Dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": f"{MAPPY_SYSTEM_PROMPT}\n{ctx_line}"}]},
            "contents": contents,
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 300},
        }
        if available_tools:
            payload["tools"] = [{"functionDeclarations": available_tools}]

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as exc:
            redacted = str(exc).replace(self.api_key, "[REDACTED]")
            print(f"GeminiProvider fallback triggered: {redacted}")
            return self.fallback.generate_agent_response(messages, available_tools, context)

        candidates = data.get("candidates") or []
        if not candidates:
            return self.fallback.generate_agent_response(messages, available_tools, context)

        parts = candidates[0].get("content", {}).get("parts", [])
        texts: List[str] = []
        tool_calls: List[Dict[str, Any]] = []

        for part in parts:
            if part.get("text"):
                texts.append(part["text"].strip())
            if "functionCall" in part:
                fc = part["functionCall"]
                tool_calls.append(
                    {"name": fc.get("name", ""), "arguments": fc.get("args") or {}}
                )

        return {
            "provider": "gemini",
            "model": self.model_name,
            "reply": " ".join(texts).strip(),
            "tool_calls": tool_calls,
        }