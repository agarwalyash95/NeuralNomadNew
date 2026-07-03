# Frontend-Backend Mapping: Neural Nomad

This document maps every major frontend page and component in Neural Nomad to its corresponding backend Django API, auditing connection statuses, dependencies, and static data.

---

## Page 1: Dashboard (`app/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `Hero` | `GET /api/homepage/mood-categories/` | **Yes** | - | Background hero Unsplash links | Yes | Yes | No | No | No | No |
| `SmartInsightsBar` | `GET /api/homepage/seasonal-insights/` | **Yes** | - | Seasonal weather tips | Yes | Yes | No | No | No | No |
| `MoodDestinationSection` | `GET /api/homepage/destinations/` | **Yes** | - | Package estimates | Yes | Yes | No | No | No | No |
| `AIFeaturesStrip` | `GET /api/homepage/ai-features/` | **Yes** | - | Travel cards descriptions | Yes | Yes | No | No | No | No |

---

## Page 2: Attractions List (`app/attractions/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `PlaceCard` | `GET /api/attractions/attractions/` | **Yes** | - | Place generic descriptions | Yes | Yes | No | No | No | No |
| `DetailsModal` | `GET /api/attractions/attractions/{id}/` | **Yes** | - | Reviews placeholder texts | Yes | Yes | No | No | No | No |
| `MapPlaceholder` | None | **No** | Requires map coordinates feed | Map tiles and static visual marker | Yes | Yes (in reference models) | Yes (coords filter API) | No | No | Yes |

---

## Page 3: Checkout & Checkout Form (`app/book-now/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `BookNowPage` | `POST /api/bookings/` | **Yes** | - | Terms checklist text | Yes | Yes | No | No | No | No |
| `PaymentGatewayForm` | None | **No** | Card forms submit to simulated service | Expiration date selector bounds | Yes | No (requires dynamic gateway integration) | Yes (payment verify) | Yes | Yes | Yes |

---

## Page 4: Unified Travel Search & Cart (`app/bookings/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `SearchField` | `GET /api/bookings/locations/search/` | **Yes** | - | Default city names fallbacks | Yes | Yes | No | No | No | No |
| `SelectField` | None | **No** | Renders static dropdown select list | Class lists (Economy, SL), cab models | Yes | Yes (reference models hold classes) | Yes | No | No | Yes |
| `SearchResults` | `GET /api/bookings/inventory/search/` | **Yes** | - | Dynamic lists placeholder templates | Yes | Yes | No | No | No | No |

---

## Page 5: AI Travel Copilot Screen (`app/copilot/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `CopilotPage` | None | **No** | Entire screen is a simple visual template | Prompt textarea placeholder guides | Yes | Yes (`GET/POST /api/planner/workspaces/`) | No | No | No | Yes (all dynamic actions are in `/planner`) |

---

## Page 6: Canvas Planner (`app/planner/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `PlannerChat` | `POST /api/planner/workspaces/{id}/chat/` | **Yes** | - | Prompts lists triggers | Yes | Yes | No | No | No | No |
| `PlannerWorkspace` | `GET /api/planner/workspaces/{id}/plan/` | **Yes** | - | Fallback schedules inside `mockData.ts` | Yes | Yes | No | No | No | No |
| `ItineraryTimeline` | `GET /api/planner/workspaces/{id}/plan/` | **Yes** | - | Local item coordinates offsets | Yes | Yes | No | No | No | No |
| `PreJourneyChecklist` | None | **No** | Visual checklists logic is fully local | Standard travel items checklists | Yes | No | Yes | Yes | Yes | Yes |

---

## Page 7: Personal Settings (`app/settings/profile/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `ProfileSettingsPage` | `PATCH /api/accounts/users/me/` | **Yes** | - | Currencies lists fallback choices | Yes | Yes | No | No | No | No |

---

## Page 8: Pre-travel Visa & Forex (`app/travel-prep/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `ConversionBar` | `GET /api/forex/rates/` | **Yes** | - | Hardcoded currency conversions symbols | Yes | Yes | No | No | No | No |
| `VendorCard` | `GET /api/forex/vendors/` | **Yes** | - | Standard dealer ratings multipliers | Yes | Yes | No | No | No | No |
| `VisaTab` | `GET /api/visa/requirements/` | **Yes** | - | Standard visa instructions steps | Yes | Yes | No | No | No | No |

---

