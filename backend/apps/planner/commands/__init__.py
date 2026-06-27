"""
Command type registry — all supported command types and their metadata.
"""


# ─── Command Types ───────────────────────────────────

COMMAND_TYPES = {
    # Context commands
    'SET_CONTEXT': {
        'description': 'Update trip parameters',
        'category': 'context',
        'requires_payload': True,
    },
    'SET_DATES': {
        'description': 'Set travel dates',
        'category': 'context',
        'requires_payload': True,
        'payload_schema': {'start_date': 'str', 'end_date': 'str'},
    },
    'SET_TRAVELERS': {
        'description': 'Set traveler count',
        'category': 'context',
        'requires_payload': True,
        'payload_schema': {'adults': 'int', 'children': 'int', 'infants': 'int'},
    },
    'SET_BUDGET': {
        'description': 'Set budget range',
        'category': 'context',
        'requires_payload': True,
        'payload_schema': {'amount': 'float', 'currency': 'str'},
    },
    'ADD_DESTINATION': {
        'description': 'Add city to itinerary',
        'category': 'context',
        'requires_payload': True,
    },
    'REMOVE_DESTINATION': {
        'description': 'Remove city from itinerary',
        'category': 'context',
        'requires_payload': True,
    },
    'SET_TRAVEL_STYLE': {
        'description': 'Set travel style preference',
        'category': 'context',
        'requires_payload': True,
        'payload_schema': {'style': 'str'},
    },
    'SET_INTERESTS': {
        'description': 'Set interest categories',
        'category': 'context',
        'requires_payload': True,
        'payload_schema': {'interests': 'list'},
    },

    # Canvas commands
    'OPEN_CANVAS': {
        'description': 'Open an execution canvas',
        'category': 'canvas',
        'requires_payload': True,
        'payload_schema': {'canvas_type': 'str'},
    },

    # Search commands
    'SEARCH_FLIGHTS': {
        'description': 'Pre-fill flight search',
        'category': 'search',
        'requires_payload': True,
        'payload_schema': {
            'canvas_type': 'str',
            'from_code': 'str',
            'to_code': 'str',
            'date': 'str',
        },
    },
    'SEARCH_HOTELS': {
        'description': 'Pre-fill hotel search',
        'category': 'search',
        'requires_payload': True,
        'payload_schema': {
            'canvas_type': 'str',
            'city': 'str',
            'check_in': 'str',
            'check_out': 'str',
        },
    },
    'SEARCH_TRAINS': {
        'description': 'Pre-fill train search',
        'category': 'search',
        'requires_payload': True,
        'payload_schema': {
            'canvas_type': 'str',
            'from_station': 'str',
            'to_station': 'str',
            'date': 'str',
        },
    },
    'SEARCH_BUSES': {
        'description': 'Pre-fill bus search',
        'category': 'search',
        'requires_payload': True,
        'payload_schema': {
            'canvas_type': 'str',
            'from_city': 'str',
            'to_city': 'str',
            'date': 'str',
        },
    },

    # Activity commands
    'ADD_ACTIVITY': {
        'description': 'Add activity to timeline',
        'category': 'activity',
        'requires_payload': True,
    },
    'REMOVE_ACTIVITY': {
        'description': 'Remove from timeline',
        'category': 'activity',
        'requires_payload': True,
    },
    'MOVE_ACTIVITY': {
        'description': 'Reorder in timeline',
        'category': 'activity',
        'requires_payload': True,
    },

    # Booking commands
    'ADD_TO_CART': {
        'description': 'Add booking to cart',
        'category': 'booking',
        'requires_payload': True,
    },

    # Travel prep commands
    'CHECK_VISA': {
        'description': 'Open visa canvas',
        'category': 'canvas',
        'requires_payload': False,
    },
    'CHECK_FOREX': {
        'description': 'Open forex canvas',
        'category': 'canvas',
        'requires_payload': False,
    },

    # Engine commands
    'RECALCULATE_PLAN': {
        'description': 'Trigger route recalculation',
        'category': 'engine',
        'requires_payload': False,
    },
    'GENERATE_RECOMMENDATIONS': {
        'description': 'Generate AI recommendations',
        'category': 'engine',
        'requires_payload': False,
    },
    'SET_MODE': {
        'description': 'Switch workspace mode',
        'category': 'workspace',
        'requires_payload': True,
        'payload_schema': {'mode': 'str'},
    },
}


def get_command_types() -> list[str]:
    """Return all registered command type names."""
    return list(COMMAND_TYPES.keys())


def get_command_info(cmd_type: str) -> dict | None:
    """Return metadata for a command type."""
    return COMMAND_TYPES.get(cmd_type)


def is_valid_command(cmd_type: str) -> bool:
    """Check if a command type is registered."""
    return cmd_type in COMMAND_TYPES


def get_commands_by_category(category: str) -> list[str]:
    """Return command types filtered by category."""
    return [
        cmd for cmd, info in COMMAND_TYPES.items()
        if info.get('category') == category
    ]
