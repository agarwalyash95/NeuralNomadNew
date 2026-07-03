# NeuralNomad - Complete Database & Implementation Plan v2
> **Comprehensive Plan with Reference Tables, AI Tables, and All Required Components**

---

## 🎯 Executive Summary

**Current Status:**
- ✅ Phase 1 Complete: Project structure, frontend/backend initialization
- ✅ Phase 2 Complete: Basic database models (accounts, bookings, wallet, etc.)
- ✅ Reference app created with 22 models
- ⚠️ **Missing:** AI Planner Engine, Complete Reference Data, Full Integration

**What's Missing:**
1. **AI Planner Tables** - Workspace, Memory, Chat, Trip Planning
2. **Enhanced Reference Tables** - Complete static data coverage
3. **AI Integration Layer** - Gemini/OpenAI provider abstraction
4. **Planner Engine** - Timeline, Budget, Route, Conflict Detection
5. **Frontend Planner UI** - Complete planner workspace with canvases

**Total Time Estimate:** **12-14 weeks** (3-3.5 months) for full production-ready implementation

---

## 📊 Database Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEURALNOMAD DATABASE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CORE TABLES (Existing - Accounts, Auth)          ✅         │
│  2. REFERENCE TABLES (Static Data - 30+ tables)      🔄 Expand  │
│  3. AI PLANNER TABLES (Workspace, Memory, Chat)      ❌ Create  │
│  4. BOOKING TABLES (Existing - Extend)               🔄 Enhance │
│  5. WALLET & NOTIFICATIONS (Existing)                ✅         │
│  6. TRAVEL DATA TABLES (Visa, Forex - Existing)      ✅         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Complete Table Inventory

### ✅ Existing Tables (Already Implemented)

#### Core Tables (apps/accounts)
1. **User** - Custom user model with JWT auth
2. **UserPreference** - Travel preferences
3. **UploadedDocument** - Document storage
4. **ActivityLog** - Audit trail

#### Booking Tables (apps/bookings)
5. **Booking** - Confirmed bookings
6. **SearchInventory** - Live search results cache

#### Wallet Tables (apps/wallet)
7. **Wallet** - User wallet
8. **WalletTransaction** - Transaction history

#### Notification Tables (apps/notifications)
9. **Notification** - User notifications

#### Travel Data Tables
10. **VisaData** (apps/visa) - Visa requirements
11. **ForexData** (apps/forex) - Exchange rates
12. **Attraction** (apps/attractions) - Attractions database

#### Travel Pass Tables (apps/travelpass)
13. **TravelPass** - Digital travel documents

#### Homepage Tables (apps/homepage)
14. **Newsletter** - Newsletter subscriptions
15. **ContactQuery** - Contact form submissions

### ✅ Reference Tables (apps/reference - Existing, Need Enhancement)

#### Geography (5 tables)
16. **Country** - Country master
17. **State** - State/province master
18. **City** - City master with lat/long
19. **TimeZoneInfo** - Timezone reference ❌ TO ADD
20. **Continent** - Continent master ❌ TO ADD

#### Transport (13 tables)
21. **Airport** - Airport master
22. **Airline** - Airline master
23. **AirportRoute** - Flight routes
24. **RailwayStation** - Railway stations
25. **TrainRoute** - Train routes
26. **BusStation** - Bus stations
27. **BusRoute** - Bus routes
28. **MetroStation** - Metro stations
29. **MetroLine** - Metro lines ❌ TO ADD
30. **FerryTerminal** - Ferry terminals ❌ TO ADD
31. **FerryRoute** - Ferry routes ❌ TO ADD
32. **CabOperator** - Cab service providers ❌ TO ADD
33. **TransportType** - Transport categories ❌ TO ADD

#### Accommodation & Dining (2 tables)
34. **HotelMaster** - Hotel database
35. **RestaurantMaster** - Restaurant database

#### Attractions & Activities (2 tables)
36. **AttractionMaster** - Attractions database
37. **ActivityMaster** - Activities database

#### Travel Information (5 tables)
38. **VisaRequirement** - Visa rules matrix
39. **Currency** - Currency master
40. **HolidayCalendar** - Public holidays
41. **WeatherNormals** - Historical weather
42. **TravelSeason** - Tourism seasonality

