import os
import django
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.planner.models import PlannerWorkspace
from apps.planner.services.scenario_service import PlannerScenarioService
from django.contrib.auth import get_user_model

def run():
    User = get_user_model()
    user = User.objects.filter(email='yash30076472@gmail.com').first()
    if not user:
        print("No user found with that email.")
        sys.exit(1)

    print(f"Clearing all workspaces for user {user.email}...")
    workspaces = PlannerWorkspace.objects.filter(user=user)
    
    # Manually cascade delete to avoid FK violations
    for workspace in workspaces:
        if hasattr(workspace, 'trip'):
            from apps.planner.models import TripActivity
            TripActivity.objects.filter(day__trip=workspace.trip).delete()
            workspace.trip.days.all().delete()
            workspace.trip.cities.all().delete()
            workspace.trip.delete()
    workspaces.delete()

    print("Generating scenarios...")
    scenarios = [
        'flight-only',
        'hotel-only',
        'trip-3-days',
        'trip-5-days',
        'trip-7-days',
        'broken-trip'
    ]

    for scenario_name in scenarios:
        print(f"Generating {scenario_name}...")
        try:
            PlannerScenarioService.get_scenario(scenario_name)
            print(f"  OK: {scenario_name} created.")
        except Exception as e:
            print(f"  FAIL: Failed to create {scenario_name}: {e}")

    print("\nDone! You can now view all these trips in the frontend sidebar.")

if __name__ == '__main__':
    run()
