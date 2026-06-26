import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.bookings.models import Location

def seed():
    Location.objects.all().delete()
    print("Deleted old locations")

    locations = [
        # AIRPORTS
        Location(name='Indira Gandhi International Airport', city='Delhi', code='DEL', location_type='airport'),
        Location(name='Chhatrapati Shivaji Maharaj International Airport', city='Mumbai', code='BOM', location_type='airport'),
        Location(name='Kempegowda International Airport', city='Bangalore', code='BLR', location_type='airport'),
        Location(name='Netaji Subhash Chandra Bose International Airport', city='Kolkata', code='CCU', location_type='airport'),
        Location(name='Rajiv Gandhi International Airport', city='Hyderabad', code='HYD', location_type='airport'),
        Location(name='Chennai International Airport', city='Chennai', code='MAA', location_type='airport'),
        Location(name='Goa International Airport', city='Goa', code='GOI', location_type='airport'),
        Location(name='Jaipur International Airport', city='Jaipur', code='JAI', location_type='airport'),

        # STATIONS
        Location(name='New Delhi Railway Station', city='Delhi', code='NDLS', location_type='station'),
        Location(name='Delhi Cantt', city='Delhi', code='DEC', location_type='station'),
        Location(name='Chhatrapati Shivaji Terminus', city='Mumbai', code='CSTM', location_type='station'),
        Location(name='Mumbai Central', city='Mumbai', code='MMCT', location_type='station'),
        Location(name='Krantivira Sangolli Rayanna Railway Station', city='Bangalore', code='SBC', location_type='station'),
        Location(name='Howrah Junction', city='Kolkata', code='HWH', location_type='station'),
        Location(name='Jaipur Junction', city='Jaipur', code='JP', location_type='station'),
        Location(name='Ahmedabad Junction', city='Ahmedabad', code='ADI', location_type='station'),

        # CITIES (For Bus, Hotels, Cabs generic)
        Location(name='Delhi', city='Delhi', location_type='city'),
        Location(name='Mumbai', city='Mumbai', location_type='city'),
        Location(name='Bangalore', city='Bangalore', location_type='city'),
        Location(name='Kolkata', city='Kolkata', location_type='city'),
        Location(name='Goa', city='Goa', location_type='city'),
        Location(name='Jaipur', city='Jaipur', location_type='city'),
        Location(name='Agra', city='Agra', location_type='city'),
        Location(name='Pune', city='Pune', location_type='city'),
    ]

    Location.objects.bulk_create(locations)
    print(f"Created {len(locations)} location records!")

if __name__ == '__main__':
    seed()
