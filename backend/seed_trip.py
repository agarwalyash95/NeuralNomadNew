import os
import django
import sys
from decimal import Decimal
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from django.contrib.auth import get_user_model
from apps.planner.models import (
    PlannerWorkspace, PlannerTrip, TripCity, TripDay, TripActivity, WorkspaceStatus
)

User = get_user_model()

def run():
    print("Seeding rich mock trip...")
    
    # 1. Get or create a user
    user = User.objects.first()
    if not user:
        user = User.objects.create_user(username='test_user', email='test@example.com', password='password123')
    
    # 2. Get or create a workspace
    workspace, _ = PlannerWorkspace.objects.get_or_create(
        user=user,
        title='Japan Adventure: Tokyo & Kyoto',
        defaults={'status': WorkspaceStatus.ACTIVE}
    )
    
    # Update title in case it already existed
    workspace.title = 'Japan Adventure: Tokyo & Kyoto'
    workspace.save()

    # 3. Get or create the Trip Plan
    trip, _ = PlannerTrip.objects.get_or_create(
        workspace=workspace,
        defaults={
            'title': 'Japan Adventure: Tokyo & Kyoto',
            'summary': 'A 7-day adventure exploring the neon lights of Tokyo and the ancient temples of Kyoto.',
            'total_budget': Decimal('4500.00'),
            'spent_budget': Decimal('1200.00'),
            'currency_code': 'USD'
        }
    )
    
    # Clear old data for a fresh seed
    trip.cities.all().delete()
    trip.days.all().delete()
    
    # 4. Create Cities
    tokyo = TripCity.objects.create(
        trip=trip,
        name='Tokyo',
        country='Japan',
        order=1,
        nights=3,
        arrival_date=date(2026, 10, 1),
        departure_date=date(2026, 10, 4),
    )
    
    kyoto = TripCity.objects.create(
        trip=trip,
        name='Kyoto',
        country='Japan',
        order=2,
        nights=4,
        arrival_date=date(2026, 10, 4),
        departure_date=date(2026, 10, 8),
    )
    
    # 5. Create Days & Activities for Tokyo
    # Day 1: Arrival
    day1 = TripDay.objects.create(trip=trip, city=tokyo, day_number=1, date=date(2026, 10, 1), title="Arrival & Shinjuku")
    
    TripActivity.objects.create(
        day=day1, category='flight', order=1,
        title='Japan Airlines JL001', location_name='SFO to HND',
        start_time='10:00:00', estimated_cost=Decimal('850.00'),
        notes='Direct Flight • 11h 20m',
    )
    
    TripActivity.objects.create(
        day=day1, category='hotel', order=2,
        title='Shinjuku Prince Hotel', location_name='Shinjuku City, Tokyo',
        start_time='15:00:00', estimated_cost=Decimal('180.00'),
        notes='Elegant stay with panoramic city views and excellent transit access.',
        transport_mode='Subway', travel_time_minutes=45, distance_km=Decimal('20.5'),
        metadata={'ai_tip': 'Buy a Suica card at the station for easy transit.'}
    )
    
    TripActivity.objects.create(
        day=day1, category='restaurant', order=3,
        title='Ichiran Shinjuku', location_name='Shinjuku, Tokyo',
        start_time='19:30:00', estimated_cost=Decimal('15.00'),
        notes='Famous individual booth ramen.',
        transport_mode='Walk', travel_time_minutes=10, distance_km=Decimal('0.8'),
        metadata={'ai_tip': 'Expect a 20 min queue. Order the extra chashu!'}
    )
    
    # Day 2: Culture & Neon
    day2 = TripDay.objects.create(trip=trip, city=tokyo, day_number=2, date=date(2026, 10, 2), title="Culture & Neon")
    
    TripActivity.objects.create(
        day=day2, category='attraction', order=1,
        title='Senso-ji Temple', location_name='Asakusa, Tokyo',
        start_time='09:00:00', estimated_cost=Decimal('0.00'),
        notes='Tokyo\'s oldest and most significant Buddhist temple.',
        transport_mode='Subway', travel_time_minutes=35, distance_km=Decimal('12.0'),
        metadata={'ai_tip': 'Visit Nakamise shopping street leading up to the temple for snacks.'}
    )
    
    TripActivity.objects.create(
        day=day2, category='attraction', order=2,
        title='Tokyo Skytree', location_name='Sumida, Tokyo',
        start_time='14:00:00', estimated_cost=Decimal('25.00'),
        notes='Panoramic views from Japan\'s tallest structure.',
        transport_mode='Walk', travel_time_minutes=20, distance_km=Decimal('1.5'),
    )
    
    TripActivity.objects.create(
        day=day2, category='restaurant', order=3,
        title='Sushi Dai', location_name='Toyosu Market',
        start_time='18:00:00', estimated_cost=Decimal('45.00'),
        notes='Incredible Omakase sushi experience.',
        transport_mode='Cab', travel_time_minutes=25, distance_km=Decimal('8.5'),
    )
    
    # Day 3: Transfer to Kyoto
    day3 = TripDay.objects.create(trip=trip, city=tokyo, day_number=3, date=date(2026, 10, 3), title="Journey to Kansai")
    
    TripActivity.objects.create(
        day=day3, category='note', order=1,
        title='Check out of hotel', location_name='',
        start_time='09:00:00',
        notes='Ensure all bags are packed. Forward large luggage via Yamato Transport if needed.',
    )
    
    TripActivity.objects.create(
        day=day3, category='train', order=2,
        title='Shinkansen (Bullet Train)', location_name='Tokyo Station to Kyoto Station',
        start_time='11:00:00', estimated_cost=Decimal('120.00'),
        notes='Nozomi Super Express',
        transport_mode='Subway', travel_time_minutes=20, distance_km=Decimal('6.0'),
        metadata={'ai_tip': 'Sit on the right side (Seat E) for Mt. Fuji views!'}
    )
    
    TripActivity.objects.create(
        day=day3, category='hotel', order=3,
        title='Kyoto Granbell Hotel', location_name='Gion, Kyoto',
        start_time='15:00:00', estimated_cost=Decimal('150.00'),
        notes='Modern ryokan experience infused with traditional Kyoto aesthetics.',
        transport_mode='Cab', travel_time_minutes=15, distance_km=Decimal('4.5'),
    )
    
    TripActivity.objects.create(
        day=day3, category='attraction', order=4,
        title='Kiyomizu-dera', location_name='Higashiyama, Kyoto',
        start_time='16:30:00', estimated_cost=Decimal('4.00'),
        notes='Historic wooden temple with sweeping city views.',
        transport_mode='Walk', travel_time_minutes=20, distance_km=Decimal('1.2'),
        metadata={'ai_tip': 'Sunset from the wooden stage is breathtaking.'}
    )
    
    print(f"Successfully seeded trip for workspace: {workspace.id}")

if __name__ == '__main__':
    run()
