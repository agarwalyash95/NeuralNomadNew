"""
Abstract provider interfaces — swap implementations without touching business logic.
"""

from abc import ABC, abstractmethod


class AIProvider(ABC):
    """Abstract AI provider interface."""

    @abstractmethod
    def generate_response(
        self,
        message: str,
        conversation_history: list[dict],
        memory_context: dict,
        plan_summary: dict | None = None,
    ) -> dict:
        """
        Generate AI response with structured commands.

        Returns:
            {
                "response_text": str,
                "widgets": list[dict],
                "commands": list[dict],
            }
        """
        pass


class MapsProvider(ABC):
    """Abstract maps provider interface."""

    @abstractmethod
    def get_distance_matrix(
        self,
        origins: list[dict],
        destinations: list[dict],
        mode: str = 'driving',
    ) -> dict:
        """Calculate distances between origins and destinations."""
        pass

    @abstractmethod
    def get_directions(
        self,
        origin: dict,
        destination: dict,
        mode: str = 'driving',
    ) -> dict:
        """Get turn-by-turn directions and polyline."""
        pass
