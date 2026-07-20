"""Honest degraded-plan builder with no fabricated provider data."""

from __future__ import annotations

import uuid
from datetime import timedelta

from django.conf import settings
from django.utils import timezone


def _placeholder(category: str, title: str, city: str, start: str, end: str) -> dict:
    return {
        "id": str(uuid.uuid4()), "category": category, "title": title,
        "location_name": city, "start_time": start, "end_time": end,
        "estimated_cost": 0.0, "currency_code": None, "status": "pending",
        "notes": "Real availability and venue data could not be verified. Choose a verified option before booking.",
        "latitude": None, "longitude": None, "rating": None, "image_url": None,
        "metadata": {"provenance": "fallback", "requires_selection": True},
    }


def build_fallback_plan(draft) -> dict:
    destination = (draft.destination_text or "Destination").split(",")[0].strip()
    start = draft.start_date or timezone.localdate()
    end = draft.end_date or (start + timedelta(days=2))
    if end < start:
        end = start
    city = getattr(draft, "destination_city", None)
    country_obj = getattr(city, "country", None)
    country = getattr(country_obj, "name", "")
    currency = getattr(country_obj, "currency_code", None) or draft.budget_currency or settings.DEFAULT_CURRENCY_CODE
    intent = draft.intent or "full_trip"
    days, gaps = [], []
    current, number = start, 1
    single_day = {"hotel_only", "food_and_dining", "flight_only", "train_only", "bus_only", "cab_only", "transit_only"}
    while current <= end:
        activities = []
        if intent in {"hotel_only", "full_trip"} and number == 1:
            activities.append(_placeholder("hotel", "Verified accommodation needed", destination, "02:00 PM", "03:00 PM"))
            gaps.append({"day": number, "category": "hotel", "reason": "No verified accommodation was available."})
        if intent in {"food_and_dining", "full_trip"}:
            activities.append(_placeholder("food", "Verified dining option needed", destination, "01:00 PM", "02:00 PM"))
            gaps.append({"day": number, "category": "food", "reason": "No verified restaurant was available."})
        if intent not in {"hotel_only", "food_and_dining"}:
            category = "transport" if intent in {"flight_only", "train_only", "bus_only", "cab_only", "transit_only"} else "activity"
            title = "Verified transport option needed" if category == "transport" else "Verified activity needed"
            activities.append(_placeholder(category, title, destination, "10:00 AM", "12:00 PM"))
            gaps.append({"day": number, "category": category, "reason": f"No verified {category} option was available."})
        days.append({
            "day_number": number, "date": current.isoformat(),
            "title": f"{destination}: details pending verification",
            "day_type": "planning_gap", "city": destination, "activities": activities,
        })
        if intent in single_day:
            break
        current += timedelta(days=1)
        number += 1
    return {
        "title": f"{destination} itinerary (verification needed)",
        "summary": "A date-correct fallback was created, but venue and provider details still need verified selections.",
        "total_budget": 0.0, "currency_code": currency,
        "cities": [{
            "name": getattr(city, "name", None) or destination, "country": country,
            "order": 1, "nights": max((end - start).days, 0),
            "arrival_date": start.isoformat(), "departure_date": end.isoformat(),
        }],
        "days": days, "gaps": gaps,
        "metadata": {"validation_gaps": gaps, "provenance": "fallback"},
    }