#### Cached Data (1 table)
43. **GooglePlaceCache** - Google Places cache

### ❌ AI Planner Tables (apps/planner - TO CREATE)

#### Core Planner (10 tables)
44. **PlannerWorkspace** - Top-level workspace container
45. **PlannerMemory** - Structured AI memory (JSON fields)
46. **WorkspaceContext** - Trip parameters
47. **WorkspaceChat** - Chat messages with widgets
48. **WorkspaceActivity** - Event audit trail
49. **WorkspaceEvent** - Event bus log
50. **CanvasInstance** - Canvas state tracking
51. **CanvasData** - Canvas persistent data
52. **BookingOrder** - Shopping cart items
53. **SavedPlace** - Bookmarked locations

#### Trip Planning (6 tables)
54. **PlannerTrip** - Journey plan
55. **TripCity** - Multi-city routing
56. **TripDay** - Day containers
57. **TripActivity** - Timeline events
58. **TripRoute** - Route segments
59. **Recommendation** - AI recommendations

#### AI Provider Integration (3 tables)
60. **AIProviderConfig** - Provider settings
61. **AIRequestLog** - API call logging
62. **AIResponseCache** - Response caching

### 🔄 Enhanced Reference Tables (TO ADD)

#### Additional Geography
63. **PointOfInterest** - Generic POI database
64. **Neighborhood** - City neighborhoods
65. **District** - City districts

#### Additional Transport
66. **AirportFacility** - Airport amenities
67. **StationFacility** - Station amenities

#### Pricing Reference
68. **FlightPriceHistory** - Historical flight prices
69. **HotelPriceHistory** - Historical hotel prices

---

## 🗂️ Detailed Table Schemas

### AI Planner Tables (Priority 1)

#### 1. PlannerWorkspace
```python
class PlannerWorkspace(BaseModel):
    """
    One workspace = one conversation + one plan
    Status: draft → planning → plan_ready → booking → traveling → completed
    """
    user = ForeignKey(User, on_delete=CASCADE)
    title = CharField(max_length=255, default="Untitled Trip")
    
    status = CharField(max_length=20, choices=[
        ('draft', 'Draft'),
        ('planning', 'Planning'),
        ('plan_ready', 'Plan Ready'),
        ('booking', 'Booking'),
        ('booked', 'Booked'),
        ('traveling', 'Traveling'),
        ('completed', 'Completed'),
        ('archived', 'Archived')
    ], default='draft')
    
    mode = CharField(max_length=20, choices=[
        ('chat', 'Chat Mode'),
        ('exploring', 'Exploring'),
        ('planning', 'Planning'),
        ('review', 'Review'),
        ('booking', 'Booking'),
        ('traveling', 'Traveling'),
        ('completed', 'Completed')
    ], default='chat')
    
    last_activity_at = DateTimeField(auto_now=True)
    is_archived = BooleanField(default=False)
    
    # Metadata
    metadata = JSONField(default=dict)
```

#### 2. PlannerMemory
```python
class PlannerMemory(BaseModel):
    """
    Structured AI memory - AI reads this, not old chat messages
    """
    workspace = OneToOneField(PlannerWorkspace, on_delete=CASCADE)
    
    # Trip Context (JSON fields for flexibility)
    destination = JSONField(default=dict)  # {city, country, region}
    origin = JSONField(default=dict)  # {city, country, airport_code}
    dates = JSONField(default=dict)  # {start, end, flexible, duration_days}
    travelers = JSONField(default=dict)  # {adults, children, infants}
    budget = JSONField(default=dict)  # {total, currency, style, breakdown}
    
    # Preferences
    transportation_preference = JSONField(default=list)  # ["flight", "train"]
    hotel_preference = JSONField(default=dict)  # {stars, type, amenities}
    interests = JSONField(default=list)  # ["beach", "culture", "food"]
    food_preference = JSONField(default=dict)  # {diet, cuisine, restrictions}
    accessibility = JSONField(default=dict)  # {wheelchair, special_needs}
    pace_preference = CharField(max_length=20)  # relaxed/moderate/packed
    
    # Status
    visa_status = JSONField(default=dict)  # {required, applied, approved}
    forex_status = JSONField(default=dict)  # {required, exchanged, amount}
    insurance_status = JSONField(default=dict)  # {purchased, provider}
    booking_summary = JSONField(default=dict)  # {flights: 2, hotels: 1}
    
    # AI Context
    current_phase = CharField(max_length=50)  # "planning_transport"
    conversation_summary = TextField(blank=True)  # AI-generated summary
    last_ai_action = JSONField(default=dict)  # What AI did last
    user_sentiment = CharField(max_length=20)  # positive/neutral/negative
    
    # Flags
    create_plan_ready = BooleanField(default=False)
    booking_ready = BooleanField(default=False)
```

