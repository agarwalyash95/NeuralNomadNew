# Technical Audit: Neural Nomad

Acted by: Senior Software Architect  
Status: Complete  
Target: Neural Nomad Codebase (Next.js 15 Frontend + Django 5 / DRF Backend)  

---

## 1. Dashboard (HomePage)

### Current Frontend
- **Components**: `HomePage` in `app/page.tsx` rendering `AppShell`, `Hero`, `SmartInsightsBar`, `MoodDestinationSection`, and `AIFeaturesStrip`.
- **Layout**: Full-screen layout structured inside `AppShell` with a compact hero header, mood chips, a seasonal insight ribbon, a masonry-like mood-destination section, and horizontal AI feature tiles.
- **Existing UI**: Sleek dark/light styled sections with clean typography (Inter/Outfit-style), rounded-2xl/rounded-3xl cards, subtle borders (`border-white/30`, `border-slate-200`), gradients, and interactive hover transformations.
- **Current State Management**: Client-side hook `useHomepage` (`hooks/use-homepage.ts`) fetching state. Local component states for active mood chips.
- **Existing API Calls**: Calls `/api/homepage/destinations/`, `/api/homepage/moods/`, `/api/homepage/insights/`, and `/api/homepage/features/` via `homepageService` and `useHomepage` hook.
- **Static Data**: Footer content, placeholder images, and generic descriptions ("Explore the world and find your perfect destination").
- **Hardcoded Values**: Fallback recommended cities when the API yields an empty list. Currency values displayed inside recommended packages defaults to USD or hardcoded INR strings.
- **Missing Loading States**: Component-level skeleton loaders for `SmartInsightsBar` and `AIFeaturesStrip` are missing; they simply hide or render empty during fetching.
- **Missing Error States**: If the homepage APIs fail, the sections fail silently or show blank states without descriptive reload buttons.
- **Missing Empty States**: No custom fallback illustration is rendered if the server returns zero destination recommendations or empty mood categories.

### Backend Integration
- **Connected APIs**: 
  - `GET /api/homepage/destinations/` -> Lists seasonal destination packages.
  - `GET /api/homepage/mood-categories/` -> Lists active travel mood tags (e.g. Adventure, Relax, Cultural).
  - `GET /api/homepage/seasonal-insights/` -> Fetches recent dynamic travel alerts or seasonal suggestions.
  - `GET /api/homepage/ai-features/` -> Fetches interactive feature badges.
- **APIs prepared but unused**: `POST /api/homepage/destinations/{id}/view/` (prepared for analytics/recommender loop but not actively invoked on click).
- **Missing API integration**: Integration to pull personalized recommended destinations based on user profile preferences or search history.
- **Data fetched**: Recommended destinations, mood chips, and seasonal highlight texts.
- **Data not fetched**: Real-time pricing index or live temperature for recommendations (currently static fields in `Destination` model).

### Backend Models Used
- `homepage.MoodCategory`
- `homepage.Destination`
- `homepage.SeasonalInsight`
- `homepage.AIFeatureTile`

### Static Data
- Call-to-action text: "Ready to plan your next adventure?"
- CTA button redirect link: `/attractions`
- Footer credits and links.

### Dynamic Data
- Mood category chips (e.g. Beach, Spiritual, Trekking).
- Curated destination cards (containing title, tags, description, estimate budget, image URL).
- Seasonal insight ribbon content.
- Feature strips (copilot link, forex info, visa preps).

### Missing Features
- Dynamic recommendation engine based on logged-in user interests (`user_preference` interests).
- Live currency conversions matching user's selected preferred currency.

### UI Issues
- Layout shift can occur when high-resolution background hero images load on slow networks.
- Lacks a native reload banner when API requests time out.

### Backend Issues
- High database query count (no prefetching of relation objects in `DestinationViewSet`).

### Suggested Improvements
- Implement Next.js image loading skeletons or blur placeholders for Unsplash background images.
- Cache homepage responses in Redis to withstand heavy load.

---

## 2. Authentication

### Current Frontend
- **Components**: `AuthModal` in `components/ui-custom/auth-modal.tsx` with unified sub-panels for login and registration.
- **Layout**: Centered overlay modal with backdrop-blur (`backdrop-blur-md`), sliding transitions, glassmorphic inputs, and clear password visibility toggles.
- **Existing UI**: Clean modern form styling with smooth focus rings, inline helper texts, and animated alert feedback on failure.
- **Current State Management**: Centralized store `useAuthStore` in `store/auth.store.ts` handling active logged-in `user` payload, tokens, and verification statuses.
- **Existing API Calls**: 
  - `POST /api/accounts/auth/login/` -> Authenticates user and returns JWT.
  - `POST /api/accounts/auth/register/` -> Registers a new user.
  - `POST /api/accounts/auth/logout/` -> Blacklists JWT.
  - `GET /api/accounts/users/me/` -> Retrieves active session profile.
