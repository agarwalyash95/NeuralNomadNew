import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.planner.models import PlannerTrip
from apps.planner.services.block_enrichment import enrich_transport_block

updated = 0
for trip in PlannerTrip.objects.all():
    changed = False
    for day in trip.days or []:
        for key in ['activities', 'items']:
            for item in day.get(key, []) or []:
                kind = item.get('type') or item.get('category')
                if kind in ('flight', 'train', 'bus', 'cab', 'taxi'):
                    before_dest = item.get('destinationCode')
                    enrich_transport_block(trip, item)
                    if item.get('destinationCode') != before_dest:
                        changed = True
                        print(f"Enriched {item.get('title')} to {item.get('destinationCode')} in trip {trip.id}")
    if changed:
        trip.save(update_fields=['days', 'updated_at'])
        updated += 1

print(f'Done. Updated {updated} trips.')