#### 3. WorkspaceChat
```python
class WorkspaceChat(BaseModel):
    """
    Chat messages with widget metadata + structured commands
    """
    workspace = ForeignKey(PlannerWorkspace, on_delete=CASCADE, related_name='messages')
    
    role = CharField(max_length=10, choices=[
        ('user', 'User'),
        ('assistant', 'AI Assistant'),
        ('system', 'System')
    ])
    
    content = TextField()  # Message text
    
    # Widget data attached to AI messages
    widget_type = CharField(max_length=50, null=True, blank=True)
    # Types: date_range, budget_picker, traveler_counter, destination_card,
    #        flight_search, hotel_search, recommendation_card, confirmation_card
    
    widget_data = JSONField(null=True, blank=True)
    # Widget-specific JSON (form fields, options, defaults)
    
    # Commands generated by AI
    commands = JSONField(default=list)
    # [{"type": "SET_DATES", "payload": {...}}, ...]
    
    # Metadata
    token_count = IntegerField(default=0)
    processing_time_ms = IntegerField(default=0)
    timestamp = DateTimeField(auto_now_add=True)
```

#### 4. TripActivity (Enhanced Timeline)
```python
class TripActivity(BaseModel):
    """
    Timeline events - complete with all metadata
    """
    trip = ForeignKey(PlannerTrip, on_delete=CASCADE, related_name='activities')
    day = ForeignKey(TripDay, on_delete=CASCADE, related_name='activities')
    
    # Identity
    activity_id = UUIDField(default=uuid4, unique=True)
    
    # Category
    category = CharField(max_length=20, choices=[
        ('flight', 'Flight'),
        ('hotel', 'Hotel'),
        ('train', 'Train'),
        ('bus', 'Bus'),
        ('cab', 'Cab'),
        ('metro', 'Metro'),
        ('ferry', 'Ferry'),
        ('walk', 'Walk'),
        ('restaurant', 'Restaurant'),
        ('attraction', 'Attraction'),
        ('activity', 'Activity'),
        ('shopping', 'Shopping'),
        ('note', 'Note'),
        ('checkin', 'Check-in'),
        ('checkout', 'Check-out'),
        ('transfer', 'Transfer'),
        ('break', 'Break/Rest')
    ])
    
    # Display
    title = CharField(max_length=255)
    description = TextField(blank=True)
    icon = CharField(max_length=50, blank=True)
    color = CharField(max_length=7, blank=True)  # Hex color
    
    # Location
    location_name = CharField(max_length=255, blank=True)
    latitude = DecimalField(max_digits=9, decimal_places=6, null=True)
    longitude = DecimalField(max_digits=9, decimal_places=6, null=True)
    address = TextField(blank=True)
    
    # Timing
    start_time = TimeField()
    end_time = TimeField(null=True, blank=True)
    duration_minutes = IntegerField(default=0)
    is_all_day = BooleanField(default=False)
    is_flexible = BooleanField(default=False)
    
    # Travel Info
    distance_km = DecimalField(max_digits=10, decimal_places=2, null=True)
    travel_time_minutes = IntegerField(null=True)
    transport_mode = CharField(max_length=20, blank=True)
    
    # Pricing
    estimated_cost = DecimalField(max_digits=10, decimal_places=2, null=True)
    actual_cost = DecimalField(max_digits=10, decimal_places=2, null=True)
    currency_code = CharField(max_length=3, default='INR')
    
    # References
    booking_order = ForeignKey(BookingOrder, null=True, on_delete=SET_NULL)
    booking = ForeignKey(Booking, null=True, on_delete=SET_NULL)
    reference_id = CharField(max_length=255, blank=True)  # External ID
    
    # Status
    status = CharField(max_length=20, choices=[
        ('suggested', 'Suggested'),
        ('confirmed', 'Confirmed'),
        ('booked', 'Booked'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('modified', 'Modified')
    ], default='suggested')
    
    # AI Metadata
    is_ai_pick = BooleanField(default=False)
    ai_tip = TextField(blank=True)
    ai_confidence = DecimalField(max_digits=3, decimal_places=2, default=0.8)
    
    # User Data
    notes = TextField(blank=True)
    photos = JSONField(default=list)  # URLs
    rating = IntegerField(null=True)  # User rating after completion
    
    # Ordering
    order = IntegerField(default=0)
    
    # Complete data (category-specific)
    data = JSONField(default=dict)
    # For flight: {flightNumber, airline, class, terminal, gate}
    # For hotel: {roomType, checkIn, checkOut, confirmationNumber}
    # For restaurant: {cuisine, reservationTime, partySize}
    
    # Weather info at time of activity
    weather_info = JSONField(default=dict)
```

