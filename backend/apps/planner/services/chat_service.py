import logging
from apps.planner.models import WorkspaceChat
from apps.planner.providers.gemini_provider import GeminiProvider
from apps.planner.engine.command_executor import CommandExecutor

logger = logging.getLogger(__name__)

class ChatService:
    @staticmethod
    def process_message(workspace, content):
        # 1. Save user message
        WorkspaceChat.objects.create(workspace=workspace, role='user', content=content)

        # 2. Get provider
        provider = GeminiProvider()

        # 3. Generate response
        response_data = provider.generate_response(content)

        # 4. Execute commands
        for cmd in response_data.get('commands', []):
            CommandExecutor.execute(workspace, cmd['name'], **cmd.get('kwargs', {}))

        # 5. Save assistant response with widgets
        chat = WorkspaceChat.objects.create(
            workspace=workspace,
            role='assistant',
            content=response_data.get('text', ''),
            widgets=response_data.get('widgets', [])
        )
        return chat
