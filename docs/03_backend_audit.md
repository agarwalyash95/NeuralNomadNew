# Backend Audit: Neural Nomad

This is a comprehensive, deep-dive technical audit of the Django 5 / Django REST Framework (DRF) backend of Neural Nomad.

---

## Django Application 1: Accounts (`apps/accounts`)

- **Models**: `User`, `UserPreference`, `UploadedDocument`, `ActivityLog`.
- **Serializers**: `UserSerializer`, `UserPreferenceSerializer`, `UploadedDocumentSerializer`, `ActivityLogSerializer`.
- **Views**: `AuthViewSet` (custom endpoints for login, registration, logout), `UserViewSet` (user profiles), `UserPreferenceViewSet` (preferences management), `UploadedDocumentViewSet` (uploaded papers), `ActivityLogViewSet` (readonly log records).
- **Services**: `ProfileService` (handles avatar compression and home airport lookups), `LDAP/OAuthSyncService` (placeholder).
- **Repositories**: Standard Django ORM Querysets.
- **Permissions**: `IsAuthenticated` (for profile settings changes), `AllowAny` (for registration and login views).
- **URLs**: `backend/apps/accounts/urls.py` routing into ViewSets.
- **API Endpoints**: 
  - `POST /api/accounts/auth/login/`
  - `POST /api/accounts/auth/register/`
  - `POST /api/accounts/auth/logout/`
  - `GET/PATCH /api/accounts/users/me/`
  - `GET/PUT /api/accounts/preferences/`
- **Authentication**: JWT authentication (drf-simplejwt) with refresh tokens.
- **Database Tables**: `accounts_user`, `accounts_userpreference`, `accounts_uploadeddocument`, `accounts_activitylog`.
- **Relationships**: `UserPreference` has a 1:1 relationship with `User`. `UploadedDocument` and `ActivityLog` have a Many:1 relationship with `User`.
- **Unused Models**: `UploadedDocument` (models exist, but document scanning features are currently unused).
- **Unused APIs**: Activity Log exports API.
- **Missing APIs**: Active email re-verification APIs, social login gateways (Google/Apple).
- **Business Logic**: Encapsulated within `AuthViewSet` for authentication flows and standard models properties for user permissions.
- **Caching**: User session caching in Redis is planned but currently queries the database directly.
- **Validation**: Email uniqueness verification, phone format validators, and standard password complexity enforcement.
- **Background Jobs**: None (planned: user registration welcome emails).
- **External APIs**: Gravatar API (for default user profiles avatar resolution).
- **Overall Completeness**: **90%** (Robust authentication and preference foundations, but lacks multi-factor and social auth).

---

## Django Application 2: Attractions (`apps/attractions`)

- **Models**: `Attraction`, `Destination`.
- **Serializers**: `AttractionSerializer`, `DestinationSerializer`.
- **Views**: `DestinationViewSet` (readonly list/detail), `AttractionViewSet` (readonly list/detail with pagination).
- **Services**: None.
- **Repositories**: Standard Django ORM.
- **Permissions**: `AllowAny` (discovery feeds are public).
- **URLs**: Routed under `api/attractions/`.
- **API Endpoints**:
  - `GET /api/attractions/destinations/`
  - `GET /api/attractions/attractions/`
  - `GET /api/attractions/attractions/{id}/`
- **Authentication**: Public access (no token required).
- **Database Tables**: `attractions_attraction`, `attractions_destination`.
- **Relationships**: `Attraction` is linked Many:1 with `reference.City` and `attractions.Destination`.
- **Unused Models**: None.
- **Unused APIs**: None.
- **Missing APIs**: Interactive review submissions APIs, attraction ticket reservation webhook APIs.
- **Business Logic**: Category filters (e.g. Sights, Food, Activities) handled via request query filters inside ViewSets.
- **Caching**: Daily cache warming of recommended cities in Redis.
- **Validation**: Standard rating limits (0 to 5.0).
- **Background Jobs**: Automated Unsplash image scraping jobs (daily).
- **External APIs**: Google Places API (used to resolve missing details for attraction objects).
- **Overall Completeness**: **85%** (Excellent read feeds, but lacks interactive elements like comments and reviews).

---

## Django Application 3: Bookings (`apps/bookings`)