- **Static Data**: Terms of Service and Privacy Policy redirect links.
- **Hardcoded Values**: Localhost fallback endpoints for API client configurations inside `apiClient` service.
- **Missing Loading States**: Disable-state during form submission works well, but lacks a full shimmer mask for the modal when fetching profile details.
- **Missing Error States**: API validation errors (e.g. 400 Bad Request on duplicate emails) are sometimes displayed as generic "Something went wrong" messages instead of highlighting specific form fields.
- **Missing Empty States**: Not applicable (modal form).

### Backend Integration
- **Connected APIs**: Fully integrated and connected to accounts authentication views.
- **APIs prepared but unused**: Password reset trigger, OTP verification endpoints, and social auth pathways.
- **Missing API integration**: Social login triggers (Google OAuth / Apple Sign-In).
- **Data fetched**: Access token (stored in memory), Refresh token (stored in httpOnly cookie), and logged-in user profile dictionary.
- **Data not fetched**: Device-level login history or location logging.

### Backend Models Used
- `accounts.User`
- `accounts.ActivityLog`

### Static Data
- Social media icon SVGs.
- Text labels for form switching.

### Dynamic Data
- Authenticated user session dictionary (`name`, `email`, `preferred_currency`, `avatar`).

### Missing Features
- Password reset flow via mail integration (OTP/token link).
- Multiple device session cancellation.

### UI Issues
- Tab focus ordering inside the login modal can jump in an inconsistent order.

### Backend Issues
- Uses standard JWT with sliding expiration without a background token rotation policy implemented in the client middleware.

### Suggested Improvements
- Implement standard accessibility headers for screen readers within the modal.
- Connect dynamic activity logs inside backend to track user logins.

---

## 3. Planner

### Current Frontend
- **Components**: Left collapsible sidebar `PlannerSidebar`, conversational central feed `PlannerChat` or `FloatingChat`, and canvas layout hub `PlannerWorkspace` containing `ItineraryTimeline`, `PreJourneyChecklist`, and custom helpers.
- **Layout**: Full-screen grid system containing sidebar navigation (18%), chat feed panel (32%), and active visual canvas panel (50%).
- **Existing UI**: Extremely modern look using canvas nodes (`CityHeaderNode`, `DayHeaderNode`, `FlightNode`, `TransitNode`, `GenericNode`). Responsive cards displaying time, leg details, booking references, and custom action sheets.
- **Current State Management**: Controlled by custom Zustand store `planner.store.ts` handling layout, active workspace, active canvas type, and panels collapsible toggles. TanStack Query manages query caching.
- **Existing API Calls**: 
  - `GET/POST /api/planner/workspaces/` -> Lists or initiates user planner workspaces.
  - `GET/POST /api/planner/workspaces/{id}/chat/` -> Message log & AI-generated response.
  - `GET/POST /api/planner/workspaces/{id}/draft/` -> Manages intermediate parameters.
  - `GET/POST /api/planner/workspaces/{id}/plan/` -> Fetches or triggers active trip structures.
- **Static Data**: Local fallback trip structures, mock activities, and timeline details inside `mockData.ts` are heavily utilized when server connections are dry.
- **Hardcoded Values**: Default travelers count (2), currency fallback ("USD" / "INR" fallback), and travel date offsets.
- **Missing Loading States**: Skeletons for `ItineraryTimeline` card nodes. High-frequency loading shimmers for slow Gemini text generations are represented only by a basic "thinking" message.
- **Missing Error States**: If the Gemini API pipeline fails, the chat lists the raw JSON error or keeps the "thinking" status stuck forever.
- **Missing Empty States**: If a workspace has no plan, a blank panel is displayed instead of a visual empty-state illustrator.

