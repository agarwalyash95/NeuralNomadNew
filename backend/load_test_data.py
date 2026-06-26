import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from apps.forex.models import ForexData, ForexVendor, VendorCurrencyInventory
from apps.visa.models import VisaData

def run():
    print("Loading test data...")
    
    # 1. Base Forex Data (Exchange Rates)
    rates_data = [
        {'currency': 'USD', 'exchange_rate': Decimal('83.50')},
        {'currency': 'EUR', 'exchange_rate': Decimal('90.20')},
        {'currency': 'GBP', 'exchange_rate': Decimal('105.80')},
        {'currency': 'AED', 'exchange_rate': Decimal('22.75')},
        {'currency': 'SGD', 'exchange_rate': Decimal('61.40')},
        {'currency': 'JPY', 'exchange_rate': Decimal('0.55')},
    ]
    
    for rd in rates_data:
        ForexData.objects.update_or_create(
            currency=rd['currency'],
            defaults={'exchange_rate': rd['exchange_rate'], 'source': 'Test Mock Data'}
        )
    print("Created ForexData records.")

    # 2. Forex Vendors
    vendor1, _ = ForexVendor.objects.update_or_create(
        name="Global Forex Exchange",
        defaults={
            'address': "123 Connaught Place, New Delhi",
            'contact_number': "9876543210",
            'rating': Decimal('4.8'),
            'is_delivery_available': True,
            'opening_hours': "9 AM - 8 PM"
        }
    )
    
    vendor2, _ = ForexVendor.objects.update_or_create(
        name="Express Money & Travels",
        defaults={
            'address': "Sector 29, Gurgaon",
            'contact_number': "9988776655",
            'rating': Decimal('4.2'),
            'is_delivery_available': False,
            'opening_hours': "10 AM - 7 PM"
        }
    )
    print("Created ForexVendors.")

    # 3. Vendor Inventory
    inventories = [
        (vendor1, 'USD', Decimal('84.00'), Decimal('50000.00')),
        (vendor1, 'EUR', Decimal('91.50'), Decimal('20000.00')),
        (vendor1, 'GBP', Decimal('106.50'), Decimal('15000.00')),
        (vendor2, 'USD', Decimal('83.90'), Decimal('10000.00')),
        (vendor2, 'AED', Decimal('23.00'), Decimal('100000.00')),
    ]
    
    for v, c, r, q in inventories:
        VendorCurrencyInventory.objects.update_or_create(
            vendor=v, currency=c,
            defaults={'exchange_rate': r, 'quantity_available': q, 'is_available': True}
        )
    print("Created Vendor Inventories.")

    # 4. Visa Data
    visa_data = [
        {
            'country': 'Japan',
            'visa_required': True,
            'visa_type': 'E-Visa or Sticker',
            'processing_time': '5-7 Working Days',
            'fees': Decimal('500.00'),
            'currency': 'INR',
            'validity': '3 Months',
            'entry_type': 'SINGLE',
            'max_stay_duration': '15 Days per visit',
            'required_documents': ['Valid Passport', '6 Months Bank Statement', 'ITR for 3 years', 'Flight Tickets'],
            'official_link': 'https://www.vfsglobal.com/japan/india/',
            'notes': 'Apply at VFS Global. E-Visa is now available for Indian nationals.'
        },
        {
            'country': 'Switzerland',
            'visa_required': True,
            'visa_type': 'Schengen Visa',
            'processing_time': '15 Working Days',
            'fees': Decimal('80.00'),
            'currency': 'EUR',
            'validity': 'Depending on itinerary',
            'entry_type': 'MULTIPLE',
            'max_stay_duration': '90 Days within 180 days',
            'required_documents': ['Valid Passport', 'Travel Insurance (min EUR 30,000)', 'Proof of accommodation', '3 months bank statements', 'Employer NOC'],
            'official_link': 'https://www.vfsglobal.ch/switzerland/india/',
            'notes': 'Biometric data submission required. Apply at Swiss VFS centre.'
        },
        {
            'country': 'Thailand',
            'visa_required': False,
            'visa_type': 'Visa Exemption',
            'processing_time': 'Instant on Arrival',
            'fees': Decimal('0.00'),
            'currency': 'THB',
            'validity': '30 Days',
            'entry_type': 'SINGLE',
            'max_stay_duration': '30 Days per visit',
            'required_documents': ['Valid Passport (6 months validity)', 'Return flight ticket', 'Proof of funds (10,000 THB)'],
            'notes': 'Temporary visa exemption for Indian passport holders. Subject to change; verify before travel.'
        },
        {
            'country': 'UAE',
            'visa_required': True,
            'visa_type': 'E-Visa',
            'processing_time': '2-3 Working Days',
            'fees': Decimal('300.00'),
            'currency': 'AED',
            'validity': '30 Days or 60 Days',
            'entry_type': 'SINGLE',
            'max_stay_duration': '30 Days per visit (extendable)',
            'required_documents': ['Passport copy (valid 6 months)', 'Recent passport-size photograph', 'Return flight ticket'],
            'notes': 'Apply through Emirates, Etihad, or an authorized travel agent.'
        },
        {
            'country': 'Singapore',
            'visa_required': True,
            'visa_type': 'Tourist Visa',
            'processing_time': '3-5 Working Days',
            'fees': Decimal('30.00'),
            'currency': 'SGD',
            'validity': '30 Days',
            'entry_type': 'SINGLE',
            'max_stay_duration': '30 Days per visit',
            'required_documents': ['Valid Passport', 'Bank Statement (3 months)', 'Flight and hotel bookings', 'Photo'],
            'official_link': 'https://www.ivacbd.com/singapore',
            'notes': 'Apply online via the Singapore Tourism Board e-Visa portal or through a travel agent.'
        },
        {
            'country': 'China',
            'visa_required': True,
            'visa_type': 'Sticker Visa',
            'processing_time': '4-5 Working Days',
            'fees': Decimal('3500.00'),
            'currency': 'INR',
            'validity': '3 Months',
            'entry_type': 'SINGLE',
            'max_stay_duration': '30 Days per visit',
            'required_documents': ['Valid Passport', 'Visa Application Form', 'Recent Photo', 'Flight and Hotel Booking'],
            'notes': 'Apply at the Chinese Visa Application Service Centre (CVASC).'
        },
    ]
    
    for vd in visa_data:
        VisaData.objects.update_or_create(
            country=vd['country'],
            defaults={
                'visa_required': vd['visa_required'],
                'visa_type': vd['visa_type'],
                'processing_time': vd['processing_time'],
                'fees': vd['fees'],
                'currency': vd['currency'],
                'validity': vd['validity'],
                'entry_type': vd.get('entry_type', 'UNKNOWN'),
                'max_stay_duration': vd.get('max_stay_duration', ''),
                'required_documents': vd['required_documents'],
                'official_link': vd.get('official_link', ''),
                'notes': vd.get('notes', '')
            }
        )
    print("Created VisaData records.")
    
    print("Done loading test data!")

if __name__ == '__main__':
    run()
