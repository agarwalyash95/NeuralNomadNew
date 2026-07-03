# Integration Checklist: Neural Nomad

This document is a comprehensive, production-grade tracking sheet detailing the frontend-to-backend integration matrix for all interactive React components, pages, and features of **Neural Nomad**. 

---

## 1. Homepage & Landing Components

### Hero Section
- **File Path**: `frontend/src/components/home/hero.tsx`
- **API Used**: `homepageService.getMoods()`
- **Backend Endpoint**: `GET /api/homepage/mood-categories/`
- **Mock/Static Data Still Present**: Static hero background image Unsplash links, fallback static titles, and static category icon strings if API returns unmapped icons.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (handled gracefully with hook states)
- **Missing Error State**: Yes (does not show a retry action button or friendly crash interface; chip bar remains hidden)
- **Missing Empty State**: Yes (silently hides the category select bar if the list is empty)
- **Priority**: High

### Smart Insights Bar
- **File Path**: `frontend/src/components/home/smart-insights-bar.tsx`
- **API Used**: `homepageService.getInsights()`
- **Backend Endpoint**: `GET /api/homepage/seasonal-insights/`
- **Mock/Static Data Still Present**: Fallback advisory notices, hardcoded weather values, and seasonal texts if fetch fails.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (entire insight ribbon remains invisible/hidden during API loads instead of rendering a premium shimmer line)
- **Missing Error State**: Yes (silently crashes and remains hidden if API throws a timeout or exception)
- **Missing Empty State**: Yes (silently hides without fallback illustration)
- **Priority**: Medium

### Mood Destination Grid
- **File Path**: `frontend/src/components/home/mood-destination-section.tsx` (incorporating `destination-grid.tsx`)
- **API Used**: `homepageService.getDestinations()`
- **Backend Endpoint**: `GET /api/homepage/destinations/`
- **Mock/Static Data Still Present**: Standard fallback Unsplash images for categories and mock destination description snippets.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (uses clean card shimmer skeleton grids)
- **Missing Error State**: Yes (renders an empty white section upon backend database down/timeout)
- **Missing Empty State**: Yes (does not show a "No destinations match your mood" graphic or illustration)
- **Priority**: High

### AI Features Strip
- **File Path**: `frontend/src/components/home/ai-features-strip.tsx`
- **API Used**: `homepageService.getFeatures()`
- **Backend Endpoint**: `GET /api/homepage/ai-features/`
- **Mock/Static Data Still Present**: Fallback icon representations, feature title listings, and static service summaries (e.g. Visa assistance, custom travel routes).
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (renders blank space during loading cycles)
- **Missing Error State**: Yes (silently hides the strip on API timeouts)
- **Missing Empty State**: Yes (hides without rendering custom illustrations)
- **Priority**: Low

---

## 2. Attractions Discovery Components

### Place Card Grid
- **File Path**: `frontend/src/components/explore/place-card.tsx`
- **API Used**: `attractionService.getAttractions()`
- **Backend Endpoint**: `GET /api/attractions/attractions/`
- **Mock/Static Data Still Present**: Place card descriptions, hardcoded rating scales, and fallback image indicators.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (handled seamlessly on parent container wrappers)
- **Missing Error State**: Yes (shows clean empty container but fails to render a "Retry connection" button)
- **Missing Empty State**: Yes (shows empty list with no fallback graphic)
- **Priority**: High

### Attraction Details Modal
- **File Path**: `frontend/src/components/explore/details-modal.tsx`
- **API Used**: `attractionService.getAttractionDetails(id)`
- **Backend Endpoint**: `GET /api/attractions/attractions/{id}/`
- **Mock/Static Data Still Present**: Local static array containing mock reviews, ratings, and customer profile photos.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (renders a beautiful glassmorphism loading spinner overlay)
- **Missing Error State**: Yes (renders a completely blank modal panel upon network load failure)
- **Missing Empty State**: Yes (no visual layout fallback if review lists or business hours are missing)
- **Priority**: High

