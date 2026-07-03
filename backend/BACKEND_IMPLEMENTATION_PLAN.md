# NeuralNomad Backend Implementation Plan
> Aligned with Master Plan v5 - Frontend-Compatible Backend Architecture

## Current Frontend Analysis

### ✅ Existing Frontend Structure
1. **Planner Page** (`/planner/page.tsx`) - Has PlannerWorkspace
2. **Canvas System** - All 8 helper canvases created (Flight, Hotel, Train, Bus, Cab, Attractions, Forex, Visa)
3. **Services Layer** - API services exist for all features
4. **State Management** - Zustand stores for auth and booking selection
5. **Types** - Complete TypeScript types for booking, forex, visa, etc.

### ❌ Missing Components (Need to Create)
1. **Start Screen with Chat** - Current planner goes straight to workspace
2. **Create Plan Button** - Transition animation from chat to workspace
3. **Floating Chat Icon** - Bottom-left persistent chat
4. **Plan Canvas Timeline** - City sections with timeline items
5. **Context Panel Map** - Mapbox integration with AI insights
6. **Pre-Journey Checklist** - Visa/Forex/Insurance checklist
7. **Inter-City Transit Cards** - Journey cards between cities

---

## Backend Architecture - Plugin-Based Event-Driven System

### Core Principle: **Frontend reads state, Backend manages intelligence**

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│  • Renders UI                                                │
│  • Reads PlannerMemory state                                 │
│  • Sends user actions                                        │
│  • NO business logic                                         │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                  PLANNER ENGINE (Backend)                    │
│  ┌──────────────┐                                            │
│  │ AI Orchestrat│ ← Gemini generates commands                │
│  │     or       │ → Engine executes commands                 │
│  └──────────────┘                                            │
│         ↓ WorkspaceEvent                                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         Event Bus (Redis Pub/Sub)                       ││
│  └─────────────────────────────────────────────────────────┘│
│         ↓ events                                             │
│  ┌──────────┬──────────┬──────────┬──────────┬────────────┐ │
│  │ Flight   │ Hotel    │ Train    │ Activity │  Forex     │ │
│  │ Canvas   │ Canvas   │ Canvas   │ Canvas   │  Canvas    │ │
│  │ Plugin   │ Plugin   │ Plugin   │ Plugin   │  Plugin    │ │
│  └──────────┴──────────┴──────────┴──────────┴────────────┘ │
│         All plugins self-register on startup                 │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL)                           │
│  • Workspace (conversation + plan state)                    │
│  • TripDraft (structured plan data)                         │
│  • TripActivity (timeline items)                            │
│  • Reference Data (airports, hotels, attractions)           │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Tables Required

