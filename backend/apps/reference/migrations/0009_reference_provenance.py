from django.db import migrations, models
from django.db.models import F, Q
from django.utils import timezone


MASTER_MODELS = ("HotelMaster", "RestaurantMaster", "AttractionMaster", "ActivityMaster")


def backfill_provenance(apps, schema_editor):
    now = timezone.now()
    for model_name in MASTER_MODELS:
        model = apps.get_model("reference", model_name)
        has_place_id = Q(place_id__isnull=False) & ~Q(place_id="")
        model.objects.filter(source="google_places").filter(has_place_id).update(
            external_id=F("place_id"), verification_status="verified", verified_at=now,
            is_quarantined=False, provenance_metadata={"backfill_rule": "google_place_id"},
        )
        model.objects.filter(source="google_places").exclude(has_place_id).update(
            verification_status="quarantined", is_quarantined=True,
            provenance_metadata={"backfill_rule": "google_missing_place_id"},
        )
        model.objects.filter(source="manual").update(
            verification_status="verified", verified_at=now, is_quarantined=False,
            provenance_metadata={"backfill_rule": "explicit_manual_source"},
        )
        model.objects.exclude(source__in=["google_places", "manual"]).filter(has_place_id).update(
            external_id=F("place_id"), verification_status="verified", verified_at=now,
            is_quarantined=False, provenance_metadata={"backfill_rule": "non_google_external_id"},
        )


def reverse_backfill(apps, schema_editor):
    for model_name in MASTER_MODELS:
        apps.get_model("reference", model_name).objects.update(
            external_id=None, verification_status="unverified", verified_at=None,
            provenance_metadata={}, is_quarantined=False,
        )


def provenance_fields(model_name):
    return [
        migrations.AddField(model_name=model_name, name="external_id", field=models.CharField(blank=True, db_index=True, max_length=255, null=True)),
        migrations.AddField(model_name=model_name, name="verification_status", field=models.CharField(choices=[("verified", "Verified"), ("unverified", "Unverified"), ("quarantined", "Quarantined")], db_index=True, default="unverified", max_length=20)),
        migrations.AddField(model_name=model_name, name="verified_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name=model_name, name="provenance_metadata", field=models.JSONField(blank=True, default=dict)),
        migrations.AddField(model_name=model_name, name="is_quarantined", field=models.BooleanField(db_index=True, default=False)),
    ]


class Migration(migrations.Migration):
    dependencies = [("reference", "0008_delete_currency_delete_googleplacecache_and_more")]
    operations = []
    for _model_name in ("hotelmaster", "restaurantmaster", "attractionmaster", "activitymaster"):
        operations.extend(provenance_fields(_model_name))
    operations.append(migrations.RunPython(backfill_provenance, reverse_backfill))