## Page 9: Secure Transit Passes Wallet (`app/vault/pass/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `VaultTravelPassPage` | `GET /api/travelpass/passes/` | **Yes** | - | Pass design colors templates | Yes | Yes | No | No | No | No |
| `RechargeAction` | `POST /api/travelpass/passes/{id}/recharge/` | **Yes** | - | Recharge options values choices | Yes | Yes | No | No | No | No |

---

## Page 10: Secure Saved Cards & Accounts (`app/vault/wallet/page.tsx`)

| Frontend Component | Backend API | Connected? | If No: Why | Static Data | Should Become Dynamic? | Backend already exists? | Missing Endpoint? | Missing Model? | Missing Serializer? | Missing Frontend Integration? |
| :--- | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `VaultWalletPage` | `GET /api/wallet/payment-methods/` | **Yes** | - | Bank providers dropdown fallbacks | Yes | Yes | No | No | No | No |
| `PaymentMethodModal` | `POST /api/wallet/payment-methods/` | **Yes** | - | Card provider visual SVGs | No | Yes | No | No | No | No |

---

## Technical Audit: Connection Lists

### 1. Frontend waiting for Backend
- **Interactive Coordinates Maps Grid**: The `PlaceCard` and attractions list have coordinates but are waiting for a bounding-box query endpoint on the backend (`GET /api/attractions/attractions/map_bounds/`) to render interactive map overlays.
- **Form Checkout Validation**: `PaymentGatewayForm` has standard text verification but is waiting for backend card tokenization endpoints with a real payment gateway (Razorpay/Stripe client libraries).
- **Interactive Multi-day Pre-travel Checklist**: `PreJourneyChecklist` is fully static and needs a dedicated backend table (`planner_checklist_items`) and accompanying API endpoints (`GET/POST /api/planner/workspaces/{id}/checklist/`).

### 2. Backend waiting for Frontend
- **Personalized Recommendations Engine**: Backend `accounts.UserPreference` models have interests tracking, but the homepage recommendation fetches do not pass preferences headers to render user-personalized feeds on `app/page.tsx`.
- **Dynamic Search Dropdown Selections**: The reference models for Airlines, Train Classes, and Currencies are fully seeded on the backend (`reference` app), but the search filters on `app/bookings/page.tsx` use hardcoded dropdown tags.
- **Activity Logging Auditor Dashboard**: `ActivityLog` entries are fully logged on the backend on logins and updates, but the frontend lacks a panel inside `/settings` to audit active login devices.

### 3. Already Connected
- **Standard Authentication**: Auth modals (`components/ui-custom/auth-modal.tsx`) are connected to JWT accounts endpoints.
- **Interactive AI Travel Canvas Planner**: Conversational chat inputs, parameter slots updating, and structured day-by-day JSON timelines loading are connected between `features/planner` and `/api/planner/workspaces/`.
- **Travel Search Engine**: `useTravelSearch` hook successfully coordinates with `SearchInventoryViewSet` to search Flights, Hotels, Buses, Trains, and Cabs.
- **Foreign Exchange Orders Delivery Channel**: `ForexTab` conversion calculator is connected to dynamic rate models, and vendor delivery orders are linked to `ForexDeliveryRequestViewSet`.

### 4. Can Remove Static Data
- **Dynamic Airport Autocomplete**: Replace static airport options inside search dropdowns with live queries to `GET /api/bookings/locations/search/?type=airport`.
- **Theme Settings Toggles**: Refactor static setting theme variables into a CSS variable schema linked directly to user profile settings preferences (`accounts.UserPreference`).
- **Standard Dynamic Currency Symbols Map**: Hardcoded flags and currency symbols inside `ConversionBar` can be retrieved directly from the backend currencies master database (`GET /api/reference/currencies/`).

### 5. Unused Backend Code
- **Stateless Conversational Quick Chat API**: The `lazy_chat` view inside `apps/planner/views.py` is unused since the frontend enforces full workspace creations on interactive chat inputs.
- **Seeded Weather Normal Tables**: `WeatherNormals` and `HolidayCalendar` models are fully loaded with country data, but are not consumed by any active views or screens.

### 6. Unused Frontend Code
- **Old Planner Feature Backups**: Unused canvas components are located in the legacy archive feature folders `_planner_archive`, which can be cleaned up without affecting active timelines.
- **PlaceList Grid Component**: The list view file `PlaceList` is unused inside the attractions page in favor of Masonry Grid displays.
