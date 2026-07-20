from decimal import Decimal, InvalidOperation
import uuid

from django.db import migrations, models
import django.db.models.deletion


def backfill_canonical_draft(apps, schema_editor):
    Draft = apps.get_model("planner", "TripDraftState")
    for draft in Draft.objects.all().iterator():
        meta = draft.metadata or {}
        changed = []
        if not draft.origin_text and meta.get("origin"):
            draft.origin_text = str(meta["origin"])[:160]
            changed.append("origin_text")
        if draft.budget_amount is None and meta.get("budget_inr") is not None:
            try:
                draft.budget_amount = Decimal(str(meta["budget_inr"]))
                draft.budget_currency = "INR"
                changed.extend(["budget_amount", "budget_currency"])
            except (InvalidOperation, TypeError, ValueError):
                pass
        if changed:
            draft.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [
        ("reference", "0011_railwaystation_coordinates"),
        ("planner", "0016_plannerchatmessage_turn_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="JourneyRouteCache",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("route_key", models.CharField(max_length=255, unique=True)),
                ("mode", models.CharField(db_index=True, max_length=20)),
                ("source_code", models.CharField(max_length=32)),
                ("destination_code", models.CharField(max_length=32)),
                ("travel_date", models.DateField(blank=True, null=True)),
                ("options", models.JSONField(blank=True, default=list)),
                ("provenance", models.CharField(default="estimated", max_length=32)),
                ("freshness", models.CharField(default="unknown", max_length=16)),
                ("source_name", models.CharField(blank=True, max_length=120)),
                ("as_of", models.DateTimeField(blank=True, null=True)),
                ("expires_at", models.DateTimeField(db_index=True)),
            ],
            options={
                "db_table": "planner_journey_route_cache",
            },
        ),
        migrations.AddField(
            model_name="tripdraftstate",
            name="origin_city",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="planner_origin_drafts",
                to="reference.city",
            ),
        ),
        migrations.AddField(
            model_name="tripdraftstate",
            name="origin_text",
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name="plangenerationjob",
            name="input_revision",
            field=models.PositiveBigIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="plangenerationjob",
            name="input_hash",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="plangenerationjob",
            name="quality_state",
            field=models.CharField(blank=True, default="", max_length=24),
        ),
        migrations.AddField(
            model_name="plangenerationjob",
            name="internal_score",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name="plangenerationjob",
            name="refinement_count",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="plangenerationjob",
            name="blockers",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="plangenerationjob",
            name="decision_trace",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name="plangenerationjob",
            name="status",
            field=models.CharField(
                choices=[
                    ("queued", "Queued"),
                    ("running", "Running"),
                    ("done", "Done"),
                    ("failed", "Failed"),
                    ("needs_input", "Needs input"),
                ],
                db_index=True,
                default="queued",
                max_length=12,
            ),
        ),
        migrations.RunPython(backfill_canonical_draft, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="journeyroutecache",
            index=models.Index(fields=["mode", "source_code", "destination_code"], name="planner_jou_mode_ae92f1_idx"),
        ),
    ]