- **Models**: `Booking`, `SearchInventory`, `Location`.
- **Serializers**: `BookingSerializer`, `SearchInventorySerializer`, `LocationSerializer`.
- **Views**: `BookingViewSet` (CRUD for logged-in user bookings), `SearchInventoryViewSet` (readonly travel search hub), `LocationViewSet` (autocomplete helpers).
- **Services**: `BookingService` (coordinates payment and confirmation triggers).
- **Repositories**: Django ORM with search filter helpers.
- **Permissions**: `IsAuthenticated` (for booking/orders), `AllowAny` (for searches).
- **URLs**: Under `api/bookings/`.
- **API Endpoints**:
  - `GET /api/bookings/` (Lists user's bookings)
  - `POST /api/bookings/` (Creates a booking slot)
  - `POST /api/bookings/{id}/confirm_payment/` (Marks booking paid)
  - `POST /api/bookings/{id}/cancel/` (Cancels reservation)
  - `GET /api/bookings/inventory/search/` (Search flights, hotels, trains, etc.)
  - `GET /api/bookings/locations/search/` (Autocomplete locations)
- **Authentication**: JWT token authorization required for reservations.
- **Database Tables**: `bookings_booking`, `bookings_searchinventory`, `bookings_location`.
- **Relationships**: `Booking` links to `User` (Many:1) and `SearchInventory` (Many:1).
- **Unused Models**: `Location` database has seeded locations but lacks deep geographic linkages.
- **Unused APIs**: `LocationViewSet.list` is unused in favor of specific `.search` autocomplete endpoints.
- **Missing APIs**: Interactive seat map layout APIs, direct supplier flight/hotel API integrations.
- **Business Logic**: Booking reference generation code using standard UUID prefixes; state transition validations (e.g., preventing completed booking cancellations).
- **Caching**: Search queries cached for 5 minutes in Redis to prevent database hits.
- **Validation**: Strict date limits (e.g. check-out must be after check-in).
- **Background Jobs**: Celery task to auto-cancel reservations if payment confirmation fails within 15 minutes.
- **External APIs**: Simulated aggregator (e.g., Amadeus API mapper).
- **Overall Completeness**: **82%** (Excellent simulation structures and inventory systems, but requires real GDS connections).

---

## Django Application 4: Common (`apps/common`)

- **Models**: `BaseModel` (abstract base with UUID primary keys, soft-delete flags, and audit timestamps).
- **Serializers**: None.
- **Views**: None.
- **Services**: `ErrorLogService` (utility to capture exceptions).
- **Repositories**: None.
- **Permissions**: None.
- **URLs**: None.
- **API Endpoints**: None.
- **Authentication**: Not applicable.
- **Database Tables**: None (all tables inherit abstract properties).
- **Relationships**: Not applicable.
- **Unused Models**: None.
- **Unused APIs**: None.
- **Missing APIs**: Global systems status check dashboard API.
- **Business Logic**: Soft-delete handlers override Django model managers.
- **Caching**: None.
- **Validation**: Global validations helpers.
- **Background Jobs**: Regular database cleanup jobs.
- **External APIs**: None.
- **Overall Completeness**: **95%** (Extremely robust core utilities, used consistently app-wide).

---

## Django Application 5: Forex (`apps/forex`)

- **Models**: `ForexData`, `ForexVendor`, `VendorCurrencyInventory`, `ForexDeliveryRequest`.
- **Serializers**: `ForexDataSerializer`, `ForexVendorSerializer`, `ForexDeliveryRequestSerializer`.
- **Views**: `ForexDataViewSet` (readonly rate queries), `ForexVendorViewSet` (vendor locations and inventory list), `ForexDeliveryRequestViewSet` (creation and list of delivery orders).
- **Services**: `ForexConversionService` (performs dynamic calculations between dynamic currency codes).
- **Repositories**: Standard ORM.
- **Permissions**: `IsAuthenticated` (for delivery requests), `AllowAny` (for rates browsing).
- **URLs**: Routed under `api/forex/`.
- **API Endpoints**:
  - `GET /api/forex/rates/`
  - `GET /api/forex/vendors/`
  - `POST /api/forex/requests/`
- **Authentication**: Token verification required for home-delivery cash requests.
- **Database Tables**: `forex_forexdata`, `forex_forexvendor`, `forex_vendorcurrencyinventory`, `forex_forexdeliveryrequest`.
- **Relationships**: `VendorCurrencyInventory` has Many:1 relationship with `ForexVendor`. `ForexDeliveryRequest` links Many:1 with `User` and `ForexVendor`.
- **Unused Models**: `VendorCurrencyInventory` (seeded but under-utilized by checkout engines).
- **Unused APIs**: Forex conversion chart histories api.
- **Missing APIs**: Live forex rates streams integration.
- **Business Logic**: Cash delivery address parsing, conversion fee margins calculation, delivery slot check rules.
- **Caching**: Exchange rate tables cached in Redis with a 24-hour expiration.
- **Validation**: Delivery limits check (e.g. minimum and maximum exchange values limits).
- **Background Jobs**: Celery schedule tasks to pull live rates from OpenExchangeRates.
- **External APIs**: OpenExchangeRates API.
- **Overall Completeness**: **80%** (Clean dealer systems and orders channels, but requires live rate streams connection).

---

## Django Application 6: Homepage (`apps/homepage`)

- **Models**: `MoodCategory`, `Destination` (homepage recommendation subclass), `SeasonalInsight`, `AIFeatureTile`.
- **Serializers**: `MoodCategorySerializer`, `DestinationSerializer` (homepage recommended), `SeasonalInsightSerializer`, `AIFeatureTileSerializer`.
- **Views**: `DestinationViewSet` (readonly curated destinations), `MoodCategoryViewSet` (readonly moods), `SeasonalInsightViewSet` (readonly banners), `AIFeatureTileViewSet` (readonly feature guides).
- **Services**: `CuratedRecommendationService` (computes seasonal scores).
- **Repositories**: Django ORM.
- **Permissions**: `AllowAny` (landing pages are completely public).
- **URLs**: Under `api/homepage/`.
- **API Endpoints**:
  - `GET /api/homepage/destinations/`
  - `GET /api/homepage/mood-categories/`
  - `GET /api/homepage/seasonal-insights/`
  - `GET /api/homepage/ai-features/`
- **Authentication**: None.
- **Database Tables**: `homepage_moodcategory`, `homepage_destination`, `homepage_seasonalinsight`, `homepage_aifeaturetile`.
- **Relationships**: `Destination` linked Many:1 with `MoodCategory`.
- **Unused Models**: None.
- **Unused APIs**: Curated dynamic package detail views.
- **Missing APIs**: Personalized recommendations based on profile hobbies tags.
- **Business Logic**: Fetches seasonal metrics to recommend winter/summer spots.
- **Caching**: Heavy database query caching in Redis (1-hour TTL) for all landing page endpoints.
- **Validation**: Normal.
- **Background Jobs**: Automatic update of seasonal suggestions.
- **External APIs**: None.
- **Overall Completeness**: **90%** (Extremely complete landing feeds and robust caching capabilities).

---

## Django Application 7: Notifications (`apps/notifications`)

- **Models**: `Notification`.
- **Serializers**: `NotificationSerializer`.
- **Views**: `NotificationViewSet` (CRUD for user notifications feed, custom actions for read toggles).
- **Services**: `PushNotificationService` (dispatches alerts).
- **Repositories**: Standard ORM.
- **Permissions**: `IsAuthenticated`.
- **URLs**: Routed under `api/notifications/`.
- **API Endpoints**:
  - `GET /api/notifications/`
  - `POST /api/notifications/{id}/read/`
  - `POST /api/notifications/mark_all_read/`
- **Authentication**: JWT token required.
- **Database Tables**: `notifications_notification`.
- **Relationships**: Many:1 relationship with `accounts.User`.
- **Unused Models**: None.
- **Unused APIs**: Single notification deletion view.
- **Missing APIs**: Dynamic browser web push setup keys.
- **Business Logic**: Dynamic generation of action URLs pointing user directly to flight or hotel details pages.
- **Caching**: Unread alerts count cached in Redis.
- **Validation**: Limits characters length on messaging alerts.
- **Background Jobs**: Scheduled jobs to auto-clear logs older than 90 days.
- **External APIs**: FCM (Firebase Cloud Messaging) integration.
- **Overall Completeness**: **85%** (Very complete and responsive notifications channels, but requires web-push worker scripts integration).

---

## Django Application 8: Planner (`apps/planner`)

- **Models**: `PlannerWorkspace`, `TripDraftState`, `PlannerChatMessage`, `PlannerTrip`.
- **Serializers**: `PlannerWorkspaceSerializer`, `TripDraftStateSerializer`, `PlannerChatMessageSerializer`, `PlannerTripSerializer`, `ChatResponseSerializer`.
- **Views**: `PlannerWorkspaceViewSet` (CRUD workspace, chat processing, plan generation), `lazy_chat` (stateless quick chat API).
- **Services**: `ConversationService` (orchestrates LLM chats, parses parameters, updates intermediate parameters, triggers plan generation), `PlanService` (creates itinerary structure, timeline days, coordinates), `GeminiProvider` (interfaces with Google Gemini models).
- **Repositories**: Django ORM.
- **Permissions**: `AllowAny` (for demo workspaces), `IsWorkspaceOwner` (IsAuthenticated fallback).
- **URLs**: Under `api/planner/`.
- **API Endpoints**:
  - `GET/POST /api/planner/workspaces/`
  - `GET/POST /api/planner/workspaces/{id}/chat/`
  - `GET /api/planner/workspaces/{id}/draft/`
  - `GET/POST /api/planner/workspaces/{id}/plan/`
  - `POST /api/planner/lazy-chat/`
- **Authentication**: Fully authenticated but provides fallbacks to a demo-user profile when authorization headers are dry.
- **Database Tables**: `planner_workspace`, `planner_trip_draft_state`, `planner_chat_message`, `planner_trip`.
- **Relationships**: `TripDraftState` and `PlannerTrip` are linked 1:1 with `PlannerWorkspace`. `PlannerChatMessage` is Many:1 with `PlannerWorkspace`.
- **Unused Models**: None.
- **Unused APIs**: Stateless quick chat (`lazy_chat` is prepared but bypassed on interactive frontend pages).
- **Missing APIs**: Dynamic intermediate coordinate calculation api.
- **Business Logic**: LLM parameter extraction engine parsing conversational phrases into structured slots (destination, dates, budget, travelers); automatic conversion of currency to user's preferred choice (INR, USD).
- **Caching**: LLM context histories are cached in Redis.
- **Validation**: Slot completeness checks (missing travel dates or destinations flags are calculated on the fly).
- **Background Jobs**: Celery-based AI itinerary generation (currently synchronous, which blocks threads under heavy traffic).
- **External APIs**: Google Gemini API SDK.
- **Overall Completeness**: **60%** (Extremely advanced parameter extraction and plan engines, but requires async task conversions to avoid server timeouts).

---

## Django Application 9: Reference (`apps/reference`)

- **Models**: `Country`, `State`, `City`, `Airport`, `Airline`, `AirportRoute`, `RailwayStation`, `TrainRoute`, `BusStation`, `BusRoute`, `MetroStation`, `HotelMaster`, `RestaurantMaster`, `AttractionMaster`, `ActivityMaster`, `VisaRequirement`, `Currency`, `HolidayCalendar`, `WeatherNormals`, `TravelSeason`, `GooglePlaceCache`.
- **Serializers**: Serializers exist for all geography, transit, and master entity models.
- **Views**: `BaseReferenceViewSet` and distinct sub-views for each static model (readonly).
- **Services**: None.
- **Repositories**: None.
- **Permissions**: `AllowAny`.
- **URLs**: Under `api/reference/`.
- **API Endpoints**: Read-only lists and details endpoints for all master tables.
- **Authentication**: None.
- **Database Tables**: Tables corresponding directly to the 21 models listed.
- **Relationships**: Extremely dense geographic hierarchy (City -> State -> Country) and transit route linkages.
- **Unused Models**: `WeatherNormals`, `HolidayCalendar` (seeded but unreferenced by frontend pages).
- **Unused APIs**: Multiple details views.
- **Missing APIs**: Bulk coordinates region filtering APIs.
- **Business Logic**: Seed commands (`seed_reference.py`) to populate geography, transit lines, and master data.
- **Caching**: Static master tables (Airlines, Countries, Airport Codes) are cached indefinitely in Django cache memory.
- **Validation**: Uniqueness checks on codes (e.g. IATA, Currency codes).
- **Background Jobs**: None.
- **External APIs**: Google Maps API (used to cache places in `GooglePlaceCache`).
- **Overall Completeness**: **95%** (Exhaustive, robust, clean, high-performance static dictionary master databases).

---

## Django Application 10: Travel Pass (`apps/travelpass`)

- **Models**: `TravelPass`.
- **Serializers**: `TravelPassSerializer`.
- **Views**: `TravelPassViewSet` (CRUD and custom recharge action).
- **Services**: `PassRechargeService` (processes balance updates).
- **Repositories**: Django ORM.
- **Permissions**: `IsAuthenticated`.
- **URLs**: Under `api/travelpass/`.
- **API Endpoints**:
  - `GET /api/travelpass/passes/`
  - `POST /api/travelpass/passes/{id}/recharge/`
- **Authentication**: Required.
- **Database Tables**: `travelpass_travelpass`.
- **Relationships**: Linked Many:1 with `accounts.User`.
- **Unused Models**: None.
- **Unused APIs**: Custom metro passes cancellation view.
- **Missing APIs**: NFC token sync APIs.
- **Business Logic**: Processes virtual balances increments, QR encryption codes generations.
- **Caching**: Active balances cached.
- **Validation**: Maximum balance limits check (e.g. up to ₹5,000 max limit).
- **Background Jobs**: None.
- **External APIs**: Simulated Regional Transit Authority gateway.
- **Overall Completeness**: **75%** (Clean card recharge flows, but missing live swipe transactions records).

---

## Django Application 11: Visa (`apps/visa`)

- **Models**: `VisaData`.
- **Serializers**: `VisaDataSerializer`.
- **Views**: `VisaDataViewSet` (readonly requirements query).
- **Services**: None.
- **Repositories**: None.
- **Permissions**: `AllowAny`.
- **URLs**: Under `api/visa/`.
- **API Endpoints**: `GET /api/visa/requirements/`.
- **Authentication**: None.
- **Database Tables**: `visa_visadata`.
- **Relationships**: Linked Many:1 with `reference.Country` (nationality and destination references).
- **Unused Models**: None.
- **Unused APIs**: None.
- **Missing APIs**: Interactive Visa Application wizard submission.
- **Business Logic**: Matches user nationality to destination criteria rules.
- **Caching**: Requirements dictionaries are cached in Redis.
- **Validation**: Character inputs length bounds.
- **Background Jobs**: Daily sync job to scrape consulate rules changes.
- **External APIs**: Simulated visa guidelines scraper.
- **Overall Completeness**: **80%** (Extremely complete policy tables, but lacks user submission flows).

---

## Django Application 12: Wallet (`apps/wallet`)

- **Models**: `SavedPaymentMethod`, `TransactionRecord`.
- **Serializers**: `SavedPaymentMethodSerializer`, `TransactionRecordSerializer`.
- **Views**: `PaymentMethodViewSet` (CRUD for saved billing cards), `TransactionViewSet` (readonly logs list), `CheckoutViewSet` (simulated payment capture).
- **Services**: `PaymentGatewayService` (processes card validations and captures payments via simulated bank gateways).
- **Repositories**: Django ORM.
- **Permissions**: `IsAuthenticated`.
- **URLs**: Under `api/wallet/`.
- **API Endpoints**:
  - `GET/POST/DELETE /api/wallet/payment-methods/`
  - `GET /api/wallet/transactions/`
  - `POST /api/wallet/checkout/`
- **Authentication**: Required.
- **Database Tables**: `wallet_savedpaymentmethod`, `wallet_transactionrecord`.
- **Relationships**: Linked Many:1 with `accounts.User`.
- **Unused Models**: None.
- **Unused APIs**: None.
- **Missing APIs**: Direct webhook capture notifications endpoint.
- **Business Logic**: Card mask format generation, credit ledger balances updates, transaction reference UUID logging.
- **Caching**: Payment method records lists.
- **Validation**: CVV checks, expiration dates limits checks, and UPI pattern matching validations.
- **Background Jobs**: None.
- **External APIs**: Mock Stripe / Razorpay tokenization gateways.
- **Overall Completeness**: **80%** (Clean cards ledger database and transaction logging, but lacks PCI-DSS token storage).
