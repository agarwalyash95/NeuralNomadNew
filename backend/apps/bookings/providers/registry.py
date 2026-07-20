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

    Live providers are used only when LIVE_PROVIDERS_ENABLED is true AND a
    RAPIDAPI_KEY is configured; otherwise every service falls back to its
    Mock provider. Settings are read per-call (not at import time) so a
    settings override or env flip takes effect without a restart of the
    module-level singleton.
    """

    @property
    def api_key(self) -> str:
        if not getattr(settings, 'LIVE_PROVIDERS_ENABLED', False):
            return ''
        return getattr(settings, 'RAPIDAPI_KEY', '')

    def get_provider(self, service_type: str) -> BaseSearchProvider:
        service_type = service_type.lower().strip()
        api_key = self.api_key

        if service_type in ['flight', 'flights']:
            provider_name = getattr(settings, 'FLIGHT_PROVIDER', 'sky_scrapper')
            if provider_name == 'sky_scrapper' and api_key:
                return SkyScrapperFlightProvider(api_key=api_key)
            return MockFlightProvider()

        elif service_type in ['hotel', 'hotels']:
            provider_name = getattr(settings, 'HOTEL_PROVIDER', 'booking_com')
            if provider_name == 'booking_com' and api_key:
                return BookingComHotelProvider(api_key=api_key)
            elif provider_name == 'hotels_dojo' and api_key:
                return HotelsDojoProvider(api_key=api_key)
            return MockHotelProvider()

        elif service_type in ['bus', 'buses']:
            provider_name = getattr(settings, 'BUS_PROVIDER', 'redbus')
            if provider_name == 'redbus' and api_key:
                return RedbusBusProvider(api_key=api_key)
            return MockBusProvider()

        elif service_type in ['train', 'trains']:
            provider_name = getattr(settings, 'TRAIN_PROVIDER', 'live_train')
            if provider_name == 'live_train' and api_key:
                return LiveTrainStatusProvider(api_key=api_key)
            return MockTrainProvider()

        elif service_type in ['cab', 'cabs', 'taxi', 'taxis']:
            provider_name = getattr(settings, 'CAB_PROVIDER', 'booking_taxi')
            if provider_name == 'booking_taxi' and api_key:
                return BookingComTaxiProvider(api_key=api_key)
            return MockCabProvider()

        else:
            logger.warning(f"Unknown service type '{service_type}'. Falling back to MockFlightProvider.")
            return MockFlightProvider()

    # Same alias set get_provider() dispatches on, collapsed to the exact
    # 5 values TravelPriceObservation.service_type's choices declare — an
    # unrecognized mode (e.g. journey_resolver's "walking"/"driving") is
    # skipped rather than written with an invalid category.
    _OBSERVATION_SERVICE_TYPES = {
        "flight": "flight", "flights": "flight",
        "hotel": "hotel", "hotels": "hotel",
        "bus": "bus", "buses": "bus",
        "train": "train", "trains": "train",
        "cab": "cab", "cabs": "cab", "taxi": "cab", "taxis": "cab",
    }

    @classmethod
    def _record_observations(cls, service_type: str, items: List[Dict[str, Any]], params: Dict[str, Any]) -> None:
        """Phase 5: every priced search result becomes a TravelPriceObservation,
        the funnel-point hook for the whole reference-app price-benchmark
        pipeline (docs/plans/reference-foundation-and-planner-intelligence-
        master-plan.md §10.3). Imported lazily — apps.reference.services
        .live_price already imports this module's provider_registry lazily
        inside a function body, so a module-level import here would risk a
        circular import at Django app-loading time.
        """
        canonical = cls._OBSERVATION_SERVICE_TYPES.get((service_type or "").lower().strip())
        if canonical is None:
            return
        try:
            from apps.reference.services.live_price import record_price_observation
        except Exception:
            return
        for item in items:
            record_price_observation(canonical, item, params=params)

    def search(self, service_type: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Execute search using configured provider with automatic mock fallback.
        """
        provider = self.get_provider(service_type)
        mock_types = (MockFlightProvider, MockHotelProvider, MockBusProvider, MockTrainProvider, MockCabProvider)
        is_mock = isinstance(provider, mock_types)
        if is_mock and not getattr(settings, "BOOKINGS_ALLOW_MOCK_INVENTORY", settings.DEBUG):
            logger.warning("Mock %s inventory is disabled in this environment", service_type)
            return []
        try:
            results = provider.search(params)
            default_source = "mock_inventory" if is_mock else "live_inventory"
            normalized = []
            allow_mock = getattr(settings, "BOOKINGS_ALLOW_MOCK_INVENTORY", settings.DEBUG)
            for item in results:
                source = item.get("source") or default_source
                # A live provider may explicitly fall back to its sample
                # adapter. Preserve that provenance and suppress it entirely
                # when sample inventory is disabled.
                if source == "mock_inventory" and not allow_mock:
                    continue
                item["source"] = source
                item.setdefault("provenance", {
                    "source": source,
                    "label": "Sample data" if source == "mock_inventory" else provider.__class__.__name__,
                    "is_live": source == "live_inventory",
                })
                normalized.append(item)
            self._record_observations(service_type, normalized, params)
            return normalized
        except Exception as e:
            logger.error(f"Provider search execution failed for service '{service_type}': {e}. Using fallback mock.")
            if not getattr(settings, "BOOKINGS_ALLOW_MOCK_INVENTORY", settings.DEBUG):
                return []
            # Development-only fallback, always explicitly marked.
            if service_type in ['flight', 'flights']:
                results = MockFlightProvider().search(params)
            elif service_type in ['hotel', 'hotels']:
                results = MockHotelProvider().search(params)
            elif service_type in ['bus', 'buses']:
                results = MockBusProvider().search(params)
            elif service_type in ['train', 'trains']:
                results = MockTrainProvider().search(params)
            else:
                results = MockCabProvider().search(params)
            for item in results:
                item["source"] = "mock_inventory"
                item["provenance"] = {"source": "mock_inventory", "label": "Sample data", "is_live": False}
            return results


# Singleton instance
provider_registry = ProviderRegistry()
