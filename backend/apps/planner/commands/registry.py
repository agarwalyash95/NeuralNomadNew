from apps.planner.engine.command_executor import CommandExecutor

def load_commands():
    # Import handlers so they get registered
    from . import handlers
