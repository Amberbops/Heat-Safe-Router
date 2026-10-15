from abc import ABC, abstractmethod
from typing import Any, Dict, List


class BaseAIProvider(ABC):
    """Unified interface for Mappy conversational providers."""

    @abstractmethod
    def generate_agent_response(
        self,
        messages: List[Dict[str, str]],
        available_tools: List[Dict[str, Any]],
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Returns:
        {
            "provider": "gemini" | "deterministic",
            "reply": str,
            "tool_calls": [{"name": str, "arguments": dict}]
        }
        """
        raise NotImplementedError