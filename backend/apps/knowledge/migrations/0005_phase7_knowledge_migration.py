# Phase 7 (knowledge application migration, master plan §12) — hand-written,
# not autodetector output as-is. Two distinct kinds of change, kept clearly
# separate:
#
#   1. Real deletion of 8 confirmed-dead models (zero readers/writers
#      anywhere outside this app, zero rows in every one of them — see
#      docs/plans/evidence/phase-07/backup-confirmation.md). Ordinary
#      DeleteModel operations: real DROP TABLE.
#
#   2. State-only relocation of 5 live models to apps.reference/apps.planner
#      (see reference.0018_phase7_knowledge_migration and
#      planner.0021_phase7_knowledge_migration for the paired CreateModel
#      state operations). Wrapped in SeparateDatabaseAndState with EMPTY
#      database_operations — Django's migration state forgets these models
#      belonged to `knowledge`, but the real tables (knowledge_entityembedding
#      etc.), all data, and — critically — the entity_embedding_hnsw pgvector
#      index are never touched. This is Django's documented "moving a model
#      between apps" recipe; the autodetector's own proposal was a real
#      DeleteModel for these 5 too, which would have dropped and lost them —
#      corrected by hand.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("knowledge", "0004_neighbourhood_locality_and_more"),
        # Ensures the new owning apps' CreateModel state operations exist
        # before this migration's state removal runs.
        ("reference", "0018_phase7_knowledge_migration"),
        ("planner", "0021_phase7_knowledge_migration"),
    ]

    operations = [
        # --- Real deletion: 8 confirmed-dead models -----------------------
        migrations.DeleteModel(name="CrowdPattern"),
        migrations.DeleteModel(name="EmergencyContact"),
        migrations.DeleteModel(name="Event"),
        migrations.DeleteModel(name="EntityInteractionLog"),
        migrations.DeleteModel(name="Neighbourhood"),
        migrations.DeleteModel(name="PlaceRelationship"),
        migrations.DeleteModel(name="SafetyAdvisory"),
        migrations.DeleteModel(name="TransitOutcomeLog"),

        # --- State-only relocation: 5 live models --------------------------
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name="EntityEmbedding"),
                migrations.DeleteModel(name="DistanceEdge"),
                migrations.DeleteModel(name="PlaceInsight"),
                migrations.DeleteModel(name="LocalTip"),
                migrations.DeleteModel(name="PlanInsightDismissal"),
            ],
            database_operations=[],
        ),
    ]
