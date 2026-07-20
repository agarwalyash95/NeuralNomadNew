"""Data migration: backfill external_id=osm_id on OSM-imported rows.

import_osm_places.py's row-creation block set osm_id but never external_id,
so the 8,124 rows created by the Phase 6 pilot run fail
services.provenance.publishable()'s identity check (place_id OR external_id
required) and were never served from cache by places_explore.explore_places()
— every explore() call for an OSM-only city still made a live Google Places
call. The command is now fixed to set external_id=osm_id going forward; this
migration backfills existing rows.
"""

from django.db import migrations
from django.db.models import F, Q


def backfill_external_id(apps, schema_editor):
    for model_name in ("HotelMaster", "RestaurantMaster", "AttractionMaster"):
        model = apps.get_model("reference", model_name)
        model.objects.filter(
            Q(external_id__isnull=True) | Q(external_id=""),
        ).exclude(
            Q(osm_id__isnull=True) | Q(osm_id=""),
        ).update(external_id=F("osm_id"))


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("reference", "0019_phase7_placeinsight_localtip_columns"),
    ]

    operations = [
        migrations.RunPython(backfill_external_id, noop_reverse),
    ]