### Default Panel (Saved Attractions)
- **File Path**: `frontend/src/components/explore/default-panel.tsx`
- **API Used**: `savedPlaceService.getSavedPlaces()`
- **Backend Endpoint**: `GET /api/attractions/saved-places/`
- **Mock/Static Data Still Present**: Static stats counting numbers (e.g., total visited/to-visit counts).
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (brief flicker of content before layout renders)
- **Missing Error State**: Yes (fails silently on API lookup timeout)
- **Missing Empty State**: No (implements a beautiful "No saved places yet" illustrated container)
- **Priority**: Medium

### Restaurant Panel
- **File Path**: `frontend/src/components/explore/restaurant-panel.tsx`
- **API Used**: None (receives selected restaurant details from parent component props)
- **Backend Endpoint**: None (handled on parent)
- **Mock/Static Data Still Present**: Local mock food menus, pricing indicator structures, and static user reviews lists.
- **Backend Already Exists?**: Yes (via attractions detail)
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (handled at modal level)
- **Missing Error State**: No (handled at modal level)
- **Missing Empty State**: Yes (doesn't render a friendly layout if dynamic review lists or addresses are missing)
- **Priority**: Medium

### Sight Panel
- **File Path**: `frontend/src/components/explore/sight-panel.tsx`
- **API Used**: None (receives place details via props)
- **Backend Endpoint**: None (handled on parent)
- **Mock/Static Data Still Present**: Static travel tips, recommended duration listings, and landmark descriptions.
- **Backend Already Exists?**: Yes (via attractions detail)
- **Frontend Connected?**: Yes
- **Missing Loading State**: No
- **Missing Error State**: No
- **Missing Empty State**: Yes (shows empty list if historical tips are not returned from backend)
- **Priority**: Medium

### Activity Panel
- **File Path**: `frontend/src/components/explore/activity-panel.tsx`
- **API Used**: None (receives place details via props)
- **Backend Endpoint**: None (handled on parent)
- **Mock/Static Data Still Present**: Static accessibility warnings, equipment checklist items, and age restrictions.
- **Backend Already Exists?**: Yes (via attractions detail)
- **Frontend Connected?**: Yes
- **Missing Loading State**: No
- **Missing Error State**: No
- **Missing Empty State**: Yes (no fallback if equipment checklists are empty)
- **Priority**: Medium

---

## 3. Conversational AI Planner Components

### Planner Chat Panel
- **File Path**: `frontend/src/features/planner/chat/PlannerChat.tsx` (incorporating `FloatingChat.tsx`)
- **API Used**: `plannerService.sendMessage(workspaceId, text)`
- **Backend Endpoint**: `POST /api/planner/workspaces/{id}/chat/`
- **Mock/Static Data Still Present**: Predefined chat recommendation prompts and command chips strings.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (highly customized animated "thinking" bubbles are fully active)
- **Missing Error State**: Yes (blocks the text box on server failure with console logs instead of providing inline retry messages)
- **Missing Empty State**: No (incorporates a clean, interactive greeting welcome grid)
- **Priority**: Critical

### Timeline Canvas
- **File Path**: `frontend/src/features/planner/workspace/canvas/ItineraryTimeline.tsx`
- **API Used**: `plannerService.getPlan(workspaceId)`
- **Backend Endpoint**: `GET /api/planner/workspaces/{id}/plan/`
- **Mock/Static Data Still Present**: Map day coordinates, location layout multipliers, and card design assets.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (entire timeline freezes/lags briefly on re-render triggers instead of showing skeleton loaders)
- **Missing Error State**: Yes (gets stuck on infinite spinners if backend Gemini threads timeout or crash)
- **Missing Empty State**: Yes (shows an empty white canvas area if workspace plan has not been generated)
- **Priority**: Critical

### Pre Journey Checklist Panel
- **File Path**: `frontend/src/features/planner/workspace/canvas/PreJourneyChecklist.tsx`
- **API Used**: None (fully local state logic)
- **Backend Endpoint**: None
- **Mock/Static Data Still Present**: Static checklists items (e.g. Passport, Visas, Universal Adapter, Indian Rupees Cash, Medication).
- **Backend Already Exists?**: No (requires a dedicated Checklist model inside `apps/planner` backend)
- **Frontend Connected?**: No
- **Missing Loading State**: Yes (Not Applicable - purely local state)
- **Missing Error State**: Yes (Not Applicable)
- **Missing Empty State**: Yes (no illustrated state when all tasks are checked)
- **Priority**: Medium

### Planner Workspace
- **File Path**: `frontend/src/features/planner/workspace/PlannerWorkspace.tsx`
- **API Used**: `plannerService.getWorkspace(id)`
- **Backend Endpoint**: `GET /api/planner/workspaces/{id}/`
- **Mock/Static Data Still Present**: Fallback coordinates mappings.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (renders a beautiful glass blur loading layout overlay)
- **Missing Error State**: Yes (stuck on spinner if workspace API fails)
- **Missing Empty State**: No
- **Priority**: Critical

### Attractions Helper Panel
- **File Path**: `frontend/src/features/planner/workspace/AttractionsHelper.tsx`
- **API Used**: `attractionService.getAttractions()`
- **Backend Endpoint**: `GET /api/attractions/attractions/`
- **Mock/Static Data Still Present**: Static category tags and hardcoded distance filters.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (handled by the central list hook loader)
- **Missing Error State**: Yes (silently fails to display cards on timeout)
- **Missing Empty State**: No (renders a descriptive "No matches found" message)
- **Priority**: High

### Booking Helper Panel
- **File Path**: `frontend/src/features/planner/workspace/BookingHelper.tsx`
- **API Used**: `bookingService.getBookings()`
- **Backend Endpoint**: `GET /api/bookings/`
- **Mock/Static Data Still Present**: Airline logo pathways and layout assets.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (utilizes premium inline spin circles)
- **Missing Error State**: Yes (gets stuck on spinner on backend downtime)
- **Missing Empty State**: No (renders a stunning empty-state panel directing users to book trips)
- **Priority**: High

### Travel Prep Helper Panel
- **File Path**: `frontend/src/features/planner/workspace/TravelPrepHelper.tsx`
- **API Used**: `visaService.getRequirements()` & `forexService.getRates()`
- **Backend Endpoint**: `GET /api/visa/requirements/` & `GET /api/forex/rates/`
- **Mock/Static Data Still Present**: Fallback rates and standard documents checklist items.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (lacks beautiful content shimmers during state transitions)
- **Missing Error State**: Yes (silently fails to render blocks if network times out)
- **Missing Empty State**: Yes (renders blank box components)
- **Priority**: High

---

## 4. Bookings & Search Inventory Components

### Location Autocomplete Dropdown
- **File Path**: `frontend/src/components/bookings/location-autocomplete.tsx`
- **API Used**: `searchService.autocomplete(query)`
- **Backend Endpoint**: `GET /api/bookings/locations/search/?q={query}`
- **Mock/Static Data Still Present**: None (fully driven by search parameters).
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (incorporates clean spinning loaders)
- **Missing Error State**: Yes (collapses the autocomplete list on network issues instead of rendering inline error alerts)
- **Missing Empty State**: No (renders clean "No locations matched your query" option)
- **Priority**: Critical

### Inventory Search Results List
- **File Path**: `frontend/src/components/bookings/search-results.tsx`
- **API Used**: `searchService.search(params)`
- **Backend Endpoint**: `GET /api/bookings/inventory/search/`
- **Mock/Static Data Still Present**: Static airline carrier logos and hotel thumbnail images fallbacks.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (utilizes a generic flat centered loading spinner instead of card shimmer layouts)
- **Missing Error State**: Yes (renders an empty white panel on backend database search timeouts)
- **Missing Empty State**: No (renders a beautiful "No results found" placeholder)
- **Priority**: Critical

### Checkout Booking Sheet
- **File Path**: `frontend/src/app/book-now/page.tsx`
- **API Used**: `bookingService.createBooking(payload)`
- **Backend Endpoint**: `POST /api/bookings/`
- **Mock/Static Data Still Present**: Hardcoded mock passenger names fallbacks.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (payment buttons disable with active submit loader)
- **Missing Error State**: No (renders clean, informative alert banners)
- **Missing Empty State**: Yes (renders a flat empty form if initial coordinate parameters are missing)
- **Priority**: Critical

### Bookings Search Page
- **File Path**: `frontend/src/app/bookings/page.tsx`
- **API Used**: None (coordinates search filters and orchestrates the autocomplete and search results)
- **Backend Endpoint**: None
- **Mock/Static Data Still Present**: None
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (delegated to child panels)
- **Missing Error State**: No (delegated to child panels)
- **Missing Empty State**: No
- **Priority**: High

### Booking Details Page
- **File Path**: `frontend/src/app/bookings/[id]/page.tsx`
- **API Used**: `bookingService.getBookings()` (and item selection) & `bookingService.confirmPayment(id)`
- **Backend Endpoint**: `GET /api/bookings/` & `POST /api/bookings/{id}/confirm_payment/`
- **Mock/Static Data Still Present**: Hardcoded mock map keys.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (implements a loading page wrapper)
- **Missing Error State**: Yes (shows empty card states if booking with that ID doesn't exist)
- **Missing Empty State**: No
- **Priority**: Critical

### Vault Bookings Ledger
- **File Path**: `frontend/src/app/vault/bookings/page.tsx`
- **API Used**: `bookingService.getBookings()`, `bookingService.confirmPayment(id)`, & `bookingService.cancelBooking(id)`
- **Backend Endpoint**: `GET /api/bookings/` & `POST /api/bookings/{id}/confirm_payment/` & `POST /api/bookings/{id}/cancel/`
- **Mock/Static Data Still Present**: Hardcoded airline names mapping lists and hotel addresses string formatters.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (renders beautiful shimmer skeleton cards on load)
- **Missing Error State**: Yes (silently displays empty screens on API crash instead of loading reload options)
- **Missing Empty State**: No (renders stunning custom illustration plates for empty tabs)
- **Priority**: High

---

## 5. Travel Preparation Components

### Currency Converter Calculator
- **File Path**: `frontend/src/components/travel-prep/forex/ConversionBar.tsx`
- **API Used**: `forexService.getRates()`
- **Backend Endpoint**: `GET /api/forex/rates/`
- **Mock/Static Data Still Present**: Static array mapping supported currency symbols, layout flags, and default conversion rates in case API fails.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (locks calculator input states during loads instead of showing inline loaders)
- **Missing Error State**: Yes (math crashes or locks on backend API failure or timeout)
- **Missing Empty State**: Yes (Not Applicable)
- **Priority**: Medium

### Forex Vendor Dealer Cards
- **File Path**: `frontend/src/components/travel-prep/forex/VendorCard.tsx`
- **API Used**: `forexService.getVendors()`
- **Backend Endpoint**: `GET /api/forex/vendors/`
- **Mock/Static Data Still Present**: Static dealer addresses, mock rating stars metrics, and static phone contact numbers.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (cards load as simple grey boxes instead of rendering card skeletal shimmers)
- **Missing Error State**: Yes (silently hides components on API exceptions)
- **Missing Empty State**: Yes (renders an empty panel if no dealers are returned)
- **Priority**: High

### Forex Tab Wrapper
- **File Path**: `frontend/src/components/travel-prep/forex/ForexTab.tsx`
- **API Used**: None (orchestrates conversion bars and vendor cards lists)
- **Backend Endpoint**: None
- **Mock/Static Data Still Present**: None
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No
- **Missing Error State**: No
- **Missing Empty State**: No
- **Priority**: Medium

### Visa Guidelines Card
- **File Path**: `frontend/src/components/travel-prep/visa/VisaDetailsCard.tsx`
- **API Used**: `visaService.getRequirements(nationality, destination)`
- **Backend Endpoint**: `GET /api/visa/requirements/`
- **Mock/Static Data Still Present**: Static guidelines checklists, hardcoded processing times, and static fee structures.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (lacks shimmer loaders on requirements lists transitions)
- **Missing Error State**: Yes (renders an empty container box if API lookup crashes)
- **Missing Empty State**: Yes (renders blank box panels)
- **Priority**: High

### Visa Tab Wrapper
- **File Path**: `frontend/src/components/travel-prep/visa/VisaTab.tsx`
- **API Used**: None (orchestrates Visa guidelines)
- **Backend Endpoint**: None
- **Mock/Static Data Still Present**: Default country filters.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No
- **Missing Error State**: No
- **Missing Empty State**: No
- **Priority**: Medium

---

## 6. Secure Wallet & Transit Pass Components

### Digital Travel Transit Pass
- **File Path**: `frontend/src/app/vault/pass/page.tsx`
- **API Used**: `travelPassService.getPasses()` & `travelPassService.recharge(id, amount)`
- **Backend Endpoint**: `GET /api/travelpass/passes/` & `POST /api/travelpass/passes/{id}/recharge/`
- **Mock/Static Data Still Present**: Mock ticket designs, mock barcode visuals, and layout maps.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: Yes (passes lock without recharge loading spinner overlays during top-up transactions)
- **Missing Error State**: Yes (recharge errors fail silently, writing only to developer console logs)
- **Missing Empty State**: No (renders a beautiful dynamic transit card creation placeholder action)
- **Priority**: Medium

### Travel Pass Card
- **File Path**: `frontend/src/components/travel-pass/TravelPassCard.tsx`
- **API Used**: None (visual layout renderer)
- **Backend Endpoint**: None
- **Mock/Static Data Still Present**: Static mock barcode graphics.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No
- **Missing Error State**: No
- **Missing Empty State**: No
- **Priority**: Low

### Upload Pass Modal
- **File Path**: `frontend/src/components/travel-pass/UploadPassModal.tsx`
- **API Used**: `travelPassService.uploadPass(formData)`
- **Backend Endpoint**: `POST /api/travelpass/passes/upload/`
- **Mock/Static Data Still Present**: Static arrays representing accepted travel document types.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (submission button disables with clean loader spinner)
- **Missing Error State**: Yes (crashes trigger browser alert boxes instead of clean modal validation texts)
- **Missing Empty State**: Not Applicable
- **Priority**: Medium

### Payment Methods Modal Manager
- **File Path**: `frontend/src/components/wallet/PaymentMethodModal.tsx`
- **API Used**: `walletService.savePaymentMethod(data)`
- **Backend Endpoint**: `POST /api/wallet/payment-methods/`
- **Mock/Static Data Still Present**: Card brand matching visual layouts.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (incorporates clean submit spinners)
- **Missing Error State**: Yes (uses raw browser input field boundaries instead of toast alerts)
- **Missing Empty State**: Not Applicable
- **Priority**: Medium

### Wallet Accounts Deck
- **File Path**: `frontend/src/app/vault/wallet/page.tsx`
- **API Used**: `walletService.getPaymentMethods()`, `walletService.deletePaymentMethod(id)`, & `walletService.addBalance(amount)`
- **Backend Endpoint**: `GET /api/wallet/payment-methods/` & `DELETE /api/wallet/payment-methods/{id}/` & `POST /api/wallet/payment-methods/add-balance/`
- **Mock/Static Data Still Present**: Mock layout templates.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (utilizes clean card skeletal shimmer boxes)
- **Missing Error State**: Yes (crashes prompt native browser alert dialogs instead of elegant toasts)
- **Missing Empty State**: No (renders beautiful illustrations for zero card decks)
- **Priority**: High

### Vault Transactions Ledger
- **File Path**: `frontend/src/app/vault/transactions/page.tsx`
- **API Used**: `walletService.getTransactions(filter)`
- **Backend Endpoint**: `GET /api/wallet/transactions/?filter={filter}`
- **Mock/Static Data Still Present**: Static array mapping list of ledger category labels.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (clean table loading spinner)
- **Missing Error State**: Yes (silently presents zero ledger lines if fetch fails)
- **Missing Empty State**: No (renders clean zero records illustrated panel)
- **Priority**: High

---

## 7. Profile Settings & Alerts Components

### Personal Preferences Form
- **File Path**: `frontend/src/app/settings/profile/page.tsx`
- **API Used**: `userService.updateProfile(formData)`
- **Backend Endpoint**: `PATCH /api/accounts/users/me/`
- **Mock/Static Data Still Present**: Hardcoded lists of currencies (fallback to INR / ₹) and notification frequency settings.
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (button disables with active spinner overlay on submit)
- **Missing Error State**: No (beautiful, clean error banners are rendered)
- **Missing Empty State**: Not Applicable
- **Priority**: Medium

### Alerts Center List Feed
- **File Path**: `frontend/src/app/notifications/page.tsx`
- **API Used**: `notificationService.getNotifications()`, `notificationService.markAsRead(id)`, & `notificationService.markAllAsRead()`
- **Backend Endpoint**: `GET /api/notifications/`, `POST /api/notifications/{id}/read/`, & `POST /api/notifications/mark_all_read/`
- **Mock/Static Data Still Present**: None (fully driven by dynamic backend payloads).
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (renders clean text spinners)
- **Missing Error State**: Yes (fails silently on API connection errors or timeouts)
- **Missing Empty State**: No (implements a beautiful empty inbox graphics layout)
- **Priority**: Medium

### Auth Modal
- **File Path**: `frontend/src/components/auth/auth-modal.tsx`
- **API Used**: `authService.login(credentials)` & `authService.register(credentials)`
- **Backend Endpoint**: `POST /api/accounts/token/` & `POST /api/accounts/users/`
- **Mock/Static Data Still Present**: None
- **Backend Already Exists?**: Yes
- **Frontend Connected?**: Yes
- **Missing Loading State**: No (submit buttons disable with loading indicators)
- **Missing Error State**: No (renders clean validation feedback below input blocks)
- **Missing Empty State**: Not Applicable
- **Priority**: Critical

---

## Summary Matrices & Analysis

### Components Still Using Mock Data
1. **`PreJourneyChecklist`** (`features/planner/workspace/canvas/PreJourneyChecklist.tsx`): Fully relies on static, local checklist string templates instead of connecting to a dynamic user-custom checklist model.
2. **`ItineraryTimeline`** (`features/planner/workspace/canvas/ItineraryTimeline.tsx`): Employs static day coordinate offsets and pixel multiplier grids.
3. **`ConversionBar`** (`components/travel-prep/forex/ConversionBar.tsx`): Relies on hardcoded lists mapping default currency labels, flags, and default conversion factors in case backend rates cannot be fetched.
4. **`VisaDetailsCard`** (`components/travel-prep/visa/VisaDetailsCard.tsx`): Employs static arrays mapping checklists, visa cost metrics, and estimated processing timelines.
5. **`DetailsModal`** (`components/explore/details-modal.tsx`): Still depends on local arrays containing mock user review strings, usernames, and ratings.

### Backend Endpoints Never Called
1. **`POST /api/planner/lazy-chat/`**: Bypassed by the client workspace channel which handles stateful chats in favor of direct standard chat channels.
2. **`GET /api/reference/weather-normals/`**: Active inside the seeded SQLite reference database but has no corresponding consumer UI hook.
3. **`GET /api/reference/holidays/`**: Seeded database holds global holiday dates, but this is never queried by the planner canvas.

### Duplicate APIs
1. **`GET /api/homepage/destinations/` & `GET /api/attractions/destinations/`**: Both return location blocks. Should be refactored into a single, unified destination recommendation feed endpoint inside `apps/attractions`.
2. **`GET /api/reference/currencies/` & `GET /api/forex/rates/`**: Both serve currency structures and can share a single models helper.

### Dead Frontend Code
- **`features/_planner_archive/`**: Deprecated, archived files from earlier planning iterations. Can be safely deleted from the codebase.
- **`PlaceList.tsx`**: Obsolete list-view component replaced entirely by the Masonry Place Card grids.

### Dead Backend Code
- **`lazy_chat` view** (`apps/planner/views.py`): Inactive view mapping stateless chatbot iterations.
- **`ActivityLog` routers** (`apps/accounts/views.py`): Legacy, uncalled activity track indicators.

### APIs Ready to Connect
1. **`GET /api/reference/currencies/`**: Ready to fuel settings dropdowns dynamically rather than utilizing local static lists.
2. **`GET /api/reference/airports/`**: Ready to feed flight origin and destination autocomplete inputs dynamically.

### Components Ready for Production
1. **Auth Modal** (`components/auth/auth-modal.tsx`): Highly robust token-handling, field validation, and error management.
2. **Settings Preferences Form** (`app/settings/profile/page.tsx`): Smooth state updates, active avatar uploaders, and seamless store synchronicity.
3. **Alerts Center Feed** (`app/notifications/page.tsx`): Implements stunning interactive checkmark actions, categories, and unread metrics.
