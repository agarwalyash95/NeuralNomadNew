from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.planner.models import (
    PlannerChatMessage, PlannerIntentFlow, PlannerTrip, PlannerTripOriginal,
    PlannerWorkspace, TripDraftState,
)
# pyrefly: ignore [missing-import]
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
            elif field == "origin":
                widget_type_mapped = "origin_search"
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
                    # Update success count for the exact intent + destination combination
                    PlannerQuestionBank.objects.filter(
                        intent=draft.intent or "full_trip",
                        destination_text=draft.destination_text or "",
                        widget_type=widget_type_mapped,
                        question_text=last_assistant_msg.message
                    ).update(success_count=F("success_count") + 1)
                    # Also try wildcard destination entry
                    PlannerQuestionBank.objects.filter(
                        intent=draft.intent or "full_trip",
                        destination_text="*",
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

        # Sync detected intent back to draft if engine changed it
        if result.detected_intent and result.detected_intent != draft.intent:
            draft.intent = result.detected_intent
            draft.save(update_fields=["intent", "updated_at"])

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
                "detected_intent": result.detected_intent,
                "confidence_score": draft.metadata.get("confidence_score", 50) if draft.metadata else 50,
                "confidence_explanation": draft.metadata.get("confidence_explanation", "") if draft.metadata else "",
            },
        )

        # 2. Record new clarification questions/widgets in the PlannerQuestionBank (intent-aware)
        for widget in result.widgets:
            widget_type = widget.get("type")
            if widget_type:
                q_bank_entry, created = PlannerQuestionBank.objects.get_or_create(
                    intent=draft.intent or "full_trip",
                    destination_text=draft.destination_text or "*",
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

        # Chat-edit intents (docs/planner-product-audit-2026-07.md CH1): a
        # narrow re-time detector, additive only — never alters the reply
        # above, never raises into this transaction.
        from apps.planner.services.chat_edit_intents import propose_retime_from_chat

        propose_retime_from_chat(workspace, message)

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

        # Generate trip itinerary with AI (and caching lookup enrichment)
        itinerary = self._generate_itinerary_with_ai(draft)

        trip, created = PlannerTrip.objects.get_or_create(
            workspace=workspace,
            defaults={
                "title": itinerary.get("title", f"{draft.destination_text} Trip"),
                "summary": itinerary.get("summary", "Generated itinerary."),
                "currency_code": itinerary.get("currency_code", "USD"),
                "total_budget": itinerary.get("total_budget", draft.budget_amount or 0),
                "cities": itinerary.get("cities") or [
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
            trip.cities = itinerary.get("cities") or trip.cities
            trip.days = itinerary.get("days", trip.days)
            trip.metadata = {"status": "complete", "travelers": draft.adults + draft.children}
            trip.save()

        workspace.status = PlannerWorkspace.STATUS_ACTIVE
        workspace.mode = PlannerWorkspace.MODE_PLANNING
        workspace.last_activity_at = timezone.now()
        workspace.title = trip.title  # Update workspace title to match the trip name
        workspace.save(update_fields=["status", "mode", "last_activity_at", "updated_at", "title"])

        # Create copy of pristine starting plan in PlannerTripOriginal
        PlannerTripOriginal.objects.get_or_create(
            workspace=workspace,
            defaults={
                "title": trip.title,
                "summary": trip.summary,
                "cities": trip.cities,
                "days": trip.days,
                "metadata": trip.metadata,
            }
        )

        # Record this successful conversation as a learned flow
        try:
            self._record_successful_flow(workspace, draft)
        except Exception as e:
            print(f"[ConversationService] Flow recording error (non-fatal): {e}")

        # Traveler memory: record durable facts from this plan (provenance:
        # inferred — the profile page shows them, the user can delete them,
        # and nothing applies silently without citing itself)
        try:
            self._record_traveler_facts(workspace, draft)
        except Exception as e:
            print(f"[ConversationService] Traveler fact recording error (non-fatal): {e}")

        return trip

    def _record_traveler_facts(self, workspace, draft):
        from apps.planner.models import TravelerProfile

        profile, _ = TravelerProfile.objects.get_or_create(user=workspace.user)

        origin = (draft.metadata or {}).get("origin_text") or (draft.metadata or {}).get("origin")
        if origin:
            profile.upsert_fact("home_origin", origin, source_trip=workspace.id)

        party = draft.adults + draft.children
        if party > 0:
            profile.upsert_fact("typical_party_size", party, source_trip=workspace.id)

        if draft.budget_tier:
            profile.upsert_fact("budget_tier", draft.budget_tier, source_trip=workspace.id)
        if draft.budget_amount:
            profile.upsert_fact(
                "recent_trip_budget",
                {"amount": float(draft.budget_amount), "currency": draft.budget_currency},
                source_trip=workspace.id,
            )

        if draft.interests:
            profile.upsert_fact("interests", draft.interests, source_trip=workspace.id)

    def _create_workspace(self, user, message):
        return PlannerWorkspace.objects.create(
            user=user,
            title=self._title_from_first_message(message),
        )

    def _record_successful_flow(self, workspace, draft):
        """
        When a plan is successfully generated, record the conversation steps
        as a PlannerIntentFlow so future AI sessions can learn from this pattern.
        """
        messages = list(workspace.chat_messages.order_by("created_at"))
        total_messages = len(messages)
        if total_messages == 0:
            return

        # Extract the ordered widget steps from assistant messages
        steps = []
        for i, msg in enumerate(messages):
            if msg.role == PlannerChatMessage.ROLE_ASSISTANT and msg.widgets:
                for widget in msg.widgets:
                    steps.append({
                        "step": len(steps) + 1,
                        "widget": widget.get("type"),
                        "message_index": i,
                    })

        if not steps:
            return

        intent = draft.intent or "full_trip"
        dest = draft.destination_text or "*"

        flow, created = PlannerIntentFlow.objects.get_or_create(
            intent=intent,
            destination_text=dest,
            defaults={
                "conversation_steps": steps,
                "usage_count": 1,
                "avg_messages_to_complete": float(total_messages),
                "completion_rate": 1.0,
                "last_used_at": timezone.now(),
            },
        )

        if not created:
            total = flow.usage_count
            # Running average of messages needed
            flow.avg_messages_to_complete = (
                (flow.avg_messages_to_complete * total + total_messages) / (total + 1)
            )
            flow.usage_count += 1
            # Nudge completion_rate toward 1.0 (capped)
            flow.completion_rate = min(1.0, flow.completion_rate + 0.1)
            flow.last_used_at = timezone.now()
            # Keep most recent successful steps
            flow.conversation_steps = steps
            flow.save()

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

        class CityVisit(BaseModel):
            name: str = Field(description="Name of the city, e.g. 'Darjeeling' or 'Gangtok'")
            nights: int = Field(description="Number of nights spent in this city")
            arrival_date: Optional[str] = Field(description="ISO format date (YYYY-MM-DD)")
            departure_date: Optional[str] = Field(description="ISO format date (YYYY-MM-DD)")

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
            city: str = Field(description="The city where this day is spent, e.g. 'Darjeeling' or 'Gangtok'")
            activities: List[Activity]

        class GeneratedItinerary(BaseModel):
            title: str
            summary: str
            total_budget: float
            currency_code: str
            cities: List[CityVisit] = Field(description="List of all cities visited in chronological order with nights spent in each")
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
2. Generate a realistic hotel booking spanning the trip for each city visited. Place the hotel check-in activity on the first day of that city. IMPORTANT: Check-in at the hotel MUST be the very first activity scheduled on Day 1 (immediately after arrival transit), before any sightseeing, dining, or other activities are visited. Category: 'hotel'.
3. For each day, generate 2-4 activities (category: 'activity', 'food', 'cab')."""

        nearby_cities = draft.metadata.get("nearby_cities", []) if draft.metadata else []
        nearby_cities_str = f"Nearby Cities/Excursions to Include: {', '.join(nearby_cities)}" if nearby_cities else ""

        metadata_lines = []
        if draft.metadata:
            for k, v in draft.metadata.items():
                if k in [
                    "origin", "visit_purpose",
                    "train_class", "cabin_class", "car_type", "preferred_mode",
                    "flight_class", "vehicle_type", "time_window", "bus_type",
                    "star_rating", "stay_amenities", "property_type", "dining_package",
                    "meal_type", "cuisine", "dietary", "ambiance",
                    "trip_pace", "intensity_level", "priority", "transmission",
                ] and v:
                    val_str = ", ".join(v) if isinstance(v, list) else str(v)
                    metadata_lines.append(f"{k.replace('_', ' ').title()}: {val_str}")
            if draft.metadata.get("budget_inr"):
                metadata_lines.append(f"Total Budget (INR): ₹{draft.metadata['budget_inr']:,}")
        metadata_str = "\n".join(metadata_lines) if metadata_lines else ""

        # Build visit_purpose tone instruction
        visit_purpose = draft.metadata.get("visit_purpose", "") if draft.metadata else ""
        purpose_tone = ""
        if visit_purpose == "honeymoon":
            purpose_tone = "\nTone: This is a HONEYMOON trip. Make it romantic — suggest couple experiences, sunset views, candlelit dining, and premium accommodation."
        elif visit_purpose == "business":
            purpose_tone = "\nTone: This is a BUSINESS trip. Focus on proximity to business district, fast check-in, work-friendly hotels, and efficiency."
        elif visit_purpose == "hometown":
            purpose_tone = "\nTone: The user is visiting their HOMETOWN. Focus on comfort, budget-friendly options, and local experiences."
        elif visit_purpose == "family":
            purpose_tone = "\nTone: This is a FAMILY trip. Prioritize child-friendly activities, safe neighborhoods, and comfortable family rooms."
        elif visit_purpose == "emergency":
            purpose_tone = "\nTone: EMERGENCY travel. Fastest options only — no upsells, no tourism. Just get there."
        elif visit_purpose == "solo":
            purpose_tone = "\nTone: SOLO travel. Focus on budget-conscious options, social hostels, and adventure activities."

        prompt = f"""Generate a detailed, realistic travel itinerary based on these preferences:
Intent: {draft.intent}
Destination: {draft.destination_text}
Dates: {draft.start_date} to {draft.end_date}
Travelers: {draft.adults} Adults, {draft.children} Children (TOTAL: {draft.adults + draft.children} travelers)
Budget: {draft.budget_tier}
Interests: {draft.interests}
{metadata_str}
{nearby_cities_str}
{purpose_tone}

Instructions:
{intent_instructions}
4. Include realistic estimated costs reflecting EXACTLY {draft.adults + draft.children} travelers ({draft.adults} Adults, {draft.children} Children). All activity costs, meal budgets, and transport tickets MUST be calculated for {draft.adults + draft.children} travelers, NOT just 1 person.
5. Provide helpful notes for each activity.
6. Make sure the dates in 'days' match the trip dates sequentially (unless it's a single-day overview for a specific intent).
7. If this is a multi-city trip (e.g. Darjeeling and Gangtok), make sure to generate activities and cities sequentially. List all cities visited in the cities array, specifying nights spent in each, and assign the correct 'city' name to each Day.
8. CRITICAL FOR MULTI-CITY EXCURSIONS: If nearby cities/excursions are provided in the preferences (e.g. Hakone), you MUST treat this as a multi-city trip. Distribute the days between the main destination (e.g. Tokyo) and the nearby cities (e.g. Hakone). List both cities in the 'cities' array, set the correct 'city' name for each day, and include a transit activity (e.g., train or cab) on the day of transition from the previous city to the next.

"""
        
        try:
            response = client.models.generate_content(
                model='gemini-2.5-pro',
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeneratedItinerary,
                    temperature=0.5,
                ),
            )
            data = response.parsed
            
            # Helper to retrieve/create city dynamically
            city_cache = {}
            def get_or_create_ref_city(c_name):
                name_clean = c_name.strip()
                if name_clean in city_cache:
                    return city_cache[name_clean]
                
                from apps.reference.models import City, Country
                city_obj = City.objects.filter(name__iexact=name_clean).first()
                if not city_obj:
                    country_obj = Country.objects.filter(name__iexact="India").first()
                    if not country_obj and draft.destination_city:
                        country_obj = draft.destination_city.country
                    if not country_obj:
                        country_obj, _ = Country.objects.get_or_create(name="India", defaults={"code": "IN", "currency_code": "INR"})
                    
                    # Fetch coordinates
                    lat, lng = 27.0360, 88.2627
                    if "gangtok" in name_clean.lower():
                        lat, lng = 27.3314, 88.6138
                    else:
                        try:
                            coords = self._call_external_city_coordinates(name_clean)
                            if coords:
                                lat, lng = coords["latitude"], coords["longitude"]
                        except Exception:
                            pass
                    
                    city_obj = City.objects.create(
                        name=name_clean,
                        country=country_obj,
                        latitude=lat,
                        longitude=lng
                    )
                city_cache[name_clean] = city_obj
                return city_obj

            # Reconcile cities from days if cities array is missing or incomplete
            days_cities = []
            for d in getattr(data, "days", []):
                if d.city and d.city.strip().title() not in days_cities:
                    days_cities.append(d.city.strip().title())
                    
            if not hasattr(data, "cities") or not data.cities:
                data.cities = []
                
            existing_city_names = [c.name.strip().title() for c in data.cities]
            
            for dc in days_cities:
                if dc not in existing_city_names:
                    nights_count = sum(1 for d in data.days if d.city and d.city.strip().lower() == dc.lower())
                    class CustomCityVisit:
                        def __init__(self, name, nights):
                            self.name = name
                            self.nights = nights
                            self.arrival_date = None
                            self.departure_date = None
                    data.cities.append(CustomCityVisit(dc, max(nights_count, 1)))

            # Process cities
            cities_out = []
            if hasattr(data, "cities") and data.cities:
                for idx, c in enumerate(data.cities):
                    c_obj = get_or_create_ref_city(c.name)
                    cities_out.append({
                        "name": c_obj.name,
                        "country": c_obj.country.name,
                        "order": idx + 1,
                        "nights": c.nights,
                        "arrival_date": c.arrival_date or draft.start_date.isoformat(),
                        "departure_date": c.departure_date or draft.end_date.isoformat(),
                    })
            else:
                # Single city fallback
                c_obj = get_or_create_ref_city(draft.destination_text)
                cities_out.append({
                    "name": c_obj.name,
                    "country": c_obj.country.name,
                    "order": 1,
                    "nights": max((draft.end_date - draft.start_date).days, 1),
                    "arrival_date": draft.start_date.isoformat(),
                    "departure_date": draft.end_date.isoformat(),
                })

            # Process activities with reference-first caching and API details lookups
            days_out = []
            for d in data.days:
                activities_out = []
                day_city_name = getattr(d, "city", None) or draft.destination_text
                c_obj = get_or_create_ref_city(day_city_name)
                
                for act in d.activities:
                    act_dict = {
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
                    }
                    # ENRICH and CACHE back into reference database tables
                    self._enrich_and_cache_activity(act_dict, c_obj)
                    activities_out.append(act_dict)
                    
                days_out.append({
                    "day_number": d.day_number,
                    "date": d.date,
                    "title": d.title,
                    "day_type": d.day_type,
                    "city": day_city_name,
                    "activities": activities_out
                })
            
            # Sort days chronologically to ensure they are returned in order
            days_out.sort(key=lambda x: int(x["day_number"]) if x.get("day_number") is not None else 999)

            return {
                "title": data.title,
                "summary": data.summary,
                "total_budget": float(data.total_budget),
                "currency_code": data.currency_code,
                "cities": cities_out,
                "days": days_out
            }
        except Exception as e:
            print(f"Error generating itinerary with AI: {e}")
            # Fallback to empty days
            return self._skeleton_fallback(draft)

    def _get_fallback_content(self, destination: str, intent: str, budget_tier: str, currency_code: str, travelers: int = 1):
        dest_lower = (destination or "").lower().strip()
        travelers_count = max(travelers, 1)

        # Determine some values based on budget tier and currency
        is_inr = currency_code == "INR" or "india" in dest_lower or "kolkata" in dest_lower or "mumbai" in dest_lower or "bengaluru" in dest_lower or "delhi" in dest_lower
        currency = "INR" if is_inr else currency_code or "USD"
        
        # Scale pricing based on currency, budget tier, and traveler count
        if currency == "INR":
            h_cost = (3500 if budget_tier == "budget" else (8500 if budget_tier == "mid_range" else 18000))
            f_cost = (1200 if budget_tier == "budget" else (3000 if budget_tier == "mid_range" else 7000)) * travelers_count
            a_cost = (150 if budget_tier == "budget" else (500 if budget_tier == "mid_range" else 1500)) * travelers_count
        else:
            h_cost = (60 if budget_tier == "budget" else (150 if budget_tier == "mid_range" else 350))
            f_cost = (25 if budget_tier == "budget" else (60 if budget_tier == "mid_range" else 120)) * travelers_count
            a_cost = (10 if budget_tier == "budget" else (25 if budget_tier == "mid_range" else 75)) * travelers_count


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
        travelers = max((draft.adults or 1) + (draft.children or 0), 1)
        fallback = self._get_fallback_content(destination, intent, budget_tier, draft.budget_currency, travelers)

        currency = fallback["currency"]
        
        days = []
        start = draft.start_date or timezone.now().date()
        end = draft.end_date or (start + timedelta(days=2))
        
        # Ensure we always have sequential dates
        if start > end:
            end = start + timedelta(days=2)
            
        current = start
        day_number = 1
        
        single_day_intents = {"hotel_only", "flight_only", "train_only", "bus_only", "cab_only", "transit_only", "food_and_dining"}
        
        # If it's hotel_only or single-day intent
        if intent in single_day_intents:
            activities = []
            
            if intent == "hotel_only":
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
                        "category": "attraction",
                        "title": f"Explore Nearby: {fallback['attractions'][0]['name']}",
                        "location_name": f"{destination}",
                        "start_time": "04:00 PM",
                        "end_time": "06:00 PM",
                        "estimated_cost": 0.0,
                        "currency_code": currency,
                        "status": "pending",
                        "notes": fallback["attractions"][0]["notes"]
                    })
            elif intent in {"flight_only", "train_only", "bus_only", "cab_only", "transit_only"}:
                cat_map = {"flight_only": "flight", "transit_only": "flight", "train_only": "train", "bus_only": "bus", "cab_only": "cab"}
                activities.append({
                    "id": str(uuid.uuid4()),
                    "category": cat_map.get(intent, "flight"),
                    "title": f"Transport Options to {destination}",
                    "location_name": f"{destination}",
                    "start_time": "10:00 AM",
                    "end_time": "12:00 PM",
                    "estimated_cost": float(fallback["hotel_cost"] * 1.5),
                    "currency_code": currency,
                    "status": "pending",
                    "notes": f"Recommended travel options for your trip."
                })
            elif intent == "food_and_dining":
                for idx, r in enumerate(fallback["restaurants"]):
                    activities.append({
                        "id": str(uuid.uuid4()),
                        "category": "food",
                        "title": f"Dining Recommendation: {r['name']}",
                        "location_name": f"{destination}",
                        "start_time": "07:00 PM",
                        "end_time": "09:00 PM",
                        "estimated_cost": float(fallback["food_cost"]),
                        "currency_code": currency,
                        "status": "pending",
                        "notes": r["notes"]
                    })
                
            days.append({
                "day_number": 1,
                "date": start.isoformat(),
                "title": f"Recommendations for {destination}",
                "day_type": "exploration",
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
                            "category": "attraction",
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
                            "category": "attraction",
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
                            "category": "attraction",
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

    def _enrich_and_cache_activity(self, activity, city_obj):
        from apps.reference.models import HotelMaster, AttractionMaster, RestaurantMaster, ActivityMaster
        import random
        
        category = activity.get("category", "activity").lower()
        title = activity.get("title", "")
        query_name = title
        if category == "hotel" and "check-in" in title.lower():
            query_name = title.replace("Check-in at", "").replace("Check in at", "").strip()
            
        found_ref = None
        lat, lng, rating, img, addr = None, None, None, None, None
        enrich_data = None
        
        # 1. First, search local database reference tables
        if category == "hotel":
            ref = HotelMaster.objects.filter(city=city_obj, name__icontains=query_name).first()
            if not ref and len(query_name.split()) > 1:
                first_part = query_name.split()[0]
                if len(first_part) > 3:
                    ref = HotelMaster.objects.filter(city=city_obj, name__icontains=first_part).first()
            if ref:
                found_ref = ref
                lat = float(ref.latitude) if ref.latitude else None
                lng = float(ref.longitude) if ref.longitude else None
                rating = float(ref.user_rating or ref.star_rating or 4.5)
                img = ref.image_url
                addr = ref.address
                
        elif category == "food":
            ref = RestaurantMaster.objects.filter(city=city_obj, name__icontains=query_name).first()
            if ref:
                found_ref = ref
                rating = float(ref.user_rating or 4.2)
                img = ref.image_url
                
        elif category == "attraction":
            ref = AttractionMaster.objects.filter(city=city_obj, name__icontains=query_name).first()
            if ref:
                found_ref = ref
                rating = float(ref.user_rating or 4.4)
                img = ref.image_url
                
        elif category == "activity":
            ref = ActivityMaster.objects.filter(city=city_obj, name__icontains=query_name).first()
            if ref:
                found_ref = ref
                rating = float(ref.user_rating or 4.4)
                img = ref.image_url

        # 2. If not found, call external place details API (using Gemini) and CACHE it!
        if not found_ref:
            try:
                enrich_data = self._call_external_place_details_api(query_name, city_obj.name)
                if enrich_data:
                    lat = enrich_data.get("latitude")
                    lng = enrich_data.get("longitude")
                    rating = enrich_data.get("rating")
                    addr = enrich_data.get("address")
                    img = enrich_data.get("image_url")
                    
                    # 2b. Defensive Slicing & Coercion to respect DB column constraints and avoid DataErrors
                    raw_name = enrich_data.get("name") or query_name
                    safe_name = str(raw_name)[:255] if raw_name else ""
                    safe_img = str(img)[:1000] if img else None
                    safe_addr = str(addr) if addr else None
                    
                    safe_star_rating = None
                    safe_user_rating = None
                    if rating is not None:
                        try:
                            val = float(rating)
                            safe_star_rating = round(val, 1)
                            safe_user_rating = round(val, 2)
                        except (ValueError, TypeError):
                            pass
                    
                    # Cache in DB reference tables with sub-transaction (savepoint) isolation
                    from django.db import transaction as db_transaction
                    try:
                        with db_transaction.atomic():
                            if category == "hotel":
                                HotelMaster.objects.create(
                                    city=city_obj,
                                    name=safe_name,
                                    star_rating=safe_star_rating,
                                    user_rating=safe_user_rating,
                                    address=safe_addr,
                                    image_url=safe_img,
                                    latitude=lat,
                                    longitude=lng
                                )
                            elif category == "food":
                                raw_cuisine = enrich_data.get("details") or "Local Cuisine"
                                safe_cuisine = str(raw_cuisine)[:255]
                                RestaurantMaster.objects.create(
                                    city=city_obj,
                                    name=safe_name,
                                    cuisine=safe_cuisine,
                                    price_range="$$",
                                    user_rating=safe_user_rating,
                                    image_url=safe_img
                                )
                            elif category == "attraction":
                                raw_category = enrich_data.get("details") or "Attraction"
                                safe_category = str(raw_category)[:100]
                                AttractionMaster.objects.create(
                                    city=city_obj,
                                    name=safe_name,
                                    category=safe_category,
                                    user_rating=safe_user_rating,
                                    image_url=safe_img,
                                    suggested_duration_mins=120
                                )
                            elif category == "activity":
                                raw_category = enrich_data.get("details") or "Activity"
                                safe_category = str(raw_category)[:100]
                                ActivityMaster.objects.create(
                                    city=city_obj,
                                    name=safe_name,
                                    category=safe_category,
                                    user_rating=safe_user_rating,
                                    image_url=safe_img,
                                    suggested_duration="3-4 hours"
                                )
                    except Exception as db_ex:
                        print(f"Database caching write failed for {query_name}, continuing smoothly: {db_ex}")
            except Exception as ex:
                print(f"Failed to fetch external details/cache for {query_name}: {ex}")



        # 3. Fallbacks for Lat/Lng coordinate generation if missing to ensure map works
        if lat is None or lng is None:
            city_lat = float(city_obj.latitude or 27.0360)
            city_lng = float(city_obj.longitude or 88.2627)
            lat = city_lat + random.uniform(-0.015, 0.015)
            lng = city_lng + random.uniform(-0.015, 0.015)

        if not img:
            img = self._get_scenic_fallback_image(category, query_name, city_obj.name)

        # 4. Save fields in the activity dictionary
        activity["latitude"] = lat
        activity["longitude"] = lng
        activity["rating"] = rating or 4.5
        activity["image_url"] = img
        
        # Determine dynamic tips
        ai_tip = enrich_data.get("ai_tip") if (not found_ref and enrich_data) else None
        local_tip = enrich_data.get("local_tip") if (not found_ref and enrich_data) else None
        logistics = enrich_data.get("logistics") if (not found_ref and enrich_data) else None
        
        if not ai_tip:
            ai_tip = self._generate_diverse_ai_tip(category, title, city_obj.name, rating or 4.5)
        if not local_tip:
            local_tip = self._generate_diverse_local_tip(category, title, city_obj.name)
        if not logistics:
            logistics = self._generate_diverse_logistics(category, title)
            
        activity["ai_tip"] = ai_tip
        if addr:
            activity["location_name"] = addr
        activity["_aiInsights"] = {
            "localTip": local_tip,
            "aiTip": ai_tip,
            "logistics": logistics,
            "candidates": [
                {
                    "id": f"cand-1-{activity.get('id', '1')}",
                    "title": f"Top Alternative: {city_obj.name} Local Choice",
                    "subtitle": f"Recommended spot in {city_obj.name}",
                    "price": f"INR {int(float(activity.get('estimated_cost', 500) or 500) * 0.9)}",
                    "rating": 4.8,
                    "aiTip": "Loved by locals for authentic experience and shorter waiting times."
                },
                {
                    "id": f"cand-2-{activity.get('id', '2')}",
                    "title": f"Boutique Option: {city_obj.name} Special",
                    "subtitle": f"Premium experience in {city_obj.name}",
                    "price": f"INR {int(float(activity.get('estimated_cost', 500) or 500) * 1.1)}",
                    "rating": 4.7,
                    "aiTip": "Great alternative venue nearby."
                }
            ]
        }


    def _call_external_place_details_api(self, name, city_name):
        from google import genai
        from pydantic import BaseModel, Field
        
        class PlaceDetails(BaseModel):
            name: str = Field(description="Official name of the place")
            rating: float = Field(description="User review rating between 1.0 and 5.0")
            latitude: float = Field(description="Estimated geographical latitude coordinates of the place")
            longitude: float = Field(description="Estimated geographical longitude coordinates of the place")
            address: str = Field(description="Detailed local address or street location")
            details: str = Field(description="Short description of cuisine, category, or specialties")
            ai_tip: str = Field(description="A specific, helpful tip for travelers visiting this spot")
            local_tip: str = Field(description="A localized secret tip or recommendation (e.g. best time/spot)")
            logistics: str = Field(description="Logistical details like access mode, opening hours, or check-in rules")
            
        client = genai.Client()
        prompt = f"""Search and provide details for '{name}' located in '{city_name}'.
        Be highly precise on estimated geographical coordinates (latitude and longitude) based on the location.
        """
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=PlaceDetails,
                    temperature=0.2,
                ),
            )
            data = response.parsed
            img_url = self._get_scenic_fallback_image(name, name, city_name)
            
            return {
                "name": data.name,
                "rating": data.rating,
                "latitude": data.latitude,
                "longitude": data.longitude,
                "address": data.address,
                "details": data.details,
                "ai_tip": data.ai_tip,
                "local_tip": data.local_tip,
                "logistics": data.logistics,
                "image_url": img_url
            }
        except Exception as e:
            print(f"External API failed: {e}")
            return None

    def _call_external_city_coordinates(self, city_name):
        from google import genai
        from pydantic import BaseModel, Field
        
        class Coordinates(BaseModel):
            latitude: float
            longitude: float
            
        client = genai.Client()
        prompt = f"Provide exact latitude and longitude for city: '{city_name}'"
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=Coordinates,
                    temperature=0.0,
                ),
            )
            return {"latitude": response.parsed.latitude, "longitude": response.parsed.longitude}
        except Exception:
            return None

    def _get_scenic_fallback_image(self, category, name, city_name):
        category = str(category).lower()
        images = {
            "hotel": [
                "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=800&q=80"
            ],
            "food": [
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80"
            ],
            "activity": [
                "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80"
            ],
            "flight": [
                "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=80"
            ],
            "transit": [
                "https://images.unsplash.com/photo-1474487548417-781cb71495f3?auto=format&fit=crop&w=800&q=80"
            ]
        }
        
        cat_key = "activity"
        for k in images.keys():
            if k in category:
                cat_key = k
                break
                
        import hashlib
        idx = int(hashlib.md5(name.encode('utf-8')).hexdigest(), 16) % len(images[cat_key])
        return images[cat_key][idx]
 
    def _generate_diverse_ai_tip(self, category, title, city_name, rating):
        t_lower = title.lower()
        if "trek" in t_lower or "hike" in t_lower:
            return f"Ensure you wear sturdy shoes and carry enough water for the trek in {city_name}."
        if "sunset" in t_lower or "sunrise" in t_lower:
            return f"Arrive 30 minutes early to secure the best vantage point for the scenic views."
        if "breakfast" in t_lower or "lunch" in t_lower or "dinner" in t_lower or "cafe" in t_lower:
            return f"Popular spot in {city_name}. Try their signature dishes and local specialties."
        if "market" in t_lower or "shop" in t_lower or "bazaar" in t_lower:
            return f"Great place for local shopping. Don't hesitate to negotiate politely with vendors."
        if category == "hotel":
            return f"A highly rated stay in {city_name} with great access to nearby transit points."
        if category == "food":
            return f"Highly recommended dining option in {city_name}. Features local organic ingredients."
        if category == "activity":
            return f"An excellent sightseeing highlight in {city_name}. Rated {rating}/5.0 by travelers."
        return f"A recommended travel option in {city_name}. Great ratings and reviews."
 
    def _generate_diverse_local_tip(self, category, title, city_name):
        t_lower = title.lower()
        if "trek" in t_lower or "hike" in t_lower:
            return "Start early in the morning to beat the heat and catch clear mountain skies."
        if "sunset" in t_lower or "sunrise" in t_lower:
            return "Stay for a few minutes after the sun goes down for the best colors in the sky."
        if "breakfast" in t_lower or "lunch" in t_lower or "dinner" in t_lower or "cafe" in t_lower:
            return "Ask the server for their fresh catch of the day or chef's secret recommendation."
        if "museum" in t_lower or "fort" in t_lower or "temple" in t_lower:
            return "Hire a local guide at the entrance to uncover the fascinating historical facts."
        return "Ask a local vendor nearby for instructions on accessing the scenic shortcut path."
 
    def _generate_diverse_logistics(self, category, title):
        t_lower = title.lower()
        if "flight" in t_lower:
            return "Ensure check-in is done 2 hours prior to departure. Check baggage limit rules."
        if "train" in t_lower:
            return "Platform numbers can change; double-check the electronic display board upon arrival."
        if category == "hotel":
            return "Standard check-in is at 12 PM. Late check-in can be requested in advance."
        if category == "food":
            return "Walk-ins are welcome, but table reservations are recommended for peak weekend hours."
        return "Easily accessible via local cabs or auto-rickshaws. Parking space is limited."

