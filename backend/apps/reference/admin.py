from django.contrib import admin
from .models import (
    Country, State, City, Airport, Airline, AirportRoute,
    RailwayStation, TrainRoute, BusStation, BusRoute, MetroStation,
    HotelMaster, RestaurantMaster, AttractionMaster, ActivityMaster,
    HolidayCalendar, WeatherNormals, TravelSeason
)

admin.site.register(Country)
admin.site.register(State)
admin.site.register(City)
admin.site.register(Airport)
admin.site.register(Airline)
admin.site.register(AirportRoute)
admin.site.register(RailwayStation)
admin.site.register(TrainRoute)
admin.site.register(BusStation)
admin.site.register(BusRoute)
admin.site.register(MetroStation)
admin.site.register(HotelMaster)
admin.site.register(RestaurantMaster)
admin.site.register(AttractionMaster)
admin.site.register(ActivityMaster)
admin.site.register(HolidayCalendar)
admin.site.register(WeatherNormals)
admin.site.register(TravelSeason)

from .models import (
    MetroArea, MetroAreaAlias, MetroAreaCity, CityAlias, Locality, LocalityAlias,
    RailwayStationServiceArea, AirportServiceArea, BusStationServiceArea,
    ReferenceFieldProvenance, TravelPriceObservation, TravelPriceSummary,
    CategoryVocabularyMap,
)

admin.site.register(CategoryVocabularyMap)
admin.site.register(MetroArea)
admin.site.register(MetroAreaAlias)
admin.site.register(MetroAreaCity)
admin.site.register(CityAlias)
admin.site.register(Locality)
admin.site.register(LocalityAlias)
admin.site.register(RailwayStationServiceArea)
admin.site.register(AirportServiceArea)
admin.site.register(BusStationServiceArea)
admin.site.register(ReferenceFieldProvenance)
admin.site.register(TravelPriceObservation)
admin.site.register(TravelPriceSummary)

from .models import (
    District, SourceRegistry, SourceRelease, ImportBatch, StagingRecord,
    ProviderEntityMap, DataQualityIssue,
)


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ("name", "state", "lgd_code", "source")
    search_fields = ("name", "normalized_name", "lgd_code")
    list_filter = ("state", "source")


@admin.register(SourceRegistry)
class SourceRegistryAdmin(admin.ModelAdmin):
    list_display = ("slug", "publisher", "licence_name", "active", "licence_verified_at", "priority_rank")
    list_filter = ("active",)
    search_fields = ("slug", "publisher")


@admin.register(SourceRelease)
class SourceReleaseAdmin(admin.ModelAdmin):
    list_display = ("source", "version_label", "release_date", "record_count", "downloaded_at")
    list_filter = ("source",)


@admin.register(ImportBatch)
class ImportBatchAdmin(admin.ModelAdmin):
    list_display = (
        "command_name", "status", "dry_run", "started_at", "finished_at",
        "created_count", "updated_count", "skipped_count", "conflicted_count", "quarantined_count",
    )
    list_filter = ("command_name", "status", "dry_run")


@admin.register(StagingRecord)
class StagingRecordAdmin(admin.ModelAdmin):
    list_display = ("source_record_id", "match_status", "match_confidence", "batch")
    list_filter = ("match_status", "batch")
    search_fields = ("source_record_id",)


@admin.register(ProviderEntityMap)
class ProviderEntityMapAdmin(admin.ModelAdmin):
    list_display = ("source", "external_id", "content_type", "object_id", "match_confidence")
    list_filter = ("source", "content_type")
    search_fields = ("external_id", "object_id")


@admin.register(DataQualityIssue)
class DataQualityIssueAdmin(admin.ModelAdmin):
    list_display = ("issue_type", "status", "content_type", "object_id", "created_at")
    list_filter = ("issue_type", "status", "content_type")


from .models import HubTransferLink


@admin.register(HubTransferLink)
class HubTransferLinkAdmin(admin.ModelAdmin):
    list_display = (
        "from_content_type", "from_object_id", "to_content_type", "to_object_id",
        "mode", "distance_km", "typical_transfer_mins", "confidence",
    )
    list_filter = ("mode", "provenance_tier", "from_content_type", "to_content_type")


from .models import FareRule


@admin.register(FareRule)
class FareRuleAdmin(admin.ModelAdmin):
    list_display = (
        "category", "name", "scope", "service_class", "unit",
        "provenance_tier", "confidence", "valid_from", "valid_to", "is_active",
    )
    list_filter = ("category", "scope", "provenance_tier", "is_active")
    search_fields = ("name", "service_class")


# Phase 7 (knowledge application migration): relocated from apps.knowledge.
from .models import DistanceEdge, EntityEmbedding, LocalTip, PlaceInsight

admin.site.register(EntityEmbedding)
admin.site.register(DistanceEdge)
admin.site.register(PlaceInsight)
admin.site.register(LocalTip)
