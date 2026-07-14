import json
from apps.planner.models import PlannerTrip

trips = PlannerTrip.objects.all()
for trip in trips:
    for day in trip.days:
        for block in day.get('activities', []):
            if block.get('category') in ('flight', 'train', 'bus', 'cab'):
                print(f"Trip: {trip.title}, Mode: {block.get('category')}, Loc: {block.get('location_name')}".encode('ascii', 'ignore').decode('ascii'))
                print(f"  Title: {block.get('title')}".encode('ascii', 'ignore').decode('ascii'))
                print(f"  Metadata: {json.dumps(block.get('metadata', {}))}".encode('ascii', 'ignore').decode('ascii'))
