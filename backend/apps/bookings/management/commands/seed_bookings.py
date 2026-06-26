from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from apps.bookings.models import Booking

User = get_user_model()


class Command(BaseCommand):
    help = "Seed booking inventory"

    def handle(self, *args, **kwargs):

        user = User.objects.first()

        if not user:
            self.stdout.write(
                self.style.ERROR(
                    "Create a user first"
                )
            )
            return

        Booking.objects.all().delete()

        sample_bookings = [

            {
                "booking_type": "flight",
                "reference_number": "FL001",
                "status": "pending",
                "amount": 5500,
                "start_date": "2026-07-15",
                "details": {
                    "origin": "Kolkata",
                    "destination": "Delhi",
                    "airline": "IndiGo"
                }
            },

            {
                "booking_type": "train",
                "reference_number": "TR001",
                "status": "pending",
                "amount": 1200,
                "start_date": "2026-07-15",
                "details": {
                    "origin": "Howrah",
                    "destination": "Patna",
                    "train_number": "12301"
                }
            },

            {
                "booking_type": "bus",
                "reference_number": "BS001",
                "status": "pending",
                "amount": 850,
                "start_date": "2026-07-16",
                "details": {
                    "origin": "Durgapur",
                    "destination": "Kolkata",
                    "bus_type": "AC Sleeper"
                }
            },

            {
                "booking_type": "hotel",
                "reference_number": "HT001",
                "status": "pending",
                "amount": 4200,
                "start_date": "2026-07-15",
                "end_date": "2026-07-18",
                "details": {
                    "hotel_name": "Grand Palace",
                    "city": "Delhi"
                }
            },

            {
                "booking_type": "cab",
                "reference_number": "CB001",
                "status": "pending",
                "amount": 950,
                "start_date": "2026-07-15",
                "details": {
                    "pickup": "Airport",
                    "drop": "Connaught Place",
                    "vehicle_type": "Sedan"
                }
            }

        ]

        for item in sample_bookings:
            Booking.objects.create(
                user=user,
                currency="INR",
                payment_confirmed=False,
                payment_method="",
                **item
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Seed data created"
            )
        )