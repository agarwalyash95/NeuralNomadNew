from django.apps import AppConfig


class PlannerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.planner'
    verbose_name = 'AI Planner'

    def ready(self):
        """Register event handlers on app startup."""
        from .engine.event_bus import register_default_handlers
        register_default_handlers()
