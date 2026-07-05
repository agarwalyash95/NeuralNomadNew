"""
Base Provider interfaces for search and booking integrations.
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any


class BaseSearchProvider(ABC):
    """Abstract base class for all travel search providers."""

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    @abstractmethod
    def search(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Execute search and return standardized inventory dictionaries.
        
        Returned dict structure:
        {
            "id": str,
            "service_type": "flight" | "hotel" | "bus" | "train" | "cab",
            "title": str,
            "code": str,
            "origin_city": str,
            "destination_city": str,
            "origin_code": str,
            "destination_code": str,
            "departure_time": str,
            "arrival_time": str,
            "duration": str,
            "days_of_week": list,
            "stops": int,
            "meta": dict,
            "providers": list,
            "is_active": bool
        }
        """
        pass


class BaseFlightProvider(BaseSearchProvider):
    """Base provider for Flight search APIs."""
    pass


class BaseHotelProvider(BaseSearchProvider):
    """Base provider for Hotel search APIs."""
    pass


class BaseBusProvider(BaseSearchProvider):
    """Base provider for Bus search APIs."""
    pass


class BaseTrainProvider(BaseSearchProvider):
    """Base provider for Train search APIs."""
    pass


class BaseCabProvider(BaseSearchProvider):
    """Base provider for Cab/Taxi search APIs."""
    pass
