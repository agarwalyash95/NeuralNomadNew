import os
import json
from dataclasses import dataclass
from datetime import date
from typing import List, Optional

from google import genai
from pydantic import BaseModel, Field

from apps.reference.models import City


@dataclass
class EngineResult:
    reply: str
    widgets: list
    commands: list
    extraction_tier: str
    missing_slots: list
    ready: bool


class NearbyCityRecommendation(BaseModel):
    city: str = Field(description="Name of the nearby city/destination.")
    distance: str = Field(description="Approximate travel distance or time from the main destination, e.g., '1.5 hours by train' or '45 mins flight'.")
    why_visit: str = Field(description="A brief, compelling reason why the user should visit this place (e.g. 'Famous for hot springs and Mt. Fuji views').")
    recommended_duration: str = Field(description="Recommended duration for this excursion, e.g., '1 Day' or '1-2 Days'.")


class ExtractedTripData(BaseModel):
    destination_text: Optional[str] = Field(default=None, description="The city or location the user wants to go to. Leave null if not mentioned or unclear.")
    start_date: Optional[str] = Field(default=None, description="ISO format start date (YYYY-MM-DD) if explicitly mentioned or deducible (e.g. next weekend).")
    end_date: Optional[str] = Field(default=None, description="ISO format end date (YYYY-MM-DD) if explicitly mentioned.")
    adults: Optional[int] = Field(default=None, description="Number of adult travelers")
    budget_tier: Optional[str] = Field(default=None, description="One of: budget, mid_range, premium")
    interests: Optional[List[str]] = Field(default=None, description="List of interests like food, nature, culture, shopping, etc.")
    intent: Optional[str] = Field(default=None, description="The user's travel intent. One of: full_trip, hotel_only, flight_only, activities_only, food_and_dining")
    reply: str = Field(description="Conversational response. Do NOT ask for information the user just provided.")
    widgets: List[str] = Field(description="List of widgets to show. Include 'destination_search' if you ask where to go, 'date_range_picker' if you ask for dates, 'optional_trip_details' if asking for travelers/budget/interests, and 'nearby_cities_recommendation' if suggesting excursions.")
    confidence_score: int = Field(description="AI Confidence Score between 0 and 100 based on the completeness and coherence of the trip details.")
    confidence_explanation: str = Field(description="A short, encouraging sentence explaining what details are present/missing.")
    nearby_cities: Optional[List[NearbyCityRecommendation]] = Field(default=None, description="If the user has specified a destination and has a trip longer than 3 days, recommend 2-3 nearby cities or excursions as options.")



