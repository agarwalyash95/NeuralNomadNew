# Generated manually for the planner app scaffold.

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("reference", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="PlannerWorkspace",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("title", models.CharField(default="New Trip", max_length=160)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("active", "Active"),
                            ("completed", "Completed"),
                            ("archived", "Archived"),
                            ("booked", "Booked"),
                        ],
                        default="draft",
                        max_length=20,
                    ),
                ),
                (
                    "mode",
                    models.CharField(
                        choices=[
                            ("planning", "Planning"),
                            ("exploring", "Exploring"),
                            ("booking", "Booking"),
                            ("review", "Review"),
                            ("traveling", "Traveling"),
                            ("completed", "Completed"),
                        ],
                        default="planning",
                        max_length=20,
                    ),
                ),
                ("last_activity_at", models.DateTimeField(default=timezone.now)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="planner_workspaces",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "planner_workspace",
                "ordering": ["-last_activity_at", "-created_at"],
            },
        ),
        migrations.CreateModel(
            name="PlannerTrip",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("title", models.CharField(max_length=160)),
                ("summary", models.TextField(blank=True)),
                ("total_budget", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("spent_budget", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("currency_code", models.CharField(default="INR", max_length=3)),
                ("cities", models.JSONField(blank=True, default=list)),
                ("days", models.JSONField(blank=True, default=list)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "workspace",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="trip",
                        to="planner.plannerworkspace",
                    ),
                ),
            ],
            options={"db_table": "planner_trip"},
        ),
        migrations.CreateModel(
            name="PlannerChatMessage",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                (
                    "role",
                    models.CharField(
                        choices=[("user", "User"), ("assistant", "Assistant"), ("system", "System")],
                        max_length=20,
                    ),
                ),
                ("message", models.TextField()),
                ("widgets", models.JSONField(blank=True, default=list)),
                ("commands", models.JSONField(blank=True, default=list)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="chat_messages",
                        to="planner.plannerworkspace",
                    ),
                ),
            ],
            options={
                "db_table": "planner_chat_message",
                "ordering": ["created_at"],
            },
        ),
        migrations.CreateModel(
            name="TripDraftState",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("destination_text", models.CharField(blank=True, max_length=160)),
                ("start_date", models.DateField(blank=True, null=True)),
                ("end_date", models.DateField(blank=True, null=True)),
                ("adults", models.PositiveSmallIntegerField(default=1)),
                ("children", models.PositiveSmallIntegerField(default=0)),
                ("infants", models.PositiveSmallIntegerField(default=0)),
                ("budget_tier", models.CharField(blank=True, max_length=40)),
                ("budget_amount", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("budget_currency", models.CharField(default="INR", max_length=3)),
                ("interests", models.JSONField(blank=True, default=list)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                (
                    "destination_city",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="planner_drafts",
                        to="reference.city",
                    ),
                ),
                (
                    "workspace",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="draft_state",
                        to="planner.plannerworkspace",
                    ),
                ),
            ],
            options={"db_table": "planner_trip_draft_state"},
        ),
        migrations.AddIndex(
            model_name="plannerworkspace",
            index=models.Index(fields=["user", "-last_activity_at"], name="planner_wor_user_id_f48a1e_idx"),
        ),
        migrations.AddIndex(
            model_name="plannerworkspace",
            index=models.Index(fields=["status"], name="planner_wor_status_3abf3a_idx"),
        ),
        migrations.AddIndex(
            model_name="plannerchatmessage",
            index=models.Index(fields=["workspace", "created_at"], name="planner_cha_workspa_fcbfea_idx"),
        ),
    ]
