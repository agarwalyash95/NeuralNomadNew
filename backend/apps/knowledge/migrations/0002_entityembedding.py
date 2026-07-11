# EntityEmbedding needs the Postgres pgvector extension (VectorField + HnswIndex).
# The stack is PostgreSQL-only (docker-compose runs the pgvector/pgvector image,
# and infra/postgres/init-pgvector.sql pre-creates the extension), so this
# migration applies unconditionally — there is no other engine to guard for.

import pgvector.django.indexes
import pgvector.django.vector
import uuid
from django.db import migrations, models
import django.db.models.deletion
from pgvector.django import VectorExtension


class Migration(migrations.Migration):

    dependencies = [
        ("contenttypes", "0002_remove_content_type_name"),
        ("knowledge", "0001_initial"),
    ]

    operations = [
        VectorExtension(),
        migrations.CreateModel(
            name="EntityEmbedding",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("is_deleted", models.BooleanField(default=False)),
                ("deleted_at", models.DateTimeField(blank=True, null=True)),
                ("object_id", models.CharField(max_length=64)),
                ("embedding", pgvector.django.vector.VectorField(dimensions=768)),
                ("embedding_version", models.CharField(max_length=40)),
                ("source_text_hash", models.CharField(max_length=64)),
                (
                    "content_type",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="+",
                        to="contenttypes.contenttype",
                    ),
                ),
            ],
            options={
                "indexes": [
                    pgvector.django.indexes.HnswIndex(
                        ef_construction=64,
                        fields=["embedding"],
                        m=16,
                        name="entity_embedding_hnsw",
                        opclasses=["vector_cosine_ops"],
                    )
                ],
                "unique_together": {("content_type", "object_id", "embedding_version")},
            },
        ),
    ]
