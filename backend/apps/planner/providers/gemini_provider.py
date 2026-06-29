import json
import logging
from django.conf import settings
from .base import AIProvider

logger = logging.getLogger(__name__)

class GeminiProvider(AIProvider):
    """
    Implementation of Gemini AI provider.
    """
    def __init__(self):
        # In a real scenario, initialize google-generativeai here
        self.api_key = getattr(settings, 'GEMINI_API_KEY', None)

    def generate_response(self, prompt, context=None):
        logger.info(f"Mock calling Gemini with prompt: {prompt}")
        
        # Mock logic. In a real system, you'd send context + prompt to Gemini
        # and request structured output containing regular text + commands
        return {
            "text": "I can help with that. Let me prepare a canvas for you.",
            "commands": [
                {
                    "name": "OPEN_CANVAS",
                    "kwargs": {
                        "canvas_type": "flight",
                        "search_params": {"source": "DEL", "destination": "BOM"}
                    }
                }
            ],
            "widgets": [
                {
                    "type": "UpdatePlanCard",
                    "data": {"title": "Flight Search Prepared"}
                }
            ]
        }

    def parse_commands(self, response_text):
        # We assume the structured response is already parsed into dicts above
        pass
