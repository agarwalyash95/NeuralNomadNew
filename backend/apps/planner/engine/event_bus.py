import logging

logger = logging.getLogger(__name__)

class EventBus:
    """
    A simple synchronous in-memory pub/sub event bus for the planner engine.
    In a distributed system this would be Redis/Kafka/RabbitMQ.
    """
    _subscribers = {}

    @classmethod
    def subscribe(cls, event_type, handler):
        if event_type not in cls._subscribers:
            cls._subscribers[event_type] = []
        if handler not in cls._subscribers[event_type]:
            cls._subscribers[event_type].append(handler)
            logger.info(f"Subscribed {handler.__name__} to {event_type}")

    @classmethod
    def publish(cls, event_type, **kwargs):
        logger.info(f"Publishing event {event_type} with payload {kwargs}")
        handlers = cls._subscribers.get(event_type, [])
        for handler in handlers:
            try:
                handler(**kwargs)
            except Exception as e:
                logger.error(f"Error in event handler {handler.__name__} for {event_type}: {e}")

# Commonly used event types
class Events:
    ACTIVITY_ADDED = "ACTIVITY_ADDED"
    ACTIVITY_UPDATED = "ACTIVITY_UPDATED"
    ACTIVITY_REMOVED = "ACTIVITY_REMOVED"
    CANVAS_UPDATED = "CANVAS_UPDATED"
    BUDGET_CHANGED = "BUDGET_CHANGED"
    TRIP_DATES_CHANGED = "TRIP_DATES_CHANGED"
    CITY_ADDED = "CITY_ADDED"