```python
# apps/planner/models.py

class Workspace(models.Model):
    """
    One workspace = one conversation + one plan
    Maps to frontend's workspace state
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255, default="Untitled Trip")
    
    # State machine: chat → planning → plan_ready → booking → completed
    state = models.CharField(max_length=20, choices=[
        ('chat', 'Chat - collecting info'),
        ('planning', 'AI building plan'),
        ('plan_ready', 'Plan ready'),
        ('booking', 'Booking in progress'),
        ('completed', 'All booked')
    ], default='chat')
    
    # Structured memory for AI context
    planner_memory = models.JSONField(default=dict)
    # {
    #   "destination": "Tokyo, Japan",
    #   "startDate": "2024-10-01",
    #   "endDate": "2024-10-08",
    #   "travelers": {"adults": 2, "children": 0},
    #   "budget": {"amount": 175000, "currency": "INR", "style": "mid-range"},
    #   "interests": ["food", "culture", "photography"],
    #   "homeCity": "Kolkata",
    #   "currentCity": null,  # Updates as user scrolls plan canvas
    #   "create_plan_ready": true
    # }
    
    # Checklist status for pre-journey tasks
    checklist_status = models.JSONField(default=dict)
    # {
    #   "passport": "completed",
    #   "evisa": "pending",
    #   "forex": "not_started",
    #   "insurance": "completed",
    #   "esim": "pending"
    # }
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'planner_workspace'
        ordering = ['-updated_at']


class ChatMessage(models.Model):
    """
    Chat history - both user and AI messages
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=[('user', 'User'), ('assistant', 'AI')])
    content = models.TextField()
    
    # Widget data attached to AI messages
    widget_type = models.CharField(max_length=50, null=True, blank=True)
    # date_range, budget_picker, traveler_counter, flight_search, etc.
    
    widget_data = models.JSONField(null=True, blank=True)
    # Widget-specific JSON (form fields, options, etc.)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'planner_chat_message'
        ordering = ['timestamp']


class TripDraft(models.Model):
    """
    The structured plan - multiple cities, days, activities
    This is what renders the Plan Canvas timeline
    """
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name='trip_draft')
    
    # Top-level trip data
    title = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)  # "Japan"
    start_date = models.DateField()
    end_date = models.DateField()
    
    # City breakdown
    cities = models.JSONField(default=list)
    # [
    #   {
    #     "id": "city_tokyo",
    #     "name": "Tokyo",
    #     "country": "Japan",
    #     "arrival": "2024-10-01",
    #     "departure": "2024-10-04",
    #     "nights": 3,
    #     "weather": {"temp": 22, "condition": "sunny"},
    #     "color": "#EF4444"  # red circle in header
    #   },
    #   ...
    # ]
    
    # Budget tracking
    budget_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    budget_spent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'planner_trip_draft'


class TripActivity(models.Model):
    """
    Timeline items - flights, hotels, restaurants, activities, etc.
    """
    trip_draft = models.ForeignKey(TripDraft, on_delete=models.CASCADE, related_name='activities')
    
    # Unique ID for frontend reference
    activity_id = models.UUIDField(default=uuid.uuid4, unique=True)
    
    # Category determines icon, color, canvas type
    category = models.CharField(max_length=20, choices=[
        ('flight', 'Flight'),
        ('hotel', 'Hotel'),
        ('restaurant', 'Restaurant'),
        ('train', 'Train'),
        ('bus', 'Bus'),
        ('cab', 'Cab'),
        ('attraction', 'Attraction'),
        ('activity', 'Activity'),
        ('metro', 'Metro'),
        ('ferry', 'Ferry'),
        ('walk', 'Walk'),
        ('note', 'Note'),
    ])
    
    # Timeline positioning
    city_id = models.CharField(max_length=100)  # "city_tokyo"
    day_number = models.IntegerField()  # 1, 2, 3...
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    
    # Display data
    title = models.CharField(max_length=255)  # "Flight to Tokyo"
    description = models.TextField(blank=True)  # "Indigo AI 302 · DEL→HND"
    
    # Complete item data (category-specific)
    data = models.JSONField(default=dict)
    # For flight: {
    #   "flightNumber": "AI 302",
    #   "airline": "Indigo",
    #   "origin": "DEL",
    #   "destination": "HND",
    #   "class": "Economy",
    #   "status": "confirmed",
    #   "bookingRef": "ABC123"
    # }
    
    # Pricing
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='INR')
    
    # AI metadata
    ai_tip = models.TextField(blank=True)  # "Cheapest direct flight today"
    is_ai_pick = models.BooleanField(default=False)
    
    # User notes
    notes = models.TextField(blank=True)
    
    # Ordering within a day
    order = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'planner_trip_activity'
        ordering = ['day_number', 'start_time', 'order']


class WorkspaceEvent(models.Model):
    """
    Event log for debugging and replay
    """
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE)
    event_type = models.CharField(max_length=50)  # 'activity_added', 'budget_updated', etc.
    event_data = models.JSONField()
    triggered_by = models.CharField(max_length=20, choices=[('user', 'User'), ('ai', 'AI'), ('system', 'System')])
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'planner_workspace_event'
        ordering = ['-timestamp']
```

---

## API Endpoints

### 1. Workspace Management

```python
# apps/planner/urls.py

POST   /api/planner/workspaces/                    # Create new workspace
GET    /api/planner/workspaces/                    # List user's workspaces
GET    /api/planner/workspaces/{id}/               # Get workspace detail
PATCH  /api/planner/workspaces/{id}/               # Update workspace (title, state)
DELETE /api/planner/workspaces/{id}/               # Delete workspace

GET    /api/planner/workspaces/{id}/messages/      # Get chat history
POST   /api/planner/workspaces/{id}/messages/      # Send user message (AI responds)

POST   /api/planner/workspaces/{id}/create-plan/   # Trigger plan creation
GET    /api/planner/workspaces/{id}/plan/          # Get TripDraft + activities
```

### 2. Plan Canvas Interactions

