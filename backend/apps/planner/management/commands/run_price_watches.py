"""
The first standing agent task: re-check watched block prices and file
findings as PlanProposals. The watch NEVER mutates the plan — the user
accepts or rejects, same grammar as every other agent-initiated change.

Manual/CI entry point. The real schedule now runs via Celery beat
(apps.planner.tasks.run_price_watches, registered in CELERY_BEAT_SCHEDULE) —
this command calls the same implementation for local/manual use:
  python manage.py run_price_watches
"""

from django.core.management.base import BaseCommand

from apps.planner.tasks import _run_price_watches


class Command(BaseCommand):
    help = "Re-quote watched block prices; file drop findings as proposals."

    def handle(self, *args, **options):
        result = _run_price_watches()
        self.stdout.write(self.style.SUCCESS(
            f"Checked {result['checked']} watches, filed {result['filed']} proposals."
        ))
