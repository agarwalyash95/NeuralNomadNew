import logging

logger = logging.getLogger(__name__)

class CommandExecutor:
    """
    Executes commands outputted by the AI or UI.
    Maps command names to specific engine functions.
    """
    _registry = {}

    @classmethod
    def register(cls, command_name):
        def decorator(func):
            cls._registry[command_name] = func
            return func
        return decorator

    @classmethod
    def execute(cls, workspace, command_name, **kwargs):
        if command_name not in cls._registry:
            logger.error(f"Unknown command: {command_name}")
            return False
            
        logger.info(f"Executing {command_name} with args {kwargs}")
        try:
            return cls._registry[command_name](workspace, **kwargs)
        except Exception as e:
            logger.error(f"Error executing {command_name}: {e}")
            return False
