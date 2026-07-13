import logging
from django.conf import settings
from google import genai

logger = logging.getLogger(__name__)

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