```python
POST   /api/planner/trip-drafts/{id}/activities/          # Add activity
PATCH  /api/planner/trip-drafts/{id}/activities/{aid}/    # Update activity
DELETE /api/planner/trip-drafts/{id}/activities/{aid}/    # Remove activity

POST   /api/planner/trip-drafts/{id}/activities/{aid}/replace/   # Replace activity (opens canvas)
POST   /api/planner/trip-drafts/{id}/add-activity/              # Add new (opens canvas)

PATCH  /api/planner/workspaces/{id}/checklist/     # Update checklist status
```

### 3. Canvas Search APIs (Already exist, extend them)

```python
# These already exist - just ensure they return data matching canvas UI

POST   /api/bookings/search/    # Unified search for flight/hotel/train/bus/cab
GET    /api/attractions/search/ # Attractions search
GET    /api/forex/convert/      # Currency conversion
GET    /api/forex/vendors/      # Forex vendors
GET    /api/visa/search/        # Visa requirements
```

---

## Planner Engine Implementation

```python
# apps/planner/engine.py

from typing import Dict, Any, List
import json
from django.conf import settings
import google.generativeai as genai

class PlannerEngine:
    """
    Core orchestration engine - receives user messages, calls Gemini, executes commands
    """
    
    def __init__(self, workspace: Workspace):
        self.workspace = workspace
        self.memory = workspace.planner_memory
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-pro')
    
    async def process_user_message(self, user_message: str) -> Dict[str, Any]:
        """
        Main entry point: user sends message → AI responds → executes commands
        Returns: {
            "ai_response": str,
            "widget": {...},
            "memory_updates": {...},
            "create_plan_ready": bool
        }
        """
        # 1. Save user message
        ChatMessage.objects.create(
            workspace=self.workspace,
            role='user',
            content=user_message
        )
        
        # 2. Build prompt with context
        prompt = self._build_prompt(user_message)
        
        # 3. Call Gemini
        response = await self.model.generate_content_async(prompt)
        ai_text = response.text
        
        # 4. Parse AI response for commands
        commands = self._extract_commands(ai_text)
        
        # 5. Execute commands (update memory, trigger widgets)
        result = await self._execute_commands(commands)
        
        # 6. Save AI message
        ChatMessage.objects.create(
            workspace=self.workspace,
            role='assistant',
            content=result['ai_response'],
            widget_type=result.get('widget_type'),
            widget_data=result.get('widget_data')
        )
        
        return result
    
    def _build_prompt(self, user_message: str) -> str:
        """
        Build prompt with:
        - System instructions (you are NeuralNomad AI...)
        - Current PlannerMemory state
        - Recent chat history (last 10 messages)
        - User's new message
        - Expected response format (JSON with commands)
        """
        system_instructions = """
You are NeuralNomad AI, a travel planning assistant.

Your job:
1. Collect trip information through conversation
2. Show appropriate widgets to make input easy
3. Update PlannerMemory as you learn information
4. When you have destination + startDate + endDate, set create_plan_ready: true

Current Memory State:
{memory}

Respond in JSON format:
{{
  "ai_response": "Your conversational response text",
  "widget": {{"type": "date_range", "data": {{...}}}},  // optional
  "memory_updates": {{"destination": "Tokyo"}},  // optional
  "create_plan_ready": true  // optional
}}

Widget types: date_range, budget_picker, traveler_counter, multi_select, flight_search, trip_summary
"""
        
        memory_json = json.dumps(self.memory, indent=2)
        
        recent_messages = list(
            self.workspace.messages.order_by('-timestamp')[:10]
            .values('role', 'content')
        )[::-1]  # Reverse to chronological
        
        chat_history = "\n".join([
            f"{msg['role'].upper()}: {msg['content']}"
            for msg in recent_messages
        ])
        
        return f"""{system_instructions.format(memory=memory_json)}

Chat History:
{chat_history}

USER: {user_message}

AI (respond in JSON):"""
    
    def _extract_commands(self, ai_response: str) -> Dict:
        """
        Parse AI response - expecting JSON
        """
        try:
            # Strip markdown code blocks if present
            if '```json' in ai_response:
                ai_response = ai_response.split('```json')[1].split('```')[0]
            return json.loads(ai_response)
        except:
            # Fallback if not JSON
            return {
                "ai_response": ai_response,
                "widget": None,
                "memory_updates": {},
                "create_plan_ready": False
            }
    
    async def _execute_commands(self, commands: Dict) -> Dict:
        """
        Execute memory updates, check create_plan_ready status
        """
        # Update memory
        if commands.get('memory_updates'):
            self.workspace.planner_memory.update(commands['memory_updates'])
            self.workspace.save()
        
        # Check if plan is ready
        memory = self.workspace.planner_memory
        is_ready = all([
            memory.get('destination'),
            memory.get('startDate'),
            memory.get('endDate')
        ])
        
        return {
            "ai_response": commands.get('ai_response', ''),
            "widget_type": commands.get('widget', {}).get('type'),
            "widget_data": commands.get('widget', {}).get('data'),
            "memory_updates": commands.get('memory_updates', {}),
            "create_plan_ready": is_ready
        }
    
    async def create_plan(self) -> TripDraft:
        """
        Called when user clicks Create Plan button
        Generates structured itinerary from PlannerMemory
        """
        memory = self.workspace.planner_memory
        
        # Build prompt for itinerary generation
        prompt = f"""
Generate a detailed day-by-day itinerary for:

Destination: {memory['destination']}
Dates: {memory['startDate']} to {memory['endDate']}
Travelers: {memory.get('travelers', {'adults': 2})}
Budget Style: {memory.get('budget', {}).get('style', 'mid-range')}
Interests: {memory.get('interests', [])}

Return JSON with cities, activities, and timings.
Format:
{{
  "cities": [
    {{
      "id": "city_tokyo",
      "name": "Tokyo",
      "arrival": "2024-10-01",
      "departure": "2024-10-04",
      "nights": 3
    }}
  ],
  "activities": [
    {{
      "category": "flight",
      "city_id": "city_tokyo",
      "day_number": 1,
      "start_time": "08:20",
      "end_time": "18:30",
      "title": "Flight to Tokyo",
      "description": "Indigo AI 302 · DEL→HND · Non-stop",
      "data": {{}},
      "price": 52000,
      "ai_tip": "Cheapest direct flight today"
    }}
  ]
}}
"""
        
        response = await self.model.generate_content_async(prompt)
        plan_data = json.loads(response.text)
        
        # Create TripDraft
        trip_draft = TripDraft.objects.create(
            workspace=self.workspace,
            title=f"{memory['destination']} Trip",
            destination=memory['destination'],
            start_date=memory['startDate'],
            end_date=memory['endDate'],
            cities=plan_data['cities'],
            budget_total=memory.get('budget', {}).get('amount', 0)
        )
        
        # Create activities
        for activity_data in plan_data['activities']:
            TripActivity.objects.create(
                trip_draft=trip_draft,
                **activity_data
            )
        
        # Update workspace state
        self.workspace.state = 'plan_ready'
        self.workspace.save()
        
        return trip_draft
