"""
Chat Service — orchestrates AI call → command execution → response.
"""

import logging
from apps.planner.models import PlannerWorkspace, WorkspaceChat, ChatRole
from apps.planner.engine.command_executor import CommandExecutor
from apps.planner.engine.memory_manager import MemoryManager
from apps.planner.providers.gemini_provider import GeminiProvider

logger = logging.getLogger(__name__)


class ChatService:
    """
    Orchestrates the chat flow:
    1. User sends message
    2. Build context from PlannerMemory
    3. Call AI Provider
    4. Execute commands
    5. Save messages
    6. Return response
    """

    def __init__(self):
        self.ai_provider = GeminiProvider()
        self.command_executor = CommandExecutor()
        self.memory_manager = MemoryManager()

    def process_message(self, workspace_id: str, message: str) -> dict:
        """Process a user message and return AI response."""
        workspace = PlannerWorkspace.objects.get(id=workspace_id)

        # 1. Save user message
        user_chat = WorkspaceChat.objects.create(
            workspace=workspace,
            role=ChatRole.USER,
            message=message,
        )

        # 2. Build conversation history
        history = list(
            WorkspaceChat.objects.filter(
                workspace=workspace, is_deleted=False,
            ).order_by('-created_at')[:20].values('role', 'message')
        )
        history.reverse()

        # 3. Get AI context from memory
        memory_context = self.memory_manager.get_ai_context(workspace_id)

        # 4. Call AI provider
        ai_response = self.ai_provider.generate_response(
            message=message,
            conversation_history=history,
            memory_context=memory_context,
        )

        # 5. Execute commands
        commands = ai_response.get('commands', [])
        command_results = []
        if commands:
            command_results = self.command_executor.execute(workspace_id, commands)

        # 6. Save assistant message
        assistant_chat = WorkspaceChat.objects.create(
            workspace=workspace,
            role=ChatRole.ASSISTANT,
            message=ai_response.get('response_text', ''),
            widgets=ai_response.get('widgets', []),
            commands=commands,
        )

        # 7. Update workspace status
        if workspace.status == 'draft':
            workspace.status = 'active'
            workspace.save(update_fields=['status'])

        return {
            'user_message': {
                'id': str(user_chat.id),
                'role': 'user',
                'message': message,
                'created_at': user_chat.created_at.isoformat(),
            },
            'assistant_message': {
                'id': str(assistant_chat.id),
                'role': 'assistant',
                'message': ai_response.get('response_text', ''),
                'widgets': ai_response.get('widgets', []),
                'commands': commands,
                'created_at': assistant_chat.created_at.isoformat(),
            },
            'command_results': command_results,
        }
