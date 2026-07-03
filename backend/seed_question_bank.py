import os
import django

# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from apps.planner.models import PlannerQuestionBank

def seed_database():
    # Clear existing wildcard templates to avoid duplicates
    PlannerQuestionBank.objects.filter(destination_text="*").delete()

    templates = [
        {
            "destination_text": "*",
            "missing_slots": ["destination"],
            "question_text": "Where is your next adventure taking you? Tell me a city, country, or specific region you'd love to explore, and I will craft the perfect journey.",
            "widget_type": "destination_search",
            "widget_data": {"intent": "any"},
            "occurrence_count": 10,
            "success_count": 8,
        },
        {
            "destination_text": "*",
            "missing_slots": ["travel_dates"],
            "question_text": "To help me shape your itinerary with seasonal insights, when are you thinking of traveling?",
            "widget_type": "date_range_picker",
            "widget_data": {"intent": "any"},
            "occurrence_count": 10,
            "success_count": 7,
        },
        {
            "destination_text": "*",
            "missing_slots": ["nearby_cities"],
            "question_text": "Since you have a wonderful multi-day trip planned, I highly recommend adding these fascinating nearby excursions to enrich your travel experience! Select any you would like to explore:",
            "widget_type": "nearby_cities_recommendation",
            "widget_data": {"intent": "full_trip"},
            "occurrence_count": 10,
            "success_count": 6,
        },
        {
            "destination_text": "*",
            "missing_slots": ["travelers", "budget"],
            "question_text": "Let's personalize your stay! Who is joining you on this trip, and what is your target budget? Our AI can recommend optimized lodging and travel pacing.",
            "widget_type": "optional_trip_details",
            "widget_data": {"intent": "hotel_only", "fields": ["travelers", "budget"]},
            "occurrence_count": 10,
            "success_count": 5,
        },
        {
            "destination_text": "*",
            "missing_slots": ["travelers", "budget", "origin"],
            "question_text": "To help find the best airline rates and group booking configurations, what is your departure city, budget, and traveler count?",
            "widget_type": "optional_trip_details",
            "widget_data": {"intent": "flight_only", "fields": ["travelers", "budget", "origin"]},
            "occurrence_count": 10,
            "success_count": 5,
        },
        {
            "destination_text": "*",
            "missing_slots": ["travelers", "budget", "interests", "origin"],
            "question_text": "We are ready to customize the fine details of your full trip! What are your travel interests, traveler count, and target budget?",
            "widget_type": "optional_trip_details",
            "widget_data": {"intent": "full_trip", "fields": ["travelers", "budget", "interests", "origin"]},
            "occurrence_count": 10,
            "success_count": 6,
        }
    ]

    for t in templates:
        PlannerQuestionBank.objects.create(
            destination_text=t["destination_text"],
            missing_slots=t["missing_slots"],
            question_text=t["question_text"],
            widget_type=t["widget_type"],
            widget_data=t["widget_data"],
            occurrence_count=t["occurrence_count"],
            success_count=t["success_count"]
        )

    print("Successfully seeded PlannerQuestionBank with ordered templates!")

if __name__ == "__main__":
    seed_database()
