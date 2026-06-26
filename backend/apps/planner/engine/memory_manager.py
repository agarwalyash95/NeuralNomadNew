"""
Memory Manager — maintains structured AI memory.
Updated after every chat interaction so the AI always has fresh context.
"""

import logging
from apps.planner.models import PlannerMemory, PlannerWorkspace

logger = logging.getLogger(__name__)


class MemoryManager:
    """
    Manages PlannerMemory — the structured context the AI reads.
    This is NOT chat history. It's a curated summary of what the AI needs to know.
    """

    def get_or_create_memory(self, workspace_id: str) -> PlannerMemory:
        workspace = PlannerWorkspace.objects.get(id=workspace_id)
        memory, _ = PlannerMemory.objects.get_or_create(workspace=workspace)
        return memory

    def update_memory(self, workspace_id: str, updates: dict) -> PlannerMemory:
        """Update specific memory fields."""
        memory = self.get_or_create_memory(workspace_id)

        for field, value in updates.items():
            if hasattr(memory, field):
                setattr(memory, field, value)

        memory.save()
        logger.info(f"Memory updated for workspace {workspace_id}")
        return memory

    def get_ai_context(self, workspace_id: str) -> dict:
        """
        Build the structured context blob that gets sent to the AI provider.
        This is what the AI reads instead of scanning old messages.
        """
        memory = self.get_or_create_memory(workspace_id)

        return {
            'destination': memory.destination,
            'origin': memory.origin,
            'dates': memory.dates,
            'travelers': memory.travelers,
            'budget': memory.budget,
            'preferences': {
                'transportation': memory.transportation_preference,
                'hotel': memory.hotel_preference,
                'interests': memory.interests,
                'food': memory.food_preference,
                'accessibility': memory.accessibility,
            },
            'status': {
                'visa': memory.visa_status,
                'bookings': memory.booking_summary,
                'current_phase': memory.current_phase,
            },
            'conversation_summary': memory.conversation_summary,
            'last_action': memory.last_ai_action,
        }

    def update_from_commands(self, workspace_id: str, commands: list[dict]):
        """Update memory based on executed commands."""
        memory = self.get_or_create_memory(workspace_id)

        for cmd in commands:
            cmd_type = cmd.get('type', '')
            payload = cmd.get('payload', {})

            if cmd_type == 'SET_CONTEXT':
                if 'destination' in payload:
                    memory.destination = payload['destination']
                if 'origin' in payload:
                    memory.origin = payload['origin']

            elif cmd_type == 'SET_DATES':
                memory.dates = payload

            elif cmd_type == 'SET_TRAVELERS':
                memory.travelers = payload

            elif cmd_type == 'SET_BUDGET':
                memory.budget = payload

            elif cmd_type == 'SET_TRAVEL_STYLE':
                if 'interests' in payload:
                    memory.interests = payload.get('interests', [])

            elif cmd_type == 'SET_INTERESTS':
                memory.interests = payload.get('interests', [])

            memory.last_ai_action = {
                'type': cmd_type,
                'payload': payload,
            }

        memory.save()
        logger.info(f"Memory updated from {len(commands)} commands for workspace {workspace_id}")
