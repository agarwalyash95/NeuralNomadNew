from rest_framework import serializers
from .models import (
    Country, State, City, Airport, Airline, AirportRoute,
    RailwayStation, TrainRoute, BusStation, BusRoute, MetroStation,
    HotelMaster, RestaurantMaster, AttractionMaster, ActivityMaster,
    HolidayCalendar, WeatherNormals, TravelSeason
)

class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'

class StateSerializer(serializers.ModelSerializer):
    class Meta:
        model = State
        fields = '__all__'

class CitySerializer(serializers.ModelSerializer):
    country_code = serializers.CharField(source='country.code', read_only=True)
    class Meta:
        model = City
        fields = '__all__'

class AirportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airport
        fields = '__all__'

class AirlineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Airline
        fields = '__all__'

class AirportRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AirportRoute
        fields = '__all__'

class RailwayStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = RailwayStation
        fields = '__all__'

class TrainRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainRoute
        fields = '__all__'

class BusStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusStation
        fields = '__all__'

class BusRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusRoute
        fields = '__all__'

class MetroStationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetroStation
        fields = '__all__'

class HotelMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = HotelMaster
        fields = '__all__'

class RestaurantMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = RestaurantMaster
        fields = '__all__'

class AttractionMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = AttractionMaster
        fields = '__all__'

class ActivityMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityMaster
        fields = '__all__'

class HolidayCalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = HolidayCalendar
        fields = '__all__'

class WeatherNormalsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeatherNormals
        fields = '__all__'

class TravelSeasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelSeason
        fields = '__all__'


# ==========================================
# NEW MODEL SERIALIZERS
# ==========================================

from .models import (
    MetroArea, MetroAreaAlias, MetroAreaCity, CityAlias, Locality, LocalityAlias,
    RailwayStationServiceArea, AirportServiceArea, BusStationServiceArea,
    ReferenceFieldProvenance, TravelPriceObservation, TravelPriceSummary
)

class MetroAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetroArea
        fields = '__all__'

class MetroAreaAliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = MetroAreaAlias
        fields = '__all__'

class MetroAreaCitySerializer(serializers.ModelSerializer):
    class Meta:
        model = MetroAreaCity
        fields = '__all__'

class CityAliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = CityAlias
        fields = '__all__'

class LocalitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Locality
        fields = '__all__'

class LocalityAliasSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocalityAlias
        fields = '__all__'

class RailwayStationServiceAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RailwayStationServiceArea
        fields = '__all__'

class AirportServiceAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = AirportServiceArea
        fields = '__all__'

class BusStationServiceAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusStationServiceArea
        fields = '__all__'

class ReferenceFieldProvenanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReferenceFieldProvenance
        fields = '__all__'

class TravelPriceObservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelPriceObservation
        fields = '__all__'

class TravelPriceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelPriceSummary
        fields = '__all__'

from .models import (
    District, SourceRegistry, SourceRelease, ImportBatch, StagingRecord,
    ProviderEntityMap, DataQualityIssue,
)

class DistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = '__all__'

class SourceRegistrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceRegistry
        fields = '__all__'

class SourceReleaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceRelease
        fields = '__all__'

class ImportBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportBatch
        fields = '__all__'

class StagingRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = StagingRecord
        fields = '__all__'

class ProviderEntityMapSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderEntityMap
        fields = '__all__'

class DataQualityIssueSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataQualityIssue
        fields = '__all__'

from .models import HubTransferLink

class HubTransferLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = HubTransferLink
        fields = '__all__'


from .models import FareRule

class FareRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = FareRule
        fields = '__all__'


from .models import CategoryVocabularyMap

class CategoryVocabularyMapSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoryVocabularyMap
        fields = '__all__'