#### 5. Recommendation (Enhanced)
```python
class Recommendation(BaseModel):
    """
    Rich structured AI recommendations
    """
    workspace = ForeignKey(PlannerWorkspace, on_delete=CASCADE)
    
    # Identity
    type = CharField(max_length=50)  # flight, hotel, activity, visa, transfer
    canvas_type = CharField(max_length=50)  # which canvas to open
    title = CharField(max_length=255)
    description = TextField()
    
    # Intelligence
    confidence = FloatField(default=0.8)  # 0.0 - 1.0
    priority = IntegerField(default=5)  # 1 = highest, 10 = lowest
    reason = TextField()  # Why this is recommended
    
    # Context
    context = JSONField(default=dict)  # When/why this appears
    requirements = JSONField(default=list)  # Prerequisites
    dependencies = JSONField(default=list)  # Other recommendation IDs
    alternatives = JSONField(default=list)  # Alternative options
    
    # Pricing
    estimated_cost = DecimalField(max_digits=10, decimal_places=2, null=True)
    estimated_time_minutes = IntegerField(null=True)
    estimated_savings = DecimalField(max_digits=10, decimal_places=2, null=True)
    currency_code = CharField(max_length=3, default='INR')
    
    # Impact
    impact = CharField(max_length=20, choices=[
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
        ('optional', 'Optional')
    ], default='medium')
    
    # Actions
    actions = JSONField(default=list)  # [{label, command_type, payload}]
    data = JSONField(default=dict)  # Complete structured data
    
    # Status
    is_dismissed = BooleanField(default=False)
    is_accepted = BooleanField(default=False)
    dismissed_at = DateTimeField(null=True)
    accepted_at = DateTimeField(null=True)
    
    # Display
    icon = CharField(max_length=50, blank=True)
    color = CharField(max_length=7, blank=True)
    image_url = URLField(blank=True)
    
    # Expiry
    expires_at = DateTimeField(null=True)
    is_expired = BooleanField(default=False)
```

### Enhanced Reference Tables (Priority 2)

#### 66. TimeZoneInfo
```python
class TimeZoneInfo(models.Model):
    """Timezone reference for all locations"""
    name = CharField(max_length=100, unique=True)  # "Asia/Kolkata"
    abbreviation = CharField(max_length=10)  # "IST"
    utc_offset = CharField(max_length=10)  # "+05:30"
    dst_offset = CharField(max_length=10, blank=True)  # DST offset if applicable
    country = ForeignKey(Country, on_delete=CASCADE)
```

#### 67. PointOfInterest
```python
class PointOfInterest(BaseModel):
    """Generic POI for any location"""
    city = ForeignKey(City, on_delete=CASCADE)
    name = CharField(max_length=255)
    type = CharField(max_length=50)  # viewpoint, landmark, park, etc.
    latitude = DecimalField(max_digits=9, decimal_places=6)
    longitude = DecimalField(max_digits=9, decimal_places=6)
    description = TextField(blank=True)
    image_url = URLField(blank=True)
    rating = DecimalField(max_digits=3, decimal_places=2, null=True)
```

#### 68. FlightPriceHistory
```python
class FlightPriceHistory(models.Model):
    """Historical flight pricing for ML predictions"""
    route = ForeignKey(AirportRoute, on_delete=CASCADE)
    date = DateField()
    price_economy = DecimalField(max_digits=10, decimal_places=2)
    price_business = DecimalField(max_digits=10, decimal_places=2, null=True)
    currency_code = CharField(max_length=3)
    recorded_at = DateTimeField(auto_now_add=True)
```

