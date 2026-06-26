"""
Gemini AI Provider — structured output for commands and widgets.
"""

import json
import logging
from django.conf import settings
from .base import AIProvider

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are NeuralNomad AI — an expert travel planning assistant.
You help users plan trips by understanding their intent and generating structured commands.

IMPORTANT: You must respond with valid JSON containing:
1. "response_text": Your conversational reply to the user
2. "widgets": UI widgets to render in the chat (array of objects)
3. "commands": Structured commands for the planner engine (array of objects)

Widget types: text, destination_card, date_picker, budget_slider, traveler_selector,
              option_buttons, checklist, confirmation_card, recommendation_card, quick_actions

Command types: SET_CONTEXT, SET_DATES, SET_TRAVELERS, SET_BUDGET, ADD_DESTINATION,
               SET_TRAVEL_STYLE, SET_INTERESTS, OPEN_CANVAS, SEARCH_FLIGHTS,
               SEARCH_HOTELS, SEARCH_TRAINS, ADD_ACTIVITY, RECALCULATE_PLAN,
               GENERATE_RECOMMENDATIONS, SET_MODE

When a user mentions a destination, create a SET_CONTEXT command with {destination: {city, country}}.
When they mention dates, create SET_DATES with {start_date, end_date}.
When they mention budget, create SET_BUDGET with {amount, currency}.
When they want to search flights/hotels, create the appropriate SEARCH_ command and OPEN_CANVAS.

Always be helpful, proactive, and suggest next steps.
"""


class GeminiProvider(AIProvider):
    """Gemini AI provider implementation."""

    def __init__(self):
        self.api_key = getattr(settings, 'GEMINI_API_KEY', '')
        self.model = None

        if self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel(
                    model_name='gemini-2.0-flash',
                    system_instruction=SYSTEM_PROMPT,
                    generation_config={
                        'response_mime_type': 'application/json',
                        'temperature': 0.7,
                    },
                )
                logger.info("Gemini provider initialized")
            except Exception as e:
                logger.warning(f"Gemini initialization failed: {e}")

    def generate_response(
        self,
        message: str,
        conversation_history: list[dict],
        memory_context: dict,
        plan_summary: dict | None = None,
    ) -> dict:
        """Generate AI response with structured commands."""

        if not self.model:
            return self._fallback_response(message, memory_context)

        try:
            # Build context prompt
            context_prompt = self._build_context_prompt(memory_context, plan_summary)

            # Build conversation for Gemini
            chat_history = []
            for msg in conversation_history[-10:]:  # Last 10 messages
                role = 'user' if msg['role'] == 'user' else 'model'
                chat_history.append({'role': role, 'parts': [msg['message']]})

            chat = self.model.start_chat(history=chat_history)

            # Send message with context
            full_message = f"{context_prompt}\n\nUser message: {message}"
            response = chat.send_message(full_message)

            # Parse JSON response
            result = json.loads(response.text)
            return {
                'response_text': result.get('response_text', ''),
                'widgets': result.get('widgets', []),
                'commands': result.get('commands', []),
            }

        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return self._fallback_response(message, memory_context)

    def _build_context_prompt(self, memory_context: dict, plan_summary: dict | None) -> str:
        """Build context prompt from structured memory."""
        parts = ["Current trip context:"]

        if memory_context.get('destination'):
            parts.append(f"- Destination: {json.dumps(memory_context['destination'])}")
        if memory_context.get('origin'):
            parts.append(f"- Origin: {json.dumps(memory_context['origin'])}")
        if memory_context.get('dates'):
            parts.append(f"- Dates: {json.dumps(memory_context['dates'])}")
        if memory_context.get('travelers'):
            parts.append(f"- Travelers: {json.dumps(memory_context['travelers'])}")
        if memory_context.get('budget'):
            parts.append(f"- Budget: {json.dumps(memory_context['budget'])}")

        if memory_context.get('conversation_summary'):
            parts.append(f"\nConversation summary: {memory_context['conversation_summary']}")

        return '\n'.join(parts) if len(parts) > 1 else ''

    def _fallback_response(self, message: str, memory_context: dict) -> dict:
        """Fallback when Gemini is unavailable — provides intelligent mock responses."""
        message_lower = message.lower()
        commands = []
        widgets = []

        # Detect destination intent
        destinations = {
            'goa': {'city': 'Panaji', 'country': 'India', 'region': 'Goa'},
            'delhi': {'city': 'New Delhi', 'country': 'India'},
            'mumbai': {'city': 'Mumbai', 'country': 'India'},
            'jaipur': {'city': 'Jaipur', 'country': 'India', 'region': 'Rajasthan'},
            'tokyo': {'city': 'Tokyo', 'country': 'Japan'},
            'bali': {'city': 'Bali', 'country': 'Indonesia'},
            'bangkok': {'city': 'Bangkok', 'country': 'Thailand'},
            'singapore': {'city': 'Singapore', 'country': 'Singapore'},
            'dubai': {'city': 'Dubai', 'country': 'UAE'},
        }

        response_text = "I'd love to help you plan your trip! "
        detected_dest = None

        for key, dest in destinations.items():
            if key in message_lower:
                detected_dest = dest
                commands.append({
                    'type': 'SET_CONTEXT',
                    'payload': {'destination': dest},
                })
                response_text = f"Great choice! {dest['city']} is an amazing destination. "
                widgets.append({
                    'type': 'destination_card',
                    'data': dest,
                })
                break

        if not detected_dest and not memory_context.get('destination'):
            response_text += "Where would you like to go?"
            widgets.append({
                'type': 'option_buttons',
                'data': {
                    'options': ['Goa', 'Jaipur', 'Tokyo', 'Bali', 'Bangkok', 'Dubai'],
                    'label': 'Popular destinations',
                },
            })
        elif detected_dest:
            response_text += "When are you planning to travel?"
            widgets.append({
                'type': 'date_picker',
                'data': {'label': 'Select travel dates'},
            })
            commands.append({
                'type': 'GENERATE_RECOMMENDATIONS',
                'payload': {},
            })

        return {
            'response_text': response_text,
            'widgets': widgets,
            'commands': commands,
        }
