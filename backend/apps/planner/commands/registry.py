"""
Command registry — defines command type constants and lookup helpers.

The CommandExecutor in engine/command_executor.py is the actual execution
engine. This module provides a lightweight schema for documentation,
validation, and AI prompt generation.
"""

from . import COMMAND_TYPES, get_command_types, is_valid_command


def get_command_schema_for_ai() -> list[dict]:
    """
    Returns a simplified command schema list suitable for including
    in an AI system prompt so the model knows which commands it can emit.
    """
    schema = []
    for cmd_type, info in COMMAND_TYPES.items():
        entry = {
            'type': cmd_type,
            'description': info['description'],
            'category': info.get('category', 'general'),
        }
        if 'payload_schema' in info:
            entry['payload_fields'] = info['payload_schema']
        schema.append(entry)
    return schema


def validate_commands(commands: list[dict]) -> list[dict]:
    """
    Validate a list of commands and return validation results.

    Returns:
        [{'type': 'SET_DATES', 'valid': True}, ...]
    """
    results = []
    for cmd in commands:
        cmd_type = cmd.get('type', '')
        valid = is_valid_command(cmd_type)
        entry = {'type': cmd_type, 'valid': valid}
        if not valid:
            entry['error'] = f'Unknown command type: {cmd_type}'
        results.append(entry)
    return results