---

## 🏗️ Implementation Roadmap with Time Estimates

### Phase 3: AI Planner Foundation (3-4 weeks)

**Week 1-2: Database & Models**
- [ ] Create all 16 AI Planner tables
- [ ] Add missing reference tables (TimeZone, POI, etc.)
- [ ] Create migrations
- [ ] Seed initial reference data
- **Deliverable:** Complete database schema ready

**Week 3: Core Planner Engine**
- [ ] Event bus system
- [ ] Context manager
- [ ] Memory manager
- [ ] Command executor
- **Deliverable:** Backend engine core ready

**Week 4: AI Provider Integration**
- [ ] Abstract AIProvider interface
- [ ] Gemini provider implementation
- [ ] Chat service orchestration
- [ ] Widget generation logic
- **Deliverable:** AI integration working

**Time: 3-4 weeks** (including testing)

---

### Phase 4: Timeline & Intelligence Engines (2-3 weeks)

**Week 5: Timeline Engine**
- [ ] Timeline builder
- [ ] Event stream recalculation
- [ ] Drag-drop support
- [ ] Conflict detection
- **Deliverable:** Timeline system complete

**Week 6-7: Intelligence Layers**
- [ ] Budget engine (tracking & forecasting)
- [ ] Route service (Google Maps integration)
- [ ] Recommendation engine
- [ ] Conflict resolution
- **Deliverable:** All engines operational

**Time: 2-3 weeks**

---

### Phase 5: API Layer (1-2 weeks)

**Week 8-9: RESTful APIs**
- [ ] Workspace ViewSets
- [ ] Chat ViewSets
- [ ] Canvas ViewSets
- [ ] Trip/Activity ViewSets
- [ ] Reference data endpoints
- [ ] Serializers & permissions
- **Deliverable:** Complete API layer

**Time: 1-2 weeks**

---

### Phase 6: Frontend Planner UI (4-5 weeks)

**Week 10: Layout Shell**
- [ ] Three-panel layout
- [ ] Sidebar component
- [ ] Chat panel
- [ ] Workspace panel
- [ ] Canvas layout engine
- **Deliverable:** UI skeleton ready

**Week 11-12: Chat & Widgets**
- [ ] Chat components
- [ ] Widget renderer
- [ ] All 10+ widget types
- [ ] Message handling
- **Deliverable:** Interactive chat working

**Week 13: Plan Canvas**
- [ ] Timeline component
- [ ] Timeline items (drag-drop)
- [ ] Budget tracker
- [ ] Route map (Mapbox)
- [ ] Conflict alerts
- **Deliverable:** Plan visualization complete

**Week 14: Execution Canvases**
- [ ] Standard canvas framework
- [ ] Flight canvas
- [ ] Hotel canvas
- [ ] Train/Bus/Cab canvases
- [ ] Attraction/Restaurant canvases
- [ ] Visa/Forex canvases
- **Deliverable:** All canvases operational

**Time: 4-5 weeks**

---

### Phase 7: Integration & Polish (1-2 weeks)

**Week 15-16: Testing & Polish**
- [ ] End-to-end testing
- [ ] Error handling
- [ ] Loading states
- [ ] Animations & transitions
- [ ] Responsive design
- [ ] Performance optimization
- [ ] Documentation
- **Deliverable:** Production-ready planner

**Time: 1-2 weeks**

---

## ⏱️ Timeline Summary

| Phase | Duration | Team Size | Parallel Work Possible |
|-------|----------|-----------|------------------------|
| Phase 3: AI Planner Foundation | 3-4 weeks | 2-3 devs | Backend only |
| Phase 4: Intelligence Engines | 2-3 weeks | 2 devs | Backend only |
| Phase 5: API Layer | 1-2 weeks | 1-2 devs | Backend only |
| Phase 6: Frontend Planner UI | 4-5 weeks | 2-3 devs | Frontend only |
| Phase 7: Integration & Polish | 1-2 weeks | Full team | Full stack |

**Total Sequential Time:** 12-16 weeks (3-4 months)
**With Parallel Work:** 10-12 weeks (2.5-3 months)

