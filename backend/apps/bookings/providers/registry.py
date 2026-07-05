"""
Provider Registry - Dynamic Factory for Travel Search & Booking APIs.
Allows swapping underlying API providers via Django settings or environment variables seamlessly.
"""

import logging
from typing import Dict, Any, List
from django.conf import settings

from .base import BaseSearchProvider
from .flight_providers import SkyScrapperFlightProvider, MockFlightProvider
from .hotel_providers import BookingComHotelProvider, HotelsDojoProvider, MockHotelProvider
from .bus_providers import RedbusBusProvider, MockBusProvider
from .train_providers import LiveTrainStatusProvider, MockTrainProvider
from .cab_providers import BookingComTaxiProvider, MockCabProvider

logger = logging.getLogger(__name__)


class ProviderRegistry:
    """
    Central Manager for third-party travel search API providers.
    """

    def __init__(self):
        self.api_key = getattr(settings, 'RAPIDAPI_KEY', '')

    def get_provider(self, service_type: str) -> BaseSearchProvider:
        service_type = service_type.lower().strip()

        if service_type in ['flight', 'flights']:
            provider_name = getattr(settings, 'FLIGHT_PROVIDER', 'sky_scrapper')
            if provider_name == 'sky_scrapper' and self.api_key:
                return SkyScrapperFlightProvider(api_key=self.api_key)
            return MockFlightProvider()

        elif service_type in ['hotel', 'hotels']:
            provider_name = getattr(settings, 'HOTEL_PROVIDER', 'booking_com')
            if provider_name == 'booking_com' and self.api_key:
                return BookingComHotelProvider(api_key=self.api_key)
            elif provider_name == 'hotels_dojo' and self.api_key:
                return HotelsDojoProvider(api_key=self.api_key)
            return MockHotelProvider()

        elif service_type in ['bus', 'buses']:
            provider_name = getattr(settings, 'BUS_PROVIDER', 'redbus')
            if provider_name == 'redbus' and self.api_key:
                return RedbusBusProvider(api_key=self.api_key)
            return MockBusProvider()

        elif service_type in ['train', 'trains']:
            provider_name = getattr(settings, 'TRAIN_PROVIDER', 'live_train')
            if provider_name == 'live_train' and self.api_key:
                return LiveTrainStatusProvider(api_key=self.api_key)
            return MockTrainProvider()

        elif service_type in ['cab', 'cabs', 'taxi', 'taxis']:
            provider_name = getattr(settings, 'CAB_PROVIDER', 'booking_taxi')
            if provider_name == 'booking_taxi' and self.api_key:
                return BookingComTaxiProvider(api_key=self.api_key)
            return MockCabProvider()

        else:
            logger.warning(f"Unknown service type '{service_type}'. Falling back to MockFlightProvider.")
            return MockFlightProvider()

    def search(self, service_type: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Execute search using configured provider with automatic mock fallback.
        """
        provider = self.get_provider(service_type)
        try:
            return provider.search(params)
        except Exception as e:
            logger.error(f"Provider search execution failed for service '{service_type}': {e}. Using fallback mock.")
            # Fallback to mock provider
            if service_type in ['flight', 'flights']:
                return MockFlightProvider().search(params)
            elif service_type in ['hotel', 'hotels']:
                return MockHotelProvider().search(params)
            elif service_type in ['bus', 'buses']:
                return MockBusProvider().search(params)
            elif service_type in ['train', 'trains']:
                return MockTrainProvider().search(params)
            else:
                return MockCabProvider().search(params)


# Singleton instance
provider_registry = ProviderRegistry()
