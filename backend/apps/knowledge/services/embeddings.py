"""Phase 7 compatibility shim — real implementation relocated to
apps.reference.services.embeddings (same content, EntityEmbedding now lives
in apps.reference — same table, state-only move). Every real caller in this
codebase has been migrated to import from the new location directly; this
re-export exists only so anything still importing
`apps.knowledge.services.embeddings` keeps working unchanged.
"""

from apps.reference.services.embeddings import (  # noqa: F401
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    EMBEDDING_VERSION,
    compute_embeddings_backlog,
    embed_text,
    embedding_for,
    semantic_search,
    upsert_embedding,
    vector_search,
)
