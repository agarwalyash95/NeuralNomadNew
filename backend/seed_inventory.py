import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.bookings.models import SearchInventory

def seed():
    SearchInventory.objects.all().delete()
    print("Deleted old inventory")

    inventory = [
        # FLIGHTS (Delhi to Mumbai)
        SearchInventory(
            service_type='flight', title='IndiGo', code='6E-2451',
            origin_city='Delhi', destination_city='Mumbai',
            origin_code='DEL', destination_code='BOM',
            departure_time='06:15', arrival_time='08:20', duration='2h 05m', stops=0,
            meta={'cabin_classes': [{'name': 'Economy', 'price': 5420}, {'name': 'Business', 'price': 18500}]},
            providers=[{'provider': 'Ixigo', 'price': 5420}, {'provider': 'MakeMyTrip', 'price': 5499}]
        ),
        SearchInventory(
            service_type='flight', title='Air India', code='AI-865',
            origin_city='Delhi', destination_city='Mumbai',
            origin_code='DEL', destination_code='BOM',
            departure_time='10:00', arrival_time='12:15', duration='2h 15m', stops=0,
            meta={'cabin_classes': [{'name': 'Economy', 'price': 6200}, {'name': 'Business', 'price': 22000}]},
            providers=[{'provider': 'Air India', 'price': 6200}, {'provider': 'Cleartrip', 'price': 6350}]
        ),
        
        # TRAINS (Delhi to Jaipur)
        SearchInventory(
            service_type='train', title='Ajmer Shatabdi', code='12015',
            origin_city='Delhi', destination_city='Jaipur',
            origin_code='NDLS', destination_code='JP',
            departure_time='06:10', arrival_time='10:40', duration='4h 30m', stops=3,
            meta={'classes': [
                {'code': 'CC', 'name': 'AC Chair Car', 'price': 850, 'availability': 'Available 94%'},
                {'code': 'EC', 'name': 'Exec Chair', 'price': 1650, 'availability': 'WL 12'}
            ]}
        ),
        SearchInventory(
            service_type='train', title='Vande Bharat Express', code='20978',
            origin_city='Delhi', destination_city='Jaipur',
            origin_code='DEC', destination_code='JP',
            departure_time='18:40', arrival_time='22:05', duration='3h 25m', stops=2,
            meta={'classes': [
                {'code': 'CC', 'name': 'AC Chair Car', 'price': 1050, 'availability': 'Available 45%'},
                {'code': 'EC', 'name': 'Exec Chair', 'price': 2015, 'availability': 'RAC 4'}
            ]}
        ),
        
        # HOTELS (Delhi)
        SearchInventory(
            service_type='hotel', title='The Leela Palace',
            origin_city='Delhi', destination_city='Delhi',
            duration='Check-in 14:00',
            meta={
                'stars': 5,
                'rating': 4.8,
                'reviews': 2450,
                'image': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800',
                'amenities': ['Pool', 'Spa', 'Free WiFi', 'Restaurant'],
                'rooms': [
                    {'name': 'Grande Deluxe', 'price_per_night': 18500, 'features': ['City View', 'King Bed']},
                    {'name': 'Royal Club', 'price_per_night': 25000, 'features': ['Lounge Access', 'King Bed']}
                ]
            }
        ),
        SearchInventory(
            service_type='hotel', title='Taj Mahal Hotel',
            origin_city='Delhi', destination_city='Delhi',
            duration='Check-in 14:00',
            meta={
                'stars': 5,
                'rating': 4.9,
                'reviews': 3120,
                'image': 'https://images.unsplash.com/photo-1542314831-c6a4d14d8c85?w=800',
                'amenities': ['Pool', 'Spa', 'Fitness Center'],
                'rooms': [
                    {'name': 'Luxury Room', 'price_per_night': 21000, 'features': ['Pool View', 'King Bed']}
                ]
            }
        ),
        
        # BUS (Bangalore to Goa)
        SearchInventory(
            service_type='bus', title='IntrCity SmartBus', code='AC Sleeper',
            origin_city='Bangalore', destination_city='Goa',
            departure_time='21:30', arrival_time='07:45+1', duration='10h 15m',
            meta={'cabin_classes': [{'name': 'AC Sleeper', 'price': 1450}]}
        ),
        SearchInventory(
            service_type='bus', title='Zingbus', code='Volvo Multi-Axle',
            origin_city='Bangalore', destination_city='Goa',
            departure_time='22:00', arrival_time='08:30+1', duration='10h 30m',
            meta={'cabin_classes': [{'name': 'Volvo AC Semi-Sleeper', 'price': 1200}]}
        ),
        
        # CABS (Delhi Airport)
        SearchInventory(
            service_type='cab', title='Uber', code='Sedan',
            origin_city='Delhi', destination_city='Delhi',
            duration='On Demand',
            meta={'cab_types': [{'name': 'Sedan', 'price_per_km': 15, 'base_fare': 250}]},
            providers=[{'provider': 'Uber', 'price': 850}]
        ),
        SearchInventory(
            service_type='cab', title='Ola', code='SUV',
            origin_city='Delhi', destination_city='Delhi',
            duration='On Demand',
            meta={'cab_types': [{'name': 'SUV', 'price_per_km': 22, 'base_fare': 350}]},
            providers=[{'provider': 'Ola', 'price': 1200}]
        )
    ]
    
    SearchInventory.objects.bulk_create(inventory)
    print(f"Created {len(inventory)} inventory records!")

if __name__ == '__main__':
    seed()
