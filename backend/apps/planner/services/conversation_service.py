from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.planner.models import PlannerChatMessage, PlannerTrip, PlannerWorkspace, TripDraftState
from apps.planner.services.conversation_engine import ConversationEngine


class ConversationService:
    def __init__(self):
        self.engine = ConversationEngine()

    @transaction.atomic
    def send_message(self, user, message, workspace=None, structured_value=None):
        from django.db.models import F
        from apps.planner.models import PlannerQuestionBank, PlannerChatMessage

        workspace = workspace or self._create_workspace(user, message)
        draft, _ = TripDraftState.objects.get_or_create(workspace=workspace)

        # 1. Track preceding widget interaction and update success count
        if structured_value:
            field = structured_value.get("field")
            widget_type_mapped = None
            if field == "destination":
                widget_type_mapped = "destination_search"
            elif field == "travel_dates":
                widget_type_mapped = "date_range_picker"
            elif field == "optional_trip_details":
                widget_type_mapped = "optional_trip_details"
            elif field == "add_nearby_city":
                widget_type_mapped = "nearby_cities_recommendation"

            if widget_type_mapped:
                last_assistant_msg = workspace.chat_messages.filter(
                    role=PlannerChatMessage.ROLE_ASSISTANT
                ).order_by("-created_at").first()
                if last_assistant_msg:
                    PlannerQuestionBank.objects.filter(
                        destination_text=draft.destination_text or "",
                        widget_type=widget_type_mapped,
                        question_text=last_assistant_msg.message
                    ).update(success_count=F("success_count") + 1)

        user_message = PlannerChatMessage.objects.create(
            workspace=workspace,
            role=PlannerChatMessage.ROLE_USER,
            message=message,
        )

        history = list(workspace.chat_messages.filter(
            created_at__lt=user_message.created_at
        ).order_by("created_at"))

        result = self.engine.process(draft, message, history=history, structured_value=structured_value)
        assistant_message = PlannerChatMessage.objects.create(
            workspace=workspace,
            role=PlannerChatMessage.ROLE_ASSISTANT,
            message=result.reply,
            widgets=result.widgets,
            commands=result.commands,
            metadata={
                "extraction_tier": result.extraction_tier,
                "ready_for_plan": result.ready,
                "missing_slots": result.missing_slots,
                "confidence_score": draft.metadata.get("confidence_score", 50) if draft.metadata else 50,
                "confidence_explanation": draft.metadata.get("confidence_explanation", "") if draft.metadata else "",
            },
        )

        # 2. Record new clarification questions/widgets in the PlannerQuestionBank
        for widget in result.widgets:
            widget_type = widget.get("type")
            if widget_type:
                q_bank_entry, created = PlannerQuestionBank.objects.get_or_create(
                    destination_text=draft.destination_text or "",
                    widget_type=widget_type,
                    question_text=result.reply,
                    defaults={
                        "missing_slots": result.missing_slots,
                        "widget_data": widget.get("data", {}),
                        "occurrence_count": 1,
                    }
                )
                if not created:
                    q_bank_entry.occurrence_count = F("occurrence_count") + 1
                    q_bank_entry.save(update_fields=["occurrence_count"])

        workspace.last_activity_at = timezone.now()
        workspace.save(update_fields=["last_activity_at", "updated_at"])

        return {
            "workspace": workspace,
            "draft_state": draft,
            "user_message": user_message,
            "assistant_message": assistant_message,
            "ready_for_plan": result.ready,
            "missing_slots": result.missing_slots,
            "command_results": [],
        }


    @transaction.atomic
    def create_plan(self, workspace):
        draft = workspace.draft_state
        if not draft.is_ready_for_plan:
            raise ValueError("Destination and travel dates are required before creating a plan.")

        # If trip already exists and we are recreating it, we can fetch or we create a new one.
        # But we'll assume we are generating here.
        itinerary = self._generate_itinerary_with_ai(draft)

        trip, created = PlannerTrip.objects.get_or_create(
            workspace=workspace,
            defaults={
                "title": itinerary.get("title", f"{draft.destination_text} Trip"),
                "summary": itinerary.get("summary", "Generated itinerary."),
                "currency_code": itinerary.get("currency_code", "USD"),
                "total_budget": itinerary.get("total_budget", draft.budget_amount or 0),
                "cities": [
                    {
                        "name": draft.destination_text,
                        "country": getattr(getattr(draft.destination_city, "country", None), "name", ""),
                        "order": 1,
                        "nights": max((draft.end_date - draft.start_date).days, 1),
                        "arrival_date": draft.start_date.isoformat(),
                        "departure_date": draft.end_date.isoformat(),
                    }
                ],
                "days": itinerary.get("days", []),
                "metadata": {"status": "complete", "travelers": draft.adults + draft.children},
            },
        )
        
        if not created:
            trip.title = itinerary.get("title", trip.title)
            trip.summary = itinerary.get("summary", trip.summary)
            trip.currency_code = itinerary.get("currency_code", trip.currency_code)
            trip.total_budget = itinerary.get("total_budget", trip.total_budget)
            trip.days = itinerary.get("days", trip.days)
            trip.metadata = {"status": "complete", "travelers": draft.adults + draft.children}
            trip.save()

        workspace.status = PlannerWorkspace.STATUS_ACTIVE
        workspace.mode = PlannerWorkspace.MODE_PLANNING
        workspace.last_activity_at = timezone.now()
        workspace.title = trip.title  # Update workspace title to match the trip name
        workspace.save(update_fields=["status", "mode", "last_activity_at", "updated_at", "title"])
        return trip

    def _create_workspace(self, user, message):
        return PlannerWorkspace.objects.create(
            user=user,
            title=self._title_from_first_message(message),
        )

    def _title_from_first_message(self, message):
        clean = " ".join(message.split())
        if not clean:
            return "New Trip"
        return clean[:57] + "..." if len(clean) > 60 else clean

    def _generate_itinerary_with_ai(self, draft):
        from google import genai
        from pydantic import BaseModel, Field
        from typing import List, Optional
        import uuid

        class Activity(BaseModel):
            id: str = Field(description="Unique string ID for the activity")
            category: str = Field(description="One of: flight, hotel, train, bus, cab, activity, food")
            title: str = Field(description="Name of the activity, e.g. 'Flight to Tokyo' or 'Eiffel Tower'")
            location_name: str = Field(description="Location name or address")
            start_time: str = Field(description="e.g. 10:00 AM")
            end_time: str = Field(description="e.g. 12:00 PM")
            estimated_cost: float = Field(description="Estimated cost as a number")
            currency_code: str = Field(description="Currency code based on origin/destination, e.g. USD, EUR, INR, JPY")
            status: str = Field(description="Always set to 'pending' for generated plans")
            notes: str = Field(description="Short description or tips for the user")

        class Day(BaseModel):
            day_number: int
            date: str = Field(description="ISO format date (YYYY-MM-DD)")
            title: str = Field(description="Catchy title for the day")
            day_type: str = Field(description="e.g. exploration, transit, relaxation")
            activities: List[Activity]

        class GeneratedItinerary(BaseModel):
            title: str
            summary: str
            total_budget: float
            currency_code: str
            days: List[Day]

        client = genai.Client()
        
        intent_instructions = ""
        if draft.intent == "hotel_only":
            intent_instructions = "The user ONLY wants a hotel. Create a single day (Day 1) that lists a few top hotel options as activities. DO NOT generate flights, transit, or a multi-day schedule."
        elif draft.intent == "transit_only" or draft.intent == "flight_only":
            intent_instructions = "The user ONLY wants transit/flights. Create a single day (Day 1) listing the best flight/train/bus options to their destination. DO NOT generate hotels or multi-day tourist activities."
        elif draft.intent == "activities_only":
            intent_instructions = "The user ONLY wants activities. Generate a schedule of activities/tours for the requested dates. DO NOT generate flight or hotel bookings."
        elif draft.intent == "food_and_dining":
            intent_instructions = "The user ONLY wants dining options. Generate a schedule focusing strictly on restaurants, cafes, and food tours. DO NOT generate flights or hotels."
        else:
            intent_instructions = """1. Generate realistic flight/bus/train options for arriving on day 1 and departing on the last day. Set category to 'flight', 'bus', or 'train'.
2. Generate a realistic hotel booking spanning the trip. Place the hotel check-in activity on Day 1. Category: 'hotel'.
3. For each day, generate 2-4 activities (category: 'activity', 'food', 'cab')."""

        nearby_cities = draft.metadata.get("nearby_cities", []) if draft.metadata else []
        nearby_cities_str = f"Nearby Cities/Excursions to Include: {', '.join(nearby_cities)}" if nearby_cities else ""

        prompt = f"""Generate a detailed, realistic travel itinerary based on these preferences:
Intent: {draft.intent}
Destination: {draft.destination_text}
Dates: {draft.start_date} to {draft.end_date}
Travelers: {draft.adults} Adults, {draft.children} Children
Budget: {draft.budget_tier}
Interests: {draft.interests}
{nearby_cities_str}

Instructions:
{intent_instructions}
4. Include realistic estimated costs in an appropriate currency (e.g. USD, EUR, INR) based on standard international travel or the destination. Use the same currency across the trip.
5. Provide helpful notes for each activity.
6. Make sure the dates in 'days' match the trip dates sequentially (unless it's a single-day overview for a specific intent).
"""
        
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeneratedItinerary,
                    temperature=0.5,
                ),
            )
            data = response.parsed
            
            # Ensure unique IDs just in case the AI generated duplicate generic ones
            days_out = []
            for d in data.days:
                activities_out = []
                for act in d.activities:
                    activities_out.append({
                        "id": str(uuid.uuid4()),
                        "category": act.category,
                        "title": act.title,
                        "location_name": act.location_name,
                        "start_time": act.start_time,
                        "end_time": act.end_time,
                        "estimated_cost": float(act.estimated_cost),
                        "currency_code": act.currency_code,
                        "status": "pending",
                        "notes": act.notes,
                    })
                days_out.append({
                    "day_number": d.day_number,
                    "date": d.date,
                    "title": d.title,
                    "day_type": d.day_type,
                    "activities": activities_out
                })
            
            return {
                "title": data.title,
                "summary": data.summary,
                "total_budget": float(data.total_budget),
                "currency_code": data.currency_code,
                "days": days_out
            }
        except Exception as e:
            print(f"Error generating itinerary with AI: {e}")
            # Fallback to empty days
            return self._skeleton_fallback(draft)

    def _get_fallback_content(self, destination: str, intent: str, budget_tier: str, currency_code: str):
        dest_lower = (destination or "").lower().strip()
        
        # Determine some values based on budget tier and currency
        is_inr = currency_code == "INR" or "india" in dest_lower or "kolkata" in dest_lower or "mumbai" in dest_lower or "bengaluru" in dest_lower or "delhi" in dest_lower
        currency = "INR" if is_inr else currency_code or "USD"
        
        # Scale pricing based on currency and budget tier
        if currency == "INR":
            h_cost = 3500 if budget_tier == "budget" else (8500 if budget_tier == "mid_range" else 18000)
            f_cost = 1200 if budget_tier == "budget" else (3000 if budget_tier == "mid_range" else 7000)
            a_cost = 150 if budget_tier == "budget" else (500 if budget_tier == "mid_range" else 1500)
        else:
            h_cost = 60 if budget_tier == "budget" else (150 if budget_tier == "mid_range" else 350)
            f_cost = 25 if budget_tier == "budget" else (60 if budget_tier == "mid_range" else 120)
            a_cost = 10 if budget_tier == "budget" else (25 if budget_tier == "mid_range" else 75)

        # Database of popular cities fallback
        fallback_cities = {
            "kolkata": {
                "hotels": [
                    {
                        "name": "The Oberoi Grand, Kolkata",
                        "tier": "premium",
                        "notes": "An iconic 5-star heritage luxury hotel on Chowringhee Road, offering legendary hospitality, premium dining, and a serene outdoor pool."
                    },
                    {
                        "name": "ITC Royal Bengal, Kolkata",
                        "tier": "premium",
                        "notes": "A magnificent hotel celebrating Bengal's heritage with ultra-luxury rooms, top-tier restaurants, and world-class spa facilities."
                    },
                    {
                        "name": "The Peerless Inn, Kolkata",
                        "tier": "mid_range",
                        "notes": "A highly rated mid-range hotel at Esplanade, perfect for business and leisure, featuring famous authentic Bengali dining at Aaheli."
                    },
                    {
                        "name": "Kenilworth Hotel, Kolkata",
                        "tier": "mid_range",
                        "notes": "An elegant 4-star hotel in Little Russell Street with a beautiful lawn, modern rooms, and a popular pub."
                    },
                    {
                        "name": "Aravinda Guest House, Kolkata",
                        "tier": "budget",
                        "notes": "A warm, comfortable budget guesthouse offering home-like comfort, clean rooms, and friendly local service."
                    }
                ],
                "restaurants": [
                    {"name": "Peter Cat, Park Street", "notes": "World-famous for its legendary Chelo Kebabs, classic ambiance, and vintage Park Street charm."},
                    {"name": "6 Ballygunge Place", "notes": "An award-winning restaurant housed in a heritage building, famous for authentic traditional Bengali food."},
                    {"name": "Mocambo, Park Street", "notes": "Kolkata's first nightclub, now a highly-rated restaurant serving retro continental cuisine, including Devilled Crabs."},
                    {"name": "Arsalan, Park Circus", "notes": "Known across India for its delicious, fragrant Kolkata Mughlai Biryani with the iconic potato and egg."}
                ],
                "attractions": [
                    {"name": "Victoria Memorial", "notes": "A stunning white marble palace built in memory of Queen Victoria, set within beautiful lush green gardens."},
                    {"name": "Howrah Bridge", "notes": "The world's busiest cantilever bridge over the Hooghly River, symbolizing the historic spirit of Kolkata."},
                    {"name": "Dakshineswar Kali Temple", "notes": "A famous 19th-century temple complex dedicated to Goddess Kali, located on the eastern bank of the Hooghly."},
                    {"name": "Mother House", "notes": "The headquarters of the Missionaries of Charity, containing Mother Teresa's tomb and a small museum."}
                ]
            },
            "mumbai": {
                "hotels": [
                    {"name": "The Taj Mahal Palace, Mumbai", "tier": "premium", "notes": "India's iconic landmark heritage hotel overlooking the Gateway of India and the Arabian Sea."},
                    {"name": "Trident, Nariman Point", "tier": "premium", "notes": "A beautiful premium hotel at Marine Drive with spectacular views of the Queen's Necklace."},
                    {"name": "Fariyas Hotel, Colaba", "tier": "mid_range", "notes": "A comfortable 4-star business hotel located in Colaba, close to shopping and attractions."},
                    {"name": "Sahar Garden Guesthouse, Mumbai", "tier": "budget", "notes": "Clean, simple, and comfortable budget accommodation near the international airport."}
                ],
                "restaurants": [
                    {"name": "Leopold Cafe, Colaba", "notes": "A legendary multicultural restaurant and bar, popular with travelers since 1871."},
                    {"name": "Britannia & Co. Restaurant", "notes": "An iconic colonial-era Parsi cafe in Ballard Estate, famous for its Berry Pulav and heritage atmosphere."}
                ],
                "attractions": [
                    {"name": "Gateway of India", "notes": "A monumental arch built during the 20th century, overlooking the harbor of Mumbai."},
                    {"name": "Marine Drive", "notes": "A 3.6-kilometer-long boulevard along the net Netaji Subhash Chandra Bose Road, a perfect place for sunset."}
                ]
            },
            "delhi": {
                "hotels": [
                    {"name": "The Leela Palace, New Delhi", "tier": "premium", "notes": "A majestic luxury hotel blending modern technology with traditional royal Indian hospitality."},
                    {"name": "The Taj Mahal Hotel, New Delhi", "tier": "premium", "notes": "A legendary premium address in the heart of Lutyens' Delhi, famous for luxury rooms and fine dining."},
                    {"name": "Bloomrooms @ Janpath", "tier": "mid_range", "notes": "A bright, vibrant, and extremely clean yellow-and-white themed modern hotel near Connaught Place."},
                    {"name": "Smyle Inn, Paharganj", "tier": "budget", "notes": "A friendly budget hotel located off Main Bazaar Road, offering clean rooms, free Wi-Fi, and simple breakfast."}
                ],
                "restaurants": [
                    {"name": "Karim's, Old Delhi", "notes": "A world-famous heritage culinary destination serving historic royal Mughlai cuisine near Jama Masjid."},
                    {"name": "Bukhara, ITC Maurya", "notes": "An internationally acclaimed restaurant serving rustic Northwest Frontier tandoori cuisine, famous for Dal Bukhara."}
                ],
                "attractions": [
                    {"name": "Red Fort", "notes": "A historic fort complex in Old Delhi, built by Emperor Shah Jahan in the 17th century."},
                    {"name": "Qutub Minar", "notes": "A soaring 73-meter tower of victory, built in 1193, surrounded by remarkable historic ruins."}
                ]
            },
            "bengaluru": {
                "hotels": [
                    {"name": "The Oberoi, Bengaluru", "tier": "premium", "notes": "An award-winning garden luxury hotel on MG Road, famous for centenary-old trees and high-end services."},
                    {"name": "The Ritz-Carlton, Bangalore", "tier": "premium", "notes": "A stunning, modern luxury hotel combining sophisticated contemporary design with Indian art elements."},
                    {"name": "Bloomsuites @ Outer Ring Road", "tier": "mid_range", "notes": "Comfortable, sleek, and highly clean modern suites catering perfectly to travelers and tech professionals."},
                    {"name": "The Elgin Guesthouse, Bengaluru", "tier": "budget", "notes": "A charming, homely budget heritage guesthouse in a quiet central residential lane."}
                ],
                "restaurants": [
                    {"name": "MTR (Mavalli Tiffin Room)", "notes": "An iconic heritage South Indian restaurant serving legendary Rava Idli and delicious Filter Coffee since 1924."},
                    {"name": "Toit Beer Co, Indiranagar", "notes": "One of India's most famous microbreweries, offering delicious craft beers and excellent wood-fired pizzas."}
                ],
                "attractions": [
                    {"name": "Bangalore Palace", "notes": "A grand royal palace owned by the Mysore Royal family, designed with Tudor-style architecture."},
                    {"name": "Lalbagh Botanical Garden", "notes": "A magnificent 240-acre historic garden featuring India's largest collection of tropical plants and a glass house."}
                ]
            }
        }

        # Find matching city fallback or default to generic fallback
        city_key = None
        for key in fallback_cities.keys():
            if key in dest_lower:
                city_key = key
                break

        if city_key:
            city_data = fallback_cities[city_key]
            # Filter hotels by budget tier if possible, otherwise use first
            matched_hotels = [h for h in city_data["hotels"] if h.get("tier") == budget_tier]
            if not matched_hotels:
                # Try sibling tiers or just use the whole list
                matched_hotels = city_data["hotels"]
            
            hotels = matched_hotels
            restaurants = city_data["restaurants"]
            attractions = city_data["attractions"]
        else:
            # Generic fallback for any other city in the world
            cap_dest = (destination or "Destination").title()
            hotels = [
                {
                    "name": f"The Grand {cap_dest} Resort & Spa" if budget_tier == "premium" else (f"The {cap_dest} Regency" if budget_tier == "mid_range" else f"{cap_dest} Comfort Inn"),
                    "notes": f"A highly-rated, highly comfortable property offering a wonderful stay in {cap_dest} matching your budget requirements."
                },
                {
                    "name": f"Hotel {cap_dest} Palace" if budget_tier == "premium" else (f"{cap_dest} Boutique Suites" if budget_tier == "mid_range" else f"{cap_dest} Central Hostel"),
                    "notes": f"An excellent alternative accommodation choice in {cap_dest} with highly-rated customer reviews."
                }
            ]
            restaurants = [
                {"name": f"The Local Gastropub & Grill", "notes": f"Famous for its delightful menu of authentic local specialties and wonderful contemporary ambiance in {cap_dest}."},
                {"name": f"The {cap_dest} Heritage Dining", "notes": f"A beautiful award-winning restaurant celebrating traditional recipes passed down through generations."}
            ]
            attractions = [
                {"name": f"Historic Old Town Plaza", "notes": f"The vibrant historic square of {cap_dest}, featuring stunning architecture, local boutiques, and open-air cafes."},
                {"name": f"Central Park & Scenic Botanical Gardens", "notes": f"A breathtakingly beautiful park featuring lush walking trails, gorgeous blooming flower gardens, and local monuments."}
            ]

        return {
            "hotels": hotels,
            "restaurants": restaurants,
            "attractions": attractions,
            "currency": currency,
            "hotel_cost": h_cost,
            "food_cost": f_cost,
            "activity_cost": a_cost,
        }

    def _skeleton_fallback(self, draft):
        import uuid
        from datetime import timedelta, date
        
        destination = draft.destination_text or "Kolkata"
        intent = draft.intent or "full_trip"
        budget_tier = draft.budget_tier or "mid_range"
        currency_code = draft.budget_currency or "INR"
        
        fallback = self._get_fallback_content(destination, intent, budget_tier, currency_code)
        currency = fallback["currency"]
        
        days = []
        start = draft.start_date or timezone.now().date()
        end = draft.end_date or (start + timedelta(days=2))
        
        # Ensure we always have sequential dates
        if start > end:
            end = start + timedelta(days=2)
            
        current = start
        day_number = 1
        
        # If it's hotel_only or single-day intent
        if intent == "hotel_only":
            # Just create Day 1 with hotel suggestions
            activities = []
            for idx, h in enumerate(fallback["hotels"]):
                activities.append({
                    "id": str(uuid.uuid4()),
                    "category": "hotel",
                    "title": f"Stay Recommendation: {h['name']}",
                    "location_name": f"{destination}",
                    "start_time": "02:00 PM" if idx == 0 else "N/A",
                    "end_time": "12:00 PM" if idx == 0 else "N/A",
                    "estimated_cost": float(fallback["hotel_cost"]),
                    "currency_code": currency,
                    "status": "pending",
                    "notes": h["notes"] if idx == 0 else f"Alternative option. {h['notes']}"
                })
            
            # Add one attraction just for reference
            if fallback["attractions"]:
                activities.append({
                    "id": str(uuid.uuid4()),
                    "category": "activity",
                    "title": f"Explore Nearby: {fallback['attractions'][0]['name']}",
                    "location_name": f"{destination}",
                    "start_time": "04:00 PM",
                    "end_time": "06:00 PM",
                    "estimated_cost": 0.0,
                    "currency_code": currency,
                    "status": "pending",
                    "notes": fallback["attractions"][0]["notes"]
                })
                
            days.append({
                "day_number": 1,
                "date": start.isoformat(),
                "title": f"Hotel Stay & Area Guide in {destination}",
                "day_type": "relaxation",
                "activities": activities
            })
        else:
            # Full multi-day trip or other intents
            while current <= end:
                activities = []
                
                # Day 1: Arrive, check-in, explore
                if day_number == 1:
                    # Flight / Transit
                    activities.append({
                        "id": str(uuid.uuid4()),
                        "category": "flight" if intent != "transit_only" else "flight",
                        "title": f"Arrive in {destination}",
                        "location_name": f"{destination} Airport / Station",
                        "start_time": "10:00 AM",
                        "end_time": "12:00 PM",
                        "estimated_cost": float(fallback["hotel_cost"] * 1.5), # flight cost approximation
                        "currency_code": currency,
                        "status": "pending",
                        "notes": f"Arrive at the destination and prepare for your wonderful check-in."
                    })
                    
                    # Hotel Check-in
                    if fallback["hotels"] and intent != "activities_only" and intent != "food_and_dining":
                        activities.append({
                            "id": str(uuid.uuid4()),
                            "category": "hotel",
                            "title": f"Check-in at {fallback['hotels'][0]['name']}",
                            "location_name": f"{destination}",
                            "start_time": "02:00 PM",
                            "end_time": "03:00 PM",
                            "estimated_cost": float(fallback["hotel_cost"]),
                            "currency_code": currency,
                            "status": "pending",
                            "notes": fallback["hotels"][0]["notes"]
                        })
                    
                    # Evening attraction
                    if fallback["attractions"]:
                        activities.append({
                            "id": str(uuid.uuid4()),
                            "category": "activity",
                            "title": f"Evening Visit to {fallback['attractions'][0]['name']}",
                            "location_name": f"{destination}",
                            "start_time": "04:30 PM",
                            "end_time": "06:30 PM",
                            "estimated_cost": 0.0,
                            "currency_code": currency,
                            "status": "pending",
                            "notes": fallback["attractions"][0]["notes"]
                        })
                        
                elif current == end:
                    # Last Day: check-out, souvenir, depart
                    if fallback["restaurants"]:
                        activities.append({
                            "id": str(uuid.uuid4()),
                            "category": "food",
                            "title": f"Brunch at {fallback['restaurants'][-1]['name']}",
                            "location_name": f"{destination}",
                            "start_time": "11:00 AM",
                            "end_time": "12:30 PM",
                            "estimated_cost": float(fallback["food_cost"]),
                            "currency_code": currency,
                            "status": "pending",
                            "notes": fallback["restaurants"][-1]["notes"]
                        })
                    
                    activities.append({
                        "id": str(uuid.uuid4()),
                        "category": "flight" if intent != "transit_only" else "flight",
                        "title": f"Depart from {destination}",
                        "location_name": f"{destination} Airport / Station",
                        "start_time": "04:00 PM",
                        "end_time": "06:00 PM",
                        "estimated_cost": 0.0,
                        "currency_code": currency,
                        "status": "pending",
                        "notes": "Head back home with beautiful memories!"
                    })
                else:
                    # Middle exploration days
                    # Sightseeing 1
                    att_idx = (day_number - 1) % len(fallback["attractions"]) if fallback["attractions"] else 0
                    if fallback["attractions"]:
                        activities.append({
                            "id": str(uuid.uuid4()),
                            "category": "activity",
                            "title": f"Sightseeing: {fallback['attractions'][att_idx]['name']}",
                            "location_name": f"{destination}",
                            "start_time": "10:00 AM",
                            "end_time": "12:30 PM",
                            "estimated_cost": float(fallback["activity_cost"]),
                            "currency_code": currency,
                            "status": "pending",
                            "notes": fallback["attractions"][att_idx]["notes"]
                        })
                        
                    # Lunch
                    rest_idx = (day_number - 1) % len(fallback["restaurants"]) if fallback["restaurants"] else 0
                    if fallback["restaurants"]:
                        activities.append({
                            "id": str(uuid.uuid4()),
                            "category": "food",
                            "title": f"Lunch at {fallback['restaurants'][rest_idx]['name']}",
                            "location_name": f"{destination}",
                            "start_time": "01:00 PM",
                            "end_time": "02:30 PM",
                            "estimated_cost": float(fallback["food_cost"]),
                            "currency_code": currency,
                            "status": "pending",
                            "notes": fallback["restaurants"][rest_idx]["notes"]
                        })
                        
                    # Afternoon attraction/activity
                    if len(fallback["attractions"]) > 1:
                        att_idx_2 = (day_number) % len(fallback["attractions"])
                        activities.append({
                            "id": str(uuid.uuid4()),
                            "category": "activity",
                            "title": f"Discover {fallback['attractions'][att_idx_2]['name']}",
                            "location_name": f"{destination}",
                            "start_time": "03:30 PM",
                            "end_time": "06:00 PM",
                            "estimated_cost": float(fallback["activity_cost"]),
                            "currency_code": currency,
                            "status": "pending",
                            "notes": fallback["attractions"][att_idx_2]["notes"]
                        })
                
                days.append({
                    "day_number": day_number,
                    "date": current.isoformat(),
                    "title": f"Discovering {destination}" if day_number > 1 else f"Arrival & Relaxing in {destination}",
                    "day_type": "exploration" if day_number > 1 else "transit",
                    "activities": activities
                })
                
                current = current + timedelta(days=1)
                day_number += 1
                
        # Calculate total fallback budget
        tot_budget = 0.0
        for d in days:
            for a in d["activities"]:
                tot_budget += a["estimated_cost"]
                
        return {
            "title": f"{destination} {'Hotel Stay' if intent == 'hotel_only' else 'Itinerary'}",
            "summary": f"Your personalized, high-precision {intent.replace('_', ' ')} fallback guide for {destination} structured around a {budget_tier.replace('_', ' ')} budget.",
            "total_budget": float(tot_budget or draft.budget_amount or 0),
            "currency_code": currency,
            "days": days
        }