### Backend Integration
- **Connected APIs**: Connected to `/api/planner/workspaces/` including `/chat/`, `/draft/`, and `/plan/` endpoints.
- **APIs prepared but unused**: `/api/planner/workspaces/{id}/canvases/` data syncing and `/api/planner/maps/distance/` calculations.
- **Missing API integration**: Live booking sync (cart checkout to book-now api isn't connected to actual itinerary state updates in a dynamic loop).
- **Data fetched**: Conversational logs, draft states, generated JSON-structured itinerary days, and activities list.
- **Data not fetched**: External Mapbox transit durations (calculated via dummy multipliers on city distances).

### Backend Models Used
- `planner.PlannerWorkspace`
- `planner.TripDraftState`
- `planner.PlannerChatMessage`
- `planner.PlannerTrip`
- `reference.City`

### Static Data
- Conversational system prompts.
- Suggested questions.

### Dynamic Data
- AI-generated trip titles, durations, estimated budgets, custom days, activities, and coordinates.

### Missing Features
- Multi-user real-time collaboration on a single workspace.
- Offline support using local storage synchronizer.

### UI Issues
- Keyboard layout covering up the input bar when used on mobile devices.
- Canvas scrolling performance is sluggish on low-end hardware.

### Backend Issues
- Long-running Gemini requests block Django thread or lead to HTTP 504 timeouts on deployment. Needs async tasks or WebSockets.

### Suggested Improvements
- Defer conversational pipeline processing to Celery background workers and use Server-Sent Events (SSE) or WebSockets to update the frontend.

---

## 4. Inventory

### Current Frontend
- **Components**: Embedded search panel in `app/bookings/page.tsx` utilizing `LocationAutocomplete` and `SearchResults`.
- **Layout**: Flexible vertical column cards displaying travel options (flights, hotels, buses, trains, cabs) with matching filter controls.
- **Existing UI**: Polished tabular headers, clear pricing structures, and modern tags showing details (e.g. cabin class, baggage, star-rating, duration).
- **Current State Management**: Custom hook `useTravelSearch` fetching data via `searchService` and updating a standard list array state.
- **Existing API Calls**: `GET /api/bookings/inventory/search/?service=xxx` via `searchService.search`.
- **Static Data**: Static item definitions for fallback view testing.
- **Hardcoded Values**: Airport code lists and carrier lists.
- **Missing Loading States**: Active loading states are well covered with spinners, but are missing visual content cards shimmers.
- **Missing Error States**: Displays blank results when API errors occur rather than error messages.
- **Missing Empty States**: Generic text "No items found." is displayed without any graphical support.

### Backend Integration
- **Connected APIs**: Connected to `/api/bookings/inventory/search/` with filters.
- **APIs prepared but unused**: Advanced price ranges filters, sort actions.
- **Missing API integration**: Third-party GDS (Amadeus, Sabre) or flight aggregation integrations.
- **Data fetched**: Search result matches from the seeded local inventory database.
- **Data not fetched**: Live live-seats remaining counters.

### Backend Models Used
- `bookings.SearchInventory`
- `bookings.Location`

### Static Data
- Travel classes, fare classes, quotas, cab types dropdown options.

### Dynamic Data
- Matching inventory lists (pricing, carrier logos, timings, routing details).

### Missing Features
- Multi-city flight search routing options.
- Dynamic hotel room counts selectors with varying rates.

### UI Issues
- The vertical filter layout takes too much space on smaller screens, forcing the search results down.

### Backend Issues
- Query relies on weak string matching (`__icontains`), lacking full-text indexing or fuzzy search matches.

### Suggested Improvements
- Transition search inventory to dynamic search queries backed by Elasticsearch or PostgreSQL Full-Text Search.

---

## 5. Flights

### Current Frontend
- **Components**: Integrated sub-view inside `app/bookings/page.tsx` and custom node renderer `FlightNode.tsx` within the planner canvas.
- **Layout**: Renders a vertical layout of flights list with baggage allowance, flight codes, duration, and airport names.
- **Existing UI**: Modern flight cards featuring airline logos, timeline layout, and "Book Now" shortcuts.
- **Current State Management**: Handled via `useTravelSearch` state hook.
- **Existing API Calls**: `GET /api/bookings/inventory/search/?service=flight`.
- **Static Data**: Standard mock flights in code file backups.
- **Hardcoded Values**: Economy/Business pricing ratios, weight allowance.
- **Missing Loading States**: Shimmer card placeholders during search.
- **Missing Error States**: Silently loads an empty list when backend encounters flight fetch timeouts.
- **Missing Empty States**: Lacks custom suggestion panels (e.g. "Try another date") when flights list is empty.

### Backend Integration
- **Connected APIs**: API endpoint connected to flight-typed inventory entries.
- **APIs prepared but unused**: Real seat booking checkout endpoint mapping specifically to GDS carriers.
- **Missing API integration**: Skyscanner or Amadeus Flight API integration.
- **Data fetched**: Flight numbers, operating airlines, flight duration, stopovers, price.
- **Data not fetched**: Seat maps, dynamic baggage pricing.

### Backend Models Used
- `bookings.SearchInventory` (with `service_type='flight'`)
- `reference.Airport`
- `reference.Airline`
- `reference.AirportRoute`

### Static Data
- Airline lists and local country airport configurations.

### Dynamic Data
- Flight timings, layovers, durations, real-time rates (in seeded DB).

### Missing Features
- Dynamic seat booking selector frontend widget.
- Real-time price tracking alerts subscription.

### UI Issues
- Lacks a timeline connector when layovers occur, making multi-stop flight cards hard to scan.

### Backend Issues
- Flight routes are simulated locally and lack timezone conversions between departure and arrival stations.

### Suggested Improvements
- Store proper timezone offsets in the `Airport` reference model and compute local departure/arrival offsets dynamically.

---

## 6. Hotels

### Current Frontend
- **Components**: Sub-search view in `app/bookings/page.tsx`, rendering hotel listing details.
- **Layout**: Multi-column hotel list showing thumbnails, rating stars, amenities, and price.
- **Existing UI**: Clean card with rounded edges, high-contrast star ratings, badge tags, and secondary action buttons.
- **Current State Management**: `useTravelSearch` hook manages search responses.
- **Existing API Calls**: `GET /api/bookings/inventory/search/?service=hotel`.
- **Static Data**: Mock hotel amenity arrays.
- **Hardcoded Values**: Default check-in/check-out dates.
- **Missing Loading States**: Skeletons for hotel image cards.
- **Missing Error States**: Blank list if query crashes.
- **Missing Empty States**: No recommended fallbacks if no hotels match the city search.

### Backend Integration
- **Connected APIs**: Connected to hotel-typed search inventory records.
- **APIs prepared but unused**: `/api/bookings/locations/` filtering specifically for hotel areas.
- **Missing API integration**: Booking.com or Expedia API integration.
- **Data fetched**: Hotel names, ratings, address, coordinates, price per night, and feature images.
- **Data not fetched**: Dynamic room availability or guest reviews list.

### Backend Models Used
- `bookings.SearchInventory` (with `service_type='hotel'`)
- `reference.HotelMaster`

### Static Data
- Room configurations, guest count selectors, and default filter parameters.

### Dynamic Data
- Hotel pricing, addresses, ratings, and amenity facilities.

### Missing Features
- Dynamic interactive map showing matching hotels with pricing pins.
- Specific room selections (e.g. Deluxe vs. Executive Suite).

### UI Issues
- Hotel star icons occasionally wrap onto a second line if the hotel name is too long.

### Backend Issues
- Hotel pricing database lacks season-based dynamic rate calculations.

### Suggested Improvements
- Create a relational model for Hotel room tiers, allowing granular check-in quotes based on date ranges.

---

## 7. Bus

### Current Frontend
- **Components**: Bus tab panel selector inside `app/bookings/page.tsx` and custom helper UI layouts.
- **Layout**: Vertical timeline of departure/arrival times, operator name, rating badges, and price labels.
- **Existing UI**: Standardized transit card layout.
- **Current State Management**: Managed inside travel search state.
- **Existing API Calls**: `GET /api/bookings/inventory/search/?service=bus`.
- **Static Data**: Default seat selection limits.
- **Hardcoded Values**: Local service commission charges.
- **Missing Loading States**: Skeleton grid representing bus layouts.
- **Missing Error States**: Fails silently during fetch.
- **Missing Empty States**: Standard generic text.

### Backend Integration
- **Connected APIs**: Connected to `/api/bookings/inventory/search/?service=bus`.
- **APIs prepared but unused**: None.
- **Missing API integration**: Redbus or Abhibus aggregators APIs.
- **Data fetched**: Bus operator, bus type (AC/Non-AC Sleeper), departure, duration, rating, price.
- **Data not fetched**: Real-time seat layouts.

### Backend Models Used
- `bookings.SearchInventory` (with `service_type='bus'`)
- `reference.BusStation`
- `reference.BusRoute`

### Static Data
- Operator dropdown lists, boarding point guidelines.

### Dynamic Data
- Operator schedules, seat rates, ratings.

### Missing Features
- Visual seat layout selector component.
- Live tracking link for active journeys.

### UI Issues
- Heavy text overlap on mobile responsive breakpoints when showing long boarding point names.

### Backend Issues
- Bus station databases are under-populated, lacking secondary transit cities.

### Suggested Improvements
- Integrate real-time API aggregators for multi-region Indian bus networks.

---

## 8. Train

### Current Frontend
- **Components**: Train search component inside `app/bookings/page.tsx`.
- **Layout**: Clean tabular summary of trains, train number, class availability widgets, and journey duration.
- **Existing UI**: IRCTC-inspired design but modernized with clean backgrounds, class-tier chips, and availability quotas.
- **Current State Management**: Controlled by search state.
- **Existing API Calls**: `GET /api/bookings/inventory/search/?service=train`.
- **Static Data**: Hardcoded railway zones data.
- **Hardcoded Values**: Train quota fallbacks (General/Tatkal).
- **Missing Loading States**: Loading shimmers for individual train availability tables.
- **Missing Error States**: Fails silently.
- **Missing Empty States**: Standard text fallbacks.

### Backend Integration
- **Connected APIs**: Connected to train-typed search inventory records.
- **APIs prepared but unused**: PNR status lookup endpoints (prepared but unlinked).
- **Missing API integration**: Real IRCTC GDS or Indian Railways API.
- **Data fetched**: Train name/number, departure/arrival stations, times, classes (e.g. 1A, 2A, 3A, SL), seat availability.
- **Data not fetched**: Live PNR states, platform numbers.

### Backend Models Used
- `bookings.SearchInventory` (with `service_type='train'`)
- `reference.RailwayStation`
- `reference.TrainRoute`

### Static Data
- Quota lists and seat reservation tiers.

### Dynamic Data
- Train schedules, dynamic availability statuses.

### Missing Features
- Live running status tracking integration.
- PNR status checker frontend interface.

### UI Issues
- The seat class selector looks too crowded on mobile screens.

### Backend Issues
- Seat availability is represented by simulated static values rather than live reservation rules.

### Suggested Improvements
- Link train routes to correct Intermediate Railway Stations, calculating dynamic times between legs.

---

## 9. Cab

### Current Frontend
- **Components**: Cab type tab panel inside `app/bookings/page.tsx`.
- **Layout**: Flat layout of cab categories (Mini, Sedan, SUV, Luxury) with car models, flat pricing, and capacity information.
- **Existing UI**: Clean vehicle card with visual vehicle representation, maximum passenger indicators, and hourly guidelines.
- **Current State Management**: Managed via travel search state hook.
- **Existing API Calls**: `GET /api/bookings/inventory/search/?service=cab`.
- **Static Data**: Fixed hourly package multipliers.
- **Hardcoded Values**: Fuel price adjustments, driver allowances.
- **Missing Loading States**: Spinner works fine but missing card-level skeletons.
- **Missing Error States**: Standard fail silent.
- **Missing Empty States**: Lacks custom recommendations.

### Backend Integration
- **Connected APIs**: Connected to cab-typed search inventory records.
- **APIs prepared but unused**: Live route tracking calculations.
- **Missing API integration**: Ola / Uber / MakeMyTrip Cab API services.
- **Data fetched**: Cab model, category, capacity, baggage limit, rating, price per km or flat rates.
- **Data not fetched**: Real-time driver locations, dynamic toll fees.

### Backend Models Used
- `bookings.SearchInventory` (with `service_type='cab'`)

### Static Data
- Cab categories, distance limits, and driver charge guidelines.

### Dynamic Data
- Cab quotes, passenger capacity guidelines, driver ratings.

### Missing Features
- Map-based pickup and drop-off marker pin selections.
- Multi-city hourly packages customizer.

### UI Issues
- Select taxi model images overflow on landscape tablet viewports.

### Backend Issues
- Pricing uses basic flat miles multipliers without factoring in surge pricing periods or night charges.

### Suggested Improvements
- Apply dynamic hourly/night surge pricing rules on the cab search backend.

---

## 10. Bookings

### Current Frontend
- **Components**: Active bookings view page `app/bookings/page.tsx` (displays search and active cart/checkout results), list in `app/vault/bookings/page.tsx`, and detail page in `app/bookings/[id]/page.tsx`.
- **Layout**: Unified layout with active tabs for Upcoming, Completed, and Cancelled bookings.
- **Existing UI**: Premium ticket-styled cards featuring QR codes, status badges (Confirmed, Pending, Cancelled), price details, and quick cancellation buttons.
- **Current State Management**: Uses custom react state and active fetch effect inside the pages.
- **Existing API Calls**: 
  - `GET /api/bookings/` -> Fetches logged-in user bookings.
  - `POST /api/bookings/` -> Creates a booking reservation.
  - `POST /api/bookings/{id}/confirm_payment/` -> Confirms payment status.
  - `POST /api/bookings/{id}/cancel/` -> Cancels booking.
- **Static Data**: QR code image placeholders.
- **Hardcoded Values**: Booking terms and cancellation policies.
- **Missing Loading States**: Skeletons for detailed booking receipts.
- **Missing Error States**: Error messages are triggered only via system alerts instead of modal notifications.
- **Missing Empty States**: Well implemented empty booking screen, though lacks direct visual deep-links to create plans.

### Backend Integration
- **Connected APIs**: Fully connected to `BookingViewSet` DRF endpoints.
- **APIs prepared but unused**: Partial deposit payment view endpoints.
- **Missing API integration**: Integration with real payment gateways (Razorpay, Stripe).
- **Data fetched**: Booking records, prices, references, payment status, dates, and related search inventory information.
- **Data not fetched**: PDF receipts downloads (file generation is simulated).

### Backend Models Used
- `bookings.Booking`
- `bookings.SearchInventory`

### Static Data
- Standard terms, refund conditions, and contact details.

### Dynamic Data
- User booking reference numbers, price tags, statuses, payment methods.

### Missing Features
- Downloadable PDF invoice/ticket generation.
- Dynamic modifications of dates for confirmed bookings.

### UI Issues
- Cancellation confirmation modal lacks a secondary warning prompt.

### Backend Issues
- Relies on single Django model representing all service bookings, limiting unique fields specifically needed for flights (e.g. PNR) vs hotels (e.g. room count).

### Suggested Improvements
- Refactor `Booking` model to use Polymorphic Models or Concrete Subclasses (e.g. `FlightBooking`, `HotelBooking`) to store domain-specific details cleanly.

---

## 11. Attractions

### Current Frontend
- **Components**: Discovery list page `app/attractions/page.tsx`, specific details view `app/attractions/[id]/page.tsx`, and interactive `DetailsModal` component in `components/explore/details-modal.tsx`.
- **Layout**: Beautiful vertical category header, sticky category navigation (All, Sights, Food, Activities), and dynamic masonry grid layout.
- **Existing UI**: Vibrant layouts with large high-definition images, detailed rating badges, and rich maps triggers.
- **Current State Management**: Hooks `useExplore` and `useExploreDetails` coordinate API interaction.
- **Existing API Calls**: 
  - `GET /api/attractions/destinations/` -> Lists cities/destinations.
  - `GET /api/attractions/attractions/` -> Lists attraction places.
  - `GET /api/attractions/attractions/{id}/` -> Details of attraction place.
- **Static Data**: Static description fallbacks.
- **Hardcoded Values**: Category names mapping values.
- **Missing Loading States**: Active loading spinner works well, but layout shifts slightly during Masonry image rendering.
- **Missing Error States**: Blank fallback screen if search prediction fails.
- **Missing Empty States**: Standard search text placeholder.

### Backend Integration
- **Connected APIs**: Connected to `AttractionViewSet` and `DestinationViewSet`.
- **APIs prepared but unused**: Reviews posting endpoint.
- **Missing API integration**: Google Places API direct integration for real-time reviews.
- **Data fetched**: Attraction coordinates, descriptions, ratings, images, suggested duration, category tags.
- **Data not fetched**: Live operating hours or entrance ticket fees.

### Backend Models Used
- `attractions.Attraction`
- `attractions.Destination`
- `reference.City`

### Static Data
- Activity types filter list, placeholder city hero visuals.

### Dynamic Data
- Attractions list, city tags, map locations.

### Missing Features
- Direct booking connector on the attraction page to reserve entry tickets.
- Real-time crowd index indicator.

### UI Issues
- The Masonry grid columns jump during image load, creating minor content shifts.

### Suggested Improvements
- Implement Next-Image optimization with low-res blur hashes to stabilize grid loading.

---

## 12. Visa

### Current Frontend
- **Components**: Embedded inside the Travel Preparation dashboard (`app/travel-prep/page.tsx`) rendering `VisaTab` and `VisaDetailsCard`.
- **Layout**: Clean grid mapping destination countries to visa requirements, status levels (e.g. Visa On Arrival, eVisa), and checklist steps.
- **Existing UI**: Visual steps checklist, requirement lists, document upload dropzones, and status indicators.
- **Current State Management**: React component local state representing selected nationality and destination queries.
- **Existing API Calls**: `GET /api/visa/requirements/` via `visaService`.
- **Static Data**: Default document checklist lists.
- **Hardcoded Values**: Standard visa fee estimations.
- **Missing Loading States**: Lacks visual skeleton cards when changing destination filters.
- **Missing Error States**: Displays blank requirement sheets if country query crashes.
- **Missing Empty States**: Standard no-data text.

### Backend Integration
- **Connected APIs**: Connected to `VisaDataViewSet`.
- **APIs prepared but unused**: Document submission validation routes.
- **Missing API integration**: Direct government eVisa APIs or verification service connections.
- **Data fetched**: Nationalities, visa types, stay durations, policies, notes, fees, processing times.
- **Data not fetched**: Real-time regulatory updates (seeded in database).

### Backend Models Used
- `visa.VisaData`
- `reference.VisaRequirement`

### Static Data
- Document templates list, processing fees.

### Dynamic Data
- Visa policy details, required papers checklist, stay days limit.

### Missing Features
- Live eVisa application wizard with real document uploads and tracking.
- Visa renewal/expiry push notification alerts.

### UI Issues
- Document dropzone does not render active upload progress bars.

### Suggested Improvements
- Implement automatic document format parsing using OCR services on the backend for uploaded passports.

---

## 13. Forex

### Current Frontend
- **Components**: Embedded within Travel Prep (`app/travel-prep/page.tsx`) rendering `ForexTab`, `ConversionBar`, and `VendorCard`.
- **Layout**: Dynamic rate conversion calculator block linked directly to list of certified exchange vendors.
- **Existing UI**: Clean sliders, instant currency flag updates, and real-time dealer card with rating and location details.
- **Current State Management**: Controlled by react-query rate hooks and form states.
- **Existing API Calls**: 
  - `GET /api/forex/rates/` -> Lists active rates.
  - `GET /api/forex/vendors/` -> Lists exchange vendors.
  - `POST /api/forex/requests/` -> Submits door delivery requests.
- **Static Data**: Hardcoded currency symbols dictionary.
- **Hardcoded Values**: Service charge flat fees.
- **Missing Loading States**: Calculator screen freezes slightly during real-time typing updates.
- **Missing Error States**: Blank dealer boards on failures.
- **Missing Empty States**: Default dealer message.

### Backend Integration
- **Connected APIs**: Connected to `ForexDataViewSet`, `ForexVendorViewSet`, and `ForexDeliveryRequestViewSet`.
- **APIs prepared but unused**: Vendor physical stock validations.
- **Missing API integration**: Integration with real-time forex rates stream (e.g., Oanda or OpenExchangeRates).
- **Data fetched**: Conversion ratios, dealer listings, active physical currency stocks, service ranges.
- **Data not fetched**: Live exchange rate updates (refreshed via daily cron seed).

### Backend Models Used
- `forex.ForexData`
- `forex.ForexVendor`
- `forex.VendorCurrencyInventory`
- `forex.ForexDeliveryRequest`

### Static Data
- Static list of currencies, conversion directions guidelines.

### Dynamic Data
- Exchange values, dealer ratings, dynamic delivery slots availability.

### Missing Features
- Multi-dealer bidding system for matching larger exchange amounts.
- Multi-currency travel card order wizard.

### UI Issues
- Rate chart lines are slightly distorted on landscape mobile devices.

### Suggested Improvements
- Connect a live websockets hook to stream active currency rate fluctuations.

---

## 14. Travel Pass

### Current Frontend
- **Components**: Travel pass view rendered inside the secure storage page (`app/vault/pass/page.tsx`).
- **Layout**: Interactive visual list showing active transit passes (e.g. Metro Cards, Rail Passes, Museum Passes).
- **Existing UI**: Digital pass mockup cards showing barcode/QR codes, remaining balance, expirations, and recharge buttons.
- **Current State Management**: State hook loading data from services.
- **Existing API Calls**: 
  - `GET /api/travelpass/passes/` -> Lists active user travel passes.
  - `POST /api/travelpass/passes/{id}/recharge/` -> Recharges card balance.
- **Static Data**: Pass background templates, pass descriptions.
- **Hardcoded Values**: Standard recharge increments (₹100, ₹500, ₹1000).
- **Missing Loading States**: Reloading visual screen freezes during recharging transitions.
- **Missing Error States**: Fails silently during transaction failure.
- **Missing Empty States**: Standard generic layout.

### Backend Integration
- **Connected APIs**: Connected to `TravelPassViewSet`.
- **APIs prepared but unused**: QR dynamic rotation generator.
- **Missing API integration**: Real Transit authority backends (e.g. IRCTC, regional metros).
- **Data fetched**: Pass names, active numbers, balance, status, QR representations, expiration dates.
- **Data not fetched**: Real-time metro swipe history.

### Backend Models Used
- `travelpass.TravelPass`

### Static Data
- Regional metro routes details.

### Dynamic Data
- Current balances, pass validities, dynamic booking tickets.

### Missing Features
- NFC-based pass emulation triggers for compatible smartphones.
- Low balance automatic warning alerts.

### UI Issues
- Pass cards lack smooth flip animations when clicking details.

### Suggested Improvements
- Use the Next.js wallet pass generation API to allow exporting tickets directly to Apple Wallet or Google Wallet.

---

## 15. Profile

### Current Frontend
- **Components**: Settings subview in `app/settings/profile/page.tsx`.
- **Layout**: Standard vertical sidebar form layout with high-definition user profile avatar crop sections, preference select fields, and secure changes controls.
- **Existing UI**: Sleek input cells with consistent typography, custom hover camera indicators on avatar, and clean CTA controls.
- **Current State Management**: Syncs directly with `useAuthStore` to update local session states.
- **Existing API Calls**: `PATCH /api/accounts/users/me/` via `userService.updateProfile`.
- **Static Data**: Static currencies lists, timezone listings.
- **Hardcoded Values**: Avatar file size boundaries (800KB limit).
- **Missing Loading States**: Missing profile fields block overlay during active avatar image uploads.
- **Missing Error States**: Alert banner triggers are standard text rather than field-level indicators.
- **Missing Empty States**: Not applicable.

### Backend Integration
- **Connected APIs**: Connected to `UserViewSet` and `UserPreferenceViewSet` DRF serializers.
- **APIs prepared but unused**: Preference matching algorithm view helpers.
- **Missing API integration**: External avatar crop and compression microservice.
- **Data fetched**: Profile details, contact references, preferred dynamic currency settings, default home airport.
- **Data not fetched**: Full activity history of logged-in sessions.

### Backend Models Used
- `accounts.User`
- `accounts.UserPreference`

### Static Data
- Supported currencies list.

### Dynamic Data
- Profile fields, avatar URL, default currencies.

### Missing Features
- Multi-factor authentication controls panel.
- Account export or permanent deletion triggers.

### UI Issues
- Selected country dropdown lists fail to auto-complete cleanly when typing.

### Suggested Improvements
- Bind fields verification to dynamic confirmation hooks (e.g. email change OTP verification).

---

## 16. Settings

### Current Frontend
- **Components**: Sidebar page navigation panels within the `/settings` folder.
- **Layout**: Sticky navigation links on the left side, updating the active preference cards on the right.
- **Existing UI**: Clean minimalist links featuring micro-icons, active item highlighters, and flat borders.
- **Current State Management**: React component local navigation structures.
- **Existing API Calls**: Calls preference updates views.
- **Static Data**: Support contact guidelines.
- **Hardcoded Values**: Static theme tags.
- **Missing Loading States**: Skeletons for nested preferences modules.
- **Missing Error States**: Fails silently.
- **Missing Empty States**: Not applicable.

### Backend Integration
- **Connected APIs**: Connected to user preferences endpoints.
- **APIs prepared but unused**: Accessibility mode toggles backend saves.
- **Missing API integration**: Integration with localization microservices.
- **Data fetched**: Configured travel preferences, language modes, notification controls.
- **Data not fetched**: Device information.

### Backend Models Used
- `accounts.UserPreference`

### Static Data
- Legal agreements and support contact coordinates.

### Dynamic Data
- Saved notification parameters, currency offsets.

### Missing Features
- App-wide Dark/Light/System theme toggles.
- Accessibility text scalability ratios toggles.

### UI Issues
- Navigation bar does not collapse into a hamburger menu on small mobile screens.

### Suggested Improvements
- Introduce standard CSS theme tokens allowing deep dynamic styling toggles (Dark/Light).

---

## 17. Notifications

### Current Frontend
- **Components**: Notifications feed page in `app/notifications/page.tsx` rendering items.
- **Layout**: Vertical timeline list featuring filter indicators (All, Unread) and bulk action panels.
- **Existing UI**: Modern styled notification nodes featuring type-specific alert icons, click-to-read cards, and active blue indicator badges.
- **Current State Management**: React states tracking notifications list.
- **Existing API Calls**: 
  - `GET /api/notifications/` -> Lists active alerts.
  - `POST /api/notifications/{id}/read/` -> Marks notification as read.
  - `POST /api/notifications/mark_all_read/` -> Bulk read.
- **Static Data**: Static alert guidelines text.
- **Hardcoded Values**: Simulated notification categories list.
- **Missing Loading States**: Timeline skeleton layout during active logs refresh.
- **Missing Error States**: Standard error silent failures.
- **Missing Empty States**: Nice visual screen containing checkmark illustrations when catch-ups are complete.

### Backend Integration
- **Connected APIs**: Connected to `NotificationViewSet`.
- **APIs prepared but unused**: Bulk system-wide alert dispatchers views.
- **Missing API integration**: Direct Web Push notifications API (FCM, OneSignal) or email dispatchers (Sendgrid).
- **Data fetched**: Alert titles, messages, dates, types, read-statuses, dynamic action URLs.
- **Data not fetched**: Email dispatch states.

### Backend Models Used
- `notifications.Notification`

### Static Data
- Icons maps lists.

### Dynamic Data
- Notification bodies, dates, types.

### Missing Features
- Web Push alerts support using standard service workers in frontend app.
- Customizable alert channels preferences checkboxes.

### UI Issues
- Bulk read actions occasionally freeze the timeline layout momentarily.

### Suggested Improvements
- Hook Django signals to Celery tasks to dispatch email alerts when urgent notifications (e.g. flight delays) are stored.

---

## 18. Wallet

### Current Frontend
- **Components**: Wallet details view inside `app/vault/wallet/page.tsx` rendering `PaymentMethodModal` and lists.
- **Layout**: Multi-column summary cards separating Saved Cards, UPI links, and Digital Wallets.
- **Existing UI**: Visual representation of credit cards with custom card type logos (Visa, Mastercard), clear identifiers formats, and simple item delete triggers.
- **Current State Management**: React lists holding methods, synchronized with wallet services.
- **Existing API Calls**: 
  - `GET /api/wallet/payment-methods/` -> Lists saved accounts.
  - `POST /api/wallet/payment-methods/` -> Saves a new billing channel.
  - `DELETE /api/wallet/payment-methods/{id}/` -> Removes a source.
  - `GET /api/wallet/transactions/` -> Lists transactions history.
- **Static Data**: Supported banks listings.
- **Hardcoded Values**: Identifier masks format.
- **Missing Loading States**: Active transactions listings freeze on scroll due to missing load shimmers.
- **Missing Error States**: Alert popup fallback on deletions crash.
- **Missing Empty States**: Informative empty cards guides showing "No UPI linked."

### Backend Integration
- **Connected APIs**: Connected to `PaymentMethodViewSet` and `TransactionViewSet`.
- **APIs prepared but unused**: Dynamic balance top-up endpoint.
- **Missing API integration**: Real billing tokens vaults (PCI-DSS compliant systems like Stripe Customers Vault).
- **Data fetched**: Active payment methods identifiers, transaction amounts, timestamps, statuses (Success, Pending, Failed).
- **Data not fetched**: Real-time linked bank balance values.

### Backend Models Used
- `wallet.SavedPaymentMethod`
- `wallet.TransactionRecord`

### Static Data
- Bank routing routing numbers.

### Dynamic Data
- Saved method provider name, identifiers, transactions logs.

### Missing Features
- Virtual dynamic checkout wallet balances allowing instant trip transactions.
- Automated monthly travel spending analysis charts.

### UI Issues
- Adding a new payment method triggers a visual layout glitch inside the cards deck when the response latency is high.

### Suggested Improvements
- Transition payment identifier saves to modern tokenized billing models to comply with PCI-DSS guidelines.

---

## Technical Audit Summary Table

| Module | Frontend % | Backend % | Integration % | Production Ready % |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard** | 85% | 80% | 85% | 80% |
| **Authentication** | 90% | 90% | 90% | 90% |
| **Planner** | 75% | 60% | 65% | 55% |
| **Inventory** | 80% | 85% | 80% | 80% |
| **Flights** | 80% | 75% | 70% | 65% |
| **Hotels** | 80% | 75% | 70% | 65% |
| **Bus** | 75% | 70% | 65% | 55% |
| **Train** | 80% | 75% | 70% | 65% |
| **Cab** | 75% | 70% | 60% | 55% |
| **Bookings** | 85% | 85% | 80% | 75% |
| **Attractions** | 90% | 85% | 85% | 85% |
| **Visa** | 80% | 80% | 75% | 70% |
| **Forex** | 85% | 80% | 80% | 75% |
| **Travel Pass** | 80% | 75% | 70% | 65% |
| **Profile** | 85% | 85% | 85% | 85% |
| **Settings** | 80% | 75% | 75% | 75% |
| **Notifications** | 85% | 85% | 80% | 80% |
| **Wallet** | 80% | 80% | 75% | 70% |