### Team Composition Recommendation
- **1 Senior Backend Engineer** - Planner engine & AI integration
- **1 Backend Engineer** - API layer & database
- **1 Senior Frontend Engineer** - Planner UI architecture
- **1 Frontend Engineer** - Components & canvases
- **1 QA Engineer** (part-time) - Testing & validation

---

## 📊 Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| AI provider rate limits | High | Medium | Implement caching & fallback providers |
| Complex timeline calculations | High | Medium | Start with simple logic, iterate |
| UI/UX complexity | Medium | High | Use established design system |
| Google Maps API costs | Medium | Low | Cache routes, use reference data first |
| Data seeding time | Low | High | Automate with scripts |
| Frontend state management | Medium | Medium | Use React Query + Zustand properly |

---

## 🎯 Success Metrics

### MVP Definition (End of Phase 7)
1. ✅ User can create workspace and chat with AI
2. ✅ AI generates structured itinerary with timeline
3. ✅ User can open canvases and search/select items
4. ✅ Selected items appear in timeline
5. ✅ Budget tracking works automatically
6. ✅ Conflicts are detected and shown
7. ✅ User can book through the platform
8. ✅ Mobile responsive

### Performance Targets
- Chat response time: < 3 seconds
- Timeline recalculation: < 500ms
- Canvas search: < 1 second
- Page load: < 2 seconds
- API response: < 500ms (p95)

---

## 💰 Cost Estimation

### Development Costs (Assuming Indian rates)
- Senior Backend Engineer: ₹1.5L - ₹2L/month × 3 months = ₹4.5-6L
- Backend Engineer: ₹80K - ₹1.2L/month × 3 months = ₹2.4-3.6L
- Senior Frontend Engineer: ₹1.2L - ₹1.8L/month × 3 months = ₹3.6-5.4L
- Frontend Engineer: ₹60K - ₹1L/month × 3 months = ₹1.8-3L
- QA Engineer (50%): ₹40K - ₹60K/month × 3 months = ₹1.2-1.8L

**Total Development Cost:** ₹13.5L - ₹20L ($16K - $24K USD)

### Infrastructure Costs (Monthly)
- AWS/Cloud hosting: ₹15-25K/month
- Gemini API: ₹5-10K/month
- Google Maps API: ₹3-8K/month
- Database: ₹5-10K/month
- CDN & Storage: ₹2-5K/month

**Total Monthly Infrastructure:** ₹30-58K/month

---

## 🚀 Quick Start Implementation Order

### If You Want to See Results Fast (2 weeks sprint):

**Week 1: Minimal Backend**
1. Create PlannerWorkspace, WorkspaceChat, PlannerMemory models
2. Basic chat endpoint with Gemini integration
3. Simple command executor (SET_DATES, SET_DESTINATION)

**Week 2: Minimal Frontend**
1. Chat UI with text input
2. Display AI responses
3. Simple date picker widget
4. Show memory state

**Result:** Working chat that remembers context - users can see the magic!

---

## 📝 Notes & Recommendations

1. **Start Small, Scale Fast**
   - Don't build all 69 tables at once
   - Focus on Planner core first
   - Add canvases incrementally

2. **Data Seeding Strategy**
   - Seed only major cities initially (top 50)
   - Add airports as needed
   - Hotels/restaurants can be added later
   - Focus on Indian data first

3. **AI Cost Optimization**
   - Cache AI responses aggressively
   - Use smaller models for simple tasks
   - Implement response streaming

4. **Frontend Performance**
   - Lazy load canvases
   - Virtual scrolling for timelines
   - Optimize re-renders with React.memo

5. **Testing Strategy**
   - Write tests as you build
   - Focus on engine logic testing
   - E2E tests for critical flows
   - Load testing before launch

---

## ✅ Next Immediate Steps

1. **Review & Approve** this plan
2. **Set up project board** (Jira/Linear/GitHub Projects)
3. **Create detailed tickets** for Phase 3
4. **Assign team members**
5. **Set up development environment**
6. **Begin Phase 3 Week 1** - Database models

---

**Document Version:** 2.0  
**Last Updated:** 2024  
**Status:** Ready for Implementation  
**Estimated Completion:** 12-14 weeks from start  
**Budget:** ₹13.5L - ₹20L + ₹30-58K/month infrastructure

