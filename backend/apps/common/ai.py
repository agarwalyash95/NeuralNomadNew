import logging
import os
from django.conf import settings
from google import genai

logger = logging.getLogger(__name__)

# Phase 0i: these used to be unconditional assignments, hardcoding the
# project id in source with no per-environment override. setdefault() keeps
# today's behavior identical when nothing else has set these (dev/local),
# while letting a real deployment configure its own project via env vars
# without a code change.
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "project-9932b05b-aa42-417e-be6")
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", "global")
# This project uses the standard Vertex AI generative API. The Enterprise
# Agent Platform flag routes requests to aiplatform.<region>.rep.googleapis.com
# instead, where publisher embedding models such as gemini-embedding-001 are
# not exposed. Remove that conflicting mode even if an old worker environment
# inherited it, and advertise the standard Vertex mode explicitly.
os.environ.pop("GOOGLE_GENAI_USE_ENTERPRISE", None)
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "True")

# Centralized model ids — see config/settings/base.py GEMINI_MODEL /
# GEMINI_MODEL_COMPOSE for the env-overridable source of truth. Import these
# instead of hardcoding "gemini-3.5-flash" at each call site.
DEFAULT_GEMINI_MODEL = getattr(settings, "GEMINI_MODEL", "gemini-3.5-flash")
COMPOSE_GEMINI_MODEL = getattr(settings, "GEMINI_MODEL_COMPOSE", DEFAULT_GEMINI_MODEL)
# Phase 5: milliseconds — see config/settings/base.py GEMINI_TIMEOUT_MS.
DEFAULT_GEMINI_TIMEOUT_MS = getattr(settings, "GEMINI_TIMEOUT_MS", 45000)
# See config/settings/base.py GEMINI_COMPOSE_TIMEOUT_MS — compose sends a
# structurally heavier request (full candidate catalog + itinerary
# sequencing) than skeleton, so it gets its own, longer budget.
DEFAULT_GEMINI_COMPOSE_TIMEOUT_MS = getattr(settings, "GEMINI_COMPOSE_TIMEOUT_MS", 90000)


def get_genai_client():
    """
    Returns an initialized unified GenAI Client.
    Supports either Vertex AI (configured via VERTEX_AI_ENABLED)
    or Google AI Studio (configured via GEMINI_API_KEY).
    """
    if getattr(settings, 'VERTEX_AI_ENABLED', False):
        logger.info("Initializing GenAI Client in Vertex AI mode. Project: %s, Location: %s", 
                    settings.VERTEX_AI_PROJECT, settings.VERTEX_AI_LOCATION)
        return genai.Client(
            vertexai=True,
            project=settings.VERTEX_AI_PROJECT,
            location=settings.VERTEX_AI_LOCATION
        )
        
    # Default to developer API key if provided
    gemini_key = getattr(settings, 'GEMINI_API_KEY', '')
    if gemini_key:
        logger.info("Initializing GenAI Client in Developer API mode using GEMINI_API_KEY.")
        return genai.Client(api_key=gemini_key)
        
    # Fallback to standard (uses GEMINI_API_KEY env variable)
    logger.info("Initializing GenAI Client in default Developer API mode.")
    return genai.Client()


def get_embedding_genai_client():
    """
    Same client factory as get_genai_client(), but pinned to
    VERTEX_AI_EMBEDDING_LOCATION for Vertex mode. gemini-embedding-001 isn't
    published to the "us" multi-region alias (404s there) even though
    generateContent is — this exists so fixing that 404 can't accidentally
    change the region every chat/generation call already runs against.
    """
    if getattr(settings, 'VERTEX_AI_ENABLED', False):
        logger.info("Initializing GenAI embedding client in Vertex AI mode. Project: %s, Location: %s",
                    settings.VERTEX_AI_PROJECT, settings.VERTEX_AI_EMBEDDING_LOCATION)
        return genai.Client(
            vertexai=True,
            project=settings.VERTEX_AI_PROJECT,
            location=settings.VERTEX_AI_EMBEDDING_LOCATION,
            http_options=genai.types.HttpOptions(api_version="v1"),
        )
    return get_genai_client()