```

---

## Next Steps to Implement

### Priority 1: Core Planner Backend
1. Create `apps/planner/` Django app
2. Implement models (Workspace, ChatMessage, TripDraft, TripActivity)
3. Create migrations and run
4. Implement PlannerEngine with Gemini integration
5. Create API views and serializers
6. Add URLs to main config

### Priority 2: Frontend Integration Points
1. Update `/planner/page.tsx` to fetch workspace state
2. Create Start Screen chat component
3. Add Create Plan button with animation
4. Implement Plan Canvas timeline rendering from TripActivity
5. Add Context Panel with Map + AI Insights
6. Connect all 8 canvas "Add to Plan" buttons to API

### Priority 3: Real-time Updates
1. WebSocket connection for chat streaming
2. Live plan updates when AI adds/modifies activities
3. Budget tracker updates in real-time

---

## Implementation Commands

```bash
# 1. Create planner app
cd backend
python manage.py startapp planner
mv planner apps/

# 2. Add to INSTALLED_APPS in settings
# 'apps.planner',

# 3. Create models file (copy schema above)
# 4. Make migrations
python manage.py makemigrations planner
python manage.py migrate

# 5. Install Gemini SDK
pip install google-generativeai
pip freeze > requirements.txt

# 6. Add GEMINI_API_KEY to .env
# GEMINI_API_KEY=your_key_here

# 7. Create serializers, views, URLs
# (code above)

# 8. Test endpoints
curl -X POST http://localhost:8000/api/planner/workspaces/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "Japan Trip"}'
```

---

This implementation:
✅ Follows Master Plan architecture exactly
✅ Compatible with existing frontend
✅ Plugin-based, event-driven
✅ AI-agnostic (Gemini is swappable)
✅ Database-first for reference data
✅ No business logic in React components
✅ Complete separation of concerns

Ready to begin implementation?