class ConversationEngine:
    def __init__(self):
        # We assume GEMINI_API_KEY is in the environment
        self.client = genai.Client()

    def get_db_question_template(self, draft, missing_slots):
        from apps.planner.models import PlannerQuestionBank
        templates = list(PlannerQuestionBank.objects.filter(destination_text="*"))
        intent = draft.intent or "full_trip"
        
        # 1. Destination
        if "destination" in missing_slots:
            for t in templates:
                if "destination" in t.missing_slots:
                    return t
                    
        # 2. Travel Dates
        if "travel_dates" in missing_slots:
            for t in templates:
                if "travel_dates" in t.missing_slots:
                    return t
                    
        # 3. Nearby cities
        if draft.destination_text and draft.start_date and draft.end_date:
            trip_days = (draft.end_date - draft.start_date).days
            if trip_days > 3 and intent == "full_trip":
                already_cities = draft.metadata.get("nearby_cities") if draft.metadata else None
                if not already_cities:
                    for t in templates:
                        if "nearby_cities" in t.missing_slots:
                            return t
                            
        # 4. Optional details depending on intent
        is_budget_missing = not draft.budget_tier
        is_interests_missing = not draft.interests
        is_origin_missing = not draft.metadata or "origin" not in draft.metadata
        is_travelers_missing = not draft.metadata or not draft.metadata.get("optional_submitted")
        
        if intent == "hotel_only":
            if is_budget_missing or is_travelers_missing:
                for t in templates:
                    if t.widget_data.get("intent") == "hotel_only":
                        return t
        elif intent in ["flight_only", "transit_only"]:
            if is_budget_missing or is_travelers_missing or is_origin_missing:
                for t in templates:
                    if t.widget_data.get("intent") == "flight_only":
                        return t
        else: # full_trip
            if is_budget_missing or is_interests_missing or is_origin_missing or is_travelers_missing:
                for t in templates:
                    if t.widget_data.get("intent") == "full_trip" and "interests" in t.missing_slots:
                        return t
                        
        return None

    def process(self, draft, message, history=None, structured_value=None):
        extraction_tier = "ai"
        
        # 1. Always process explicit structured widget actions first
        if structured_value:
            self._apply_structured_value(draft, structured_value)
            extraction_tier = "widget"

        # Determine expected next template from the database based on missing details and intent
        missing_slots = draft.missing_slots()
        template = self.get_db_question_template(draft, missing_slots)
        
        template_instruction = ""
        if template:
            template_instruction = f"""
We have a structured question sequence defined in our database. The next required database-driven question template is:
- Target Missing Slot(s): {template.missing_slots}
- Required Question Context: "{template.question_text}"
- Required Widget Type: "{template.widget_type}"

CRITICAL RULE:
If the user's latest message has NOT provided the detail for '{template.missing_slots[0]}', you MUST prioritize this database-recommended question and widget. Adapt this question conversationally in your reply so it sounds natural, but make sure to ask the user for this missing detail.
In the `widgets` field of your JSON output, you MUST output exactly: `["{template.widget_type}"]`.

EXCEPTION:
If the user HAS just provided the detail for '{template.missing_slots[0]}' in their latest message (e.g. they just told you their destination or dates), you MUST ignore this database template, extract their provided detail, save it, and proceed to ask for the NEXT missing detail in the sequence (asking for travel dates using "date_range_picker" if they just provided the destination, or asking for travelers/budget using "optional_trip_details" if dates are also known).
"""

        # 2. Use Gemini AI to process natural language and generate response
        reply = "I'm sorry, I encountered an error."
        widgets = []
        
        try:
            today_str = date.today().isoformat()
            
            # Lookup persistent question bank historical patterns to teach and guide Gemini
            from apps.planner.models import PlannerQuestionBank
            history_context = ""
            if draft.destination_text:
                dest_clean = draft.destination_text.lower().strip()
                past_questions = PlannerQuestionBank.objects.filter(
                    destination_text__iexact=dest_clean,
                    success_count__gt=0
                ).order_by("-success_count")[:3]
                if past_questions:
                    history_context = "\nHistorically highly successful clarifying questions and widgets for " + draft.destination_text + ":\n"
                    for q in past_questions:
                        history_context += f"- Question: \"{q.question_text}\" (Widget: {q.widget_type}, Successes: {q.success_count})\n"

            system_prompt = f"""You are NeuralNomad, an expert AI travel planner.
Current Date: {today_str}

The user is planning a trip. Here is the current known state of their trip draft BEFORE their latest message:
- Intent: {draft.intent}
- Destination: {draft.destination_text or 'Unknown'}
- Start Date: {draft.start_date or 'Unknown'}
- End Date: {draft.end_date or 'Unknown'}
- Travelers: Adults {draft.adults}, Children {draft.children}
- Starting Location (Origin): {draft.metadata.get('origin') if draft.metadata else 'Unknown'}
- Budget Tier: {draft.budget_tier or 'Unknown'}
- Interests: {draft.interests or 'Unknown'}
{history_context}

Your goal is to extract any newly mentioned information from their latest message, and respond conversationally.
CRITICAL RULES:
1. DETECT INTENT: Pay close attention to what the user wants. If they only ask for a hotel, set intent to 'hotel_only'. If only flights, 'flight_only'. If only activities, 'activities_only'. Default to 'full_trip'.
2. If the user provides a destination or dates in their latest message, DO NOT ask for them again.
3. If Destination or Travel Dates are truly missing (both in the draft and their latest message), you MUST ask for them first.
4. TAILOR QUESTIONS TO INTENT: If the intent is 'hotel_only', ask about stay preferences (luxury vs budget, area). If 'flight_only', ask about flight preferences. If 'activities_only', ask about interests. Do not ask about flights if they just want a hotel. NEVER ask unnecessary questions that do not align with the user's intent.
5. BE INTELLIGENT: If the user just gave you a destination, your reply MUST include a brief, fascinating fact about it, the best month to visit, and what makes it special, BEFORE asking your next follow-up question.
6. You can ask for multiple things at once.
7. STRICT SINGLE-WIDGET SEQUENCE: NEVER suggest more than ONE widget at a time to keep the UI clean and simple. Set the widgets field to match the database expected widget type.
8. DO NOT ask for details that are already known in the trip draft state above. If a field (e.g. Budget Tier, Travelers, Starting Location) is already set (not 'Unknown'), do NOT include it in any follow-up questions or widgets.
9. NEARBY CITIES RECOMMENDATIONS: If the destination and dates are known and trip length is more than 3 days, recommend 2-3 fascinating nearby cities or excursions as suggestions in the `nearby_cities` field, and suggest 'nearby_cities_recommendation' in the `widgets` list.
10. CONFIDENCE LEVEL: Calculate an integer `confidence_score` (0 to 100) indicating how complete and coherent the planning profile is.
Provide an encouraging, helpful sentence in `confidence_explanation` highlighting what was successfully configured and what details (e.g. travel dates, travelers, budget, or interests) could be added next to hit 100% confidence.
11. RECOMMENDED BUDGET: If the destination is known and the user has not provided a budget, you MUST recommend a realistic, estimated starting budget (in INR or USD/local currency) for their trip based on the destination and travel length. For example, 'Based on Tokyo for 5 days, I recommend a budget of around $1,200 for a mid-range experience, or $600 for budget.' Make sure to mention this recommended budget clearly and conversationally in your reply.
{template_instruction}
"""

            # Build chat history for Gemini
            chat_contents = []
            if history:
                for msg in history:
                    role = "user" if msg.role == "user" else "model"
                    chat_contents.append({"role": role, "parts": [{"text": msg.message}]})
            
            chat_contents.append({"role": "user", "parts": [{"text": message or "Update my trip."}]})

            # Call Gemini with Structured Outputs
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=chat_contents,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    response_schema=ExtractedTripData,
                    temperature=0.3,
                ),
            )
            
            # Parse response
            ai_data = response.parsed
            
            # Update draft from AI extractions
            if ai_data.destination_text and not draft.destination_text:
                city = City.objects.select_related("country").filter(name__iexact=ai_data.destination_text).first()
                if city:
                    draft.destination_city = city
                    draft.destination_text = city.name
                else:
                    draft.destination_text = ai_data.destination_text
            
            if ai_data.start_date and not draft.start_date:
                draft.start_date = ai_data.start_date
            if ai_data.end_date and not draft.end_date:
                draft.end_date = ai_data.end_date
            if ai_data.adults:
                draft.adults = ai_data.adults
            if ai_data.budget_tier:
                draft.budget_tier = ai_data.budget_tier
            if ai_data.interests:
                draft.interests = ai_data.interests
            if ai_data.intent:
                draft.intent = ai_data.intent

            reply = ai_data.reply

            # Store confidence rating in draft metadata
            if not draft.metadata:
                draft.metadata = {}
            draft.metadata["confidence_score"] = getattr(ai_data, "confidence_score", 50)
            draft.metadata["confidence_explanation"] = getattr(ai_data, "confidence_explanation", "Details are partially complete.")
            
            # Enforce single widget sequencing from database template
            is_template_still_valid = True
            if template:
                for slot in template.missing_slots:
                    if slot == "destination" and draft.destination_text:
                        is_template_still_valid = False
                    elif slot == "travel_dates" and draft.start_date and draft.end_date:
                        is_template_still_valid = False
                    elif slot == "nearby_cities" and draft.metadata and draft.metadata.get("nearby_cities"):
                        is_template_still_valid = False
                    elif slot == "budget" and draft.budget_tier:
                        is_template_still_valid = False
                    elif slot == "interests" and draft.interests:
                        is_template_still_valid = False
                    elif slot == "origin" and draft.metadata and draft.metadata.get("origin"):
                        is_template_still_valid = False
                    elif slot == "travelers" and draft.metadata and draft.metadata.get("optional_submitted"):
                        is_template_still_valid = False

            chosen_widget = template.widget_type if (template and is_template_still_valid) else None
            if not chosen_widget:
                if not draft.destination_text:
                    chosen_widget = "destination_search"
                elif not (draft.start_date and draft.end_date):
                    chosen_widget = "date_range_picker"
                elif getattr(ai_data, "nearby_cities", None) and "nearby_cities_recommendation" in getattr(ai_data, "widgets", []):
                    chosen_widget = "nearby_cities_recommendation"
                elif "optional_trip_details" in getattr(ai_data, "widgets", []):
                    chosen_widget = "optional_trip_details"
                elif getattr(ai_data, "widgets", []):
                    for w in ["destination_search", "date_range_picker", "nearby_cities_recommendation", "optional_trip_details"]:
                        if w in ai_data.widgets:
                            chosen_widget = w
                            break

            if chosen_widget:
                data_payload = {}
                if chosen_widget == "nearby_cities_recommendation":
                    data_payload["destination"] = draft.destination_text
                    suggestions = []
                    if getattr(ai_data, "nearby_cities", None):
                        suggestions = [
                            {
                                "city": s.city,
                                "distance": s.distance,
                                "why_visit": s.why_visit,
                                "recommended_duration": s.recommended_duration
                            } for s in ai_data.nearby_cities
                        ]
                    else:
                        suggestions = [
                            {
                                "city": "Hakone" if (draft.destination_text or "").lower() == "tokyo" else "Scenic Outskirts",
                                "distance": "1.5 hours away",
                                "why_visit": "A stunning excursion option with gorgeous views and unique history.",
                                "recommended_duration": "1 Day"
                            }
                        ]
                    data_payload["suggestions"] = suggestions
                    widgets.append({"type": chosen_widget, "data": data_payload})
                elif chosen_widget == "optional_trip_details":
                    # Determine potential fields based on user intent
                    fields = ["travelers", "budget", "interests", "origin"]
                    if draft.intent == "hotel_only":
                        fields = ["travelers", "budget"]
                    elif draft.intent in ["flight_only", "transit_only"]:
                        fields = ["travelers", "budget", "origin"]
                    elif draft.intent == "food_and_dining":
                        fields = ["travelers", "budget"]

                    # Filter out fields that have already been supplied
                    filtered_fields = []
                    for f in fields:
                        if f == "budget":
                            if not draft.budget_tier:
                                filtered_fields.append(f)
                        elif f == "interests":
                            if not draft.interests:
                                filtered_fields.append(f)
                        elif f == "origin":
                            if not draft.metadata or "origin" not in draft.metadata:
                                filtered_fields.append(f)
                        elif f == "travelers":
                            if not draft.metadata or not draft.metadata.get("optional_submitted"):
                                filtered_fields.append(f)

                    if filtered_fields:
                        data_payload["fields"] = filtered_fields
                        data_payload["intent"] = draft.intent
                        widgets.append({"type": chosen_widget, "data": data_payload})
                else:
                    widgets.append({"type": chosen_widget, "data": data_payload})

                    
        except Exception as e:
            print(f"Gemini AI Error: {e}")
            import traceback
            with open("C:\\Users\\ASUS\\.gemini\\antigravity-ide\\brain\\39dfd3f6-1d06-47eb-a1f7-34490bca38e8\\scratch\\ai_error.txt", "w") as f:
                f.write(traceback.format_exc())
            
            # Database-driven fallback
            missing = draft.missing_slots()
            template = self.get_db_question_template(draft, missing)
            if template:
                reply = template.question_text
                chosen_widget = template.widget_type
                
                # Special construction of data payload for fallback
                data_payload = {}
                if chosen_widget == "nearby_cities_recommendation":
                    data_payload["destination"] = draft.destination_text
                    data_payload["suggestions"] = [
                        {
                            "city": "Hakone" if (draft.destination_text or "").lower() == "tokyo" else "Scenic Outskirts",
                            "distance": "1.5 hours away",
                            "why_visit": "A stunning excursion option with gorgeous views and unique history.",
                            "recommended_duration": "1 Day"
                        }
                    ]
                elif chosen_widget == "optional_trip_details":
                    fields = template.widget_data.get("fields", ["travelers", "budget"])
                    filtered_fields = []
                    for f in fields:
                        if f == "budget" and not draft.budget_tier:
                            filtered_fields.append(f)
                        elif f == "interests" and not draft.interests:
                            filtered_fields.append(f)
                        elif f == "origin" and (not draft.metadata or "origin" not in draft.metadata):
                            filtered_fields.append(f)
                        elif f == "travelers" and (not draft.metadata or not draft.metadata.get("optional_submitted")):
                            filtered_fields.append(f)
                    
                    if filtered_fields:
                        data_payload["fields"] = filtered_fields
                        data_payload["intent"] = draft.intent
                
                widgets = [{"type": chosen_widget, "data": data_payload}]
            else:
                reply = "Ready to create the plan! Anything else?"
                widgets = []

        draft.save()
        
        return EngineResult(
            reply=reply,
            widgets=widgets,
            commands=[],
            extraction_tier=extraction_tier,
            missing_slots=draft.missing_slots(),
            ready=draft.is_ready_for_plan,
        )

    def _apply_structured_value(self, draft, structured_value):
        field = structured_value.get("field")
        value = structured_value.get("value")

        if field == "destination" and isinstance(value, dict):
            draft.destination_text = value.get("name", "")[:160]
            city_id = value.get("id")
            if city_id:
                draft.destination_city_id = city_id
        elif field == "travel_dates" and isinstance(value, dict):
            draft.start_date = value.get("start_date") or draft.start_date
            draft.end_date = value.get("end_date") or draft.end_date
        elif field == "travelers" and isinstance(value, dict):
            draft.adults = max(int(value.get("adults", draft.adults) or 1), 1)
            draft.children = max(int(value.get("children", draft.children) or 0), 0)
            draft.infants = max(int(value.get("infants", draft.infants) or 0), 0)
        elif field == "budget":
            if isinstance(value, dict):
                draft.budget_tier = value.get("tier", draft.budget_tier)
                draft.budget_amount = value.get("amount", draft.budget_amount)
                draft.budget_currency = value.get("currency", draft.budget_currency)
            elif isinstance(value, str):
                draft.budget_tier = value[:40]
        elif field == "interests":
            draft.interests = value if isinstance(value, list) else draft.interests
        elif field == "optional_trip_details" and isinstance(value, dict):
            if "travelers" in value and value["travelers"] is not None:
                draft.adults = max(int(value["travelers"] or 1), 1)
            if "budget" in value and value["budget"] is not None:
                b = value["budget"]
                if isinstance(b, dict):
                    draft.budget_tier = b.get("tier", draft.budget_tier)
                    draft.budget_amount = b.get("amount", draft.budget_amount)
                    draft.budget_currency = b.get("currency", draft.budget_currency)
            if "interests" in value and value["interests"] is not None:
                draft.interests = value["interests"] if isinstance(value["interests"], list) else draft.interests
            if "origin" in value and value["origin"] is not None:
                if not draft.metadata:
                    draft.metadata = {}
                draft.metadata["origin"] = value["origin"]
            
            if not draft.metadata:
                draft.metadata = {}
            draft.metadata["optional_submitted"] = True
        elif field == "add_nearby_city":
            if not draft.metadata:
                draft.metadata = {}
            nearby_cities = draft.metadata.get("nearby_cities", [])
            
            if isinstance(value, dict):
                cities = value.get("cities")
                if isinstance(cities, list):
                    for c in cities:
                        if c and c not in nearby_cities:
                            nearby_cities.append(c)
                else:
                    city_name = value.get("city")
                    if city_name and city_name not in nearby_cities:
                        nearby_cities.append(city_name)
            elif isinstance(value, list):
                for c in value:
                    if c and c not in nearby_cities:
                        nearby_cities.append(c)
            elif isinstance(value, str):
                if value and value not in nearby_cities:
                    nearby_cities.append(value)
            
            draft.metadata["nearby_cities"] = nearby_cities


