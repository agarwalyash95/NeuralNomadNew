# Development Roadmap: Neural Nomad

This development roadmap is designed to guide the incremental completion of Neural Nomad based on its current codebase, without introducing structural changes.

---

## 1. Critical Priority (Must Have)

### Task 1.1: Defer Conversational Trip Generation to Background Tasks
- **Discipline**: Backend, Integration
- **Objective**: Defer Gemini API calls and dynamic plan calculations from synchronous HTTP threads into Celery workers to prevent gateway timeout errors (HTTP 504) on long trip builds.
- **Difficulty**: Hard
- **Files**:
  - `backend/apps/planner/tasks.py` [NEW]
  - `backend/apps/planner/views.py` [MODIFY]
  - `backend/apps/planner/services/conversation_service.py` [MODIFY]
- **Dependencies**: Celery installation, Redis broker settings, Django signals.
- **Estimated Hours**: 16 hours
- **Testing**: Unit tests ensuring asynchronous task scheduling and success status checks.

### Task 1.2: Complete Checkout Payment Gateway Integrations
- **Discipline**: Frontend, Backend, Integration, Database
- **Objective**: Replace simulated checkouts with a real PCI-compliant payment gateway integration (e.g., Stripe/Razorpay) to process dynamic payments on the bookings checkout page.
- **Difficulty**: Hard
- **Files**:
  - `frontend/src/app/book-now/page.tsx` [MODIFY]
  - `backend/apps/wallet/views.py` [MODIFY]
  - `backend/apps/wallet/services/payment_service.py` [NEW]
- **Dependencies**: Payment gateway SDK (Stripe/Razorpay), developer API tokens, and webhook secrets.
- **Estimated Hours**: 24 hours
- **Testing**: Webhook signature verification tests and simulated cards billing scenarios.

### Task 1.3: Clean Up Leftover Hardcoded Pricing Currency and Conversions
- **Discipline**: Frontend, Integration
- **Objective**: Ensure that all currency values displayed in the search result cards and booking lists match the user's selected preferred currency (e.g., INR/₹, USD/$).
- **Difficulty**: Medium
- **Files**:
  - `frontend/src/app/bookings/page.tsx` [MODIFY]
  - `frontend/src/app/vault/wallet/page.tsx` [MODIFY]
  - `frontend/src/services/search.service.ts` [MODIFY]
- **Dependencies**: Profile store session selectors.
- **Estimated Hours**: 10 hours
- **Testing**: Manual check of currency symbols switches across Flights, Hotels, and Cabs when switching preferred currency.

---

## 2. High Priority (Should Have)

### Task 2.1: Add Interactive Map Overlays in Attractions Discovery
- **Discipline**: Frontend, Integration
- **Objective**: Replace the static map placeholder inside `app/attractions/page.tsx` with a fully interactive Mapbox component that places visual pins on matching coordinates.
- **Difficulty**: Medium
- **Files**:
  - `frontend/src/app/attractions/page.tsx` [MODIFY]
  - `frontend/src/components/explore/MapOverlay.tsx` [NEW]
- **Dependencies**: Mapbox GL React wrapper, developer access tokens, and search coordinates array feed.
- **Estimated Hours**: 12 hours
- **Testing**: Verify coordinate pins map adjustments during location switches.

### Task 2.2: Implement Skeleton Loaders and Image Shimmer Skeletons
- **Discipline**: Frontend
- **Objective**: Build consistent, premium shimmer skeleton layout blocks for the attractions masonry grid, search cards, and profile lists to eliminate jerky page transitions.
- **Difficulty**: Easy
- **Files**:
  - `frontend/src/components/ui/skeleton.tsx` [NEW]
  - `frontend/src/app/attractions/page.tsx` [MODIFY]
  - `frontend/src/app/bookings/page.tsx` [MODIFY]
- **Dependencies**: None.
- **Estimated Hours**: 8 hours
- **Testing**: Visual inspection on slow 3G network simulation tools.

### Task 2.3: Connect Dynamic Autocomplete Autocomplete to Search Inputs
- **Discipline**: Frontend, Integration
- **Objective**: Replace the static airport options dropdown inside travel search fields with active autocomplete queries querying the backend database.
- **Difficulty**: Medium
- **Files**:
  - `frontend/src/components/bookings/location-autocomplete.tsx` [MODIFY]
  - `frontend/src/services/search.service.ts` [MODIFY]
- **Dependencies**: Debounced query hooks, location endpoint views.
- **Estimated Hours**: 8 hours
- **Testing**: Manual input assertions ensuring city listings match backend seeded records.

---

## 3. Medium Priority (Could Have)

### Task 3.1: Build Interactive Checklist Sync for Trip Canvas
- **Discipline**: Frontend, Backend, Integration, Database
- **Objective**: Persist the pre-travel checklist state dynamically to the backend workspace draft models instead of storing it inside temporary local component memory.
- **Difficulty**: Medium
- **Files**:
  - `backend/apps/planner/models.py` [MODIFY]
  - `backend/apps/planner/serializers.py` [MODIFY]
  - `frontend/src/features/planner/workspace/canvas/PreJourneyChecklist.tsx` [MODIFY]
- **Dependencies**: Workspace ID state selector.
- **Estimated Hours**: 12 hours
- **Testing**: Manual assertions showing checkmarks remain checked after page reloads.

### Task 3.2: Connect Personal Preferences to Recommendation Feeds
- **Discipline**: Backend, Integration
- **Objective**: Inject the active user preference interests tags array as lookup query parameters on the homepage recommended package endpoint fetches.
- **Difficulty**: Medium
- **Files**:
  - `backend/apps/homepage/views.py` [MODIFY]
  - `frontend/src/hooks/use-homepage.ts` [MODIFY]
- **Dependencies**: Active auth token.
- **Estimated Hours**: 10 hours
- **Testing**: Unit tests ensuring users with "Beach" preferences are served with beach packages.

### Task 3.3: Implement Dynamic PNR Status Lookup Mock Views
- **Discipline**: Backend, Database
- **Objective**: Build a mock PNR status resolution route on the train reference models to retrieve booking leg positions and seats configurations.
- **Difficulty**: Easy
- **Files**:
  - `backend/apps/bookings/views.py` [MODIFY]
  - `backend/apps/bookings/serializers.py` [MODIFY]
- **Dependencies**: Valid train booking models structure.
- **Estimated Hours**: 8 hours
- **Testing**: Direct DRF browser panel assertions on mock values returns.

---

## 4. Low Priority (Nice to Have)

### Task 4.1: Multi-Card Bank Saved Accounts Rotator animations
- **Discipline**: Frontend
- **Objective**: Polish the wallet page card decks with nice flip transformations when interactive elements are hovered over or selected.
- **Difficulty**: Easy
- **Files**:
  - `frontend/src/app/vault/wallet/page.tsx` [MODIFY]
  - `frontend/src/app/globals.css` [MODIFY]
- **Dependencies**: None.
- **Estimated Hours**: 6 hours
- **Testing**: Manual check across varying viewport widths.

### Task 4.2: Clean Up Unused Legacy backup files
- **Discipline**: Testing, Operations
- **Objective**: Remove older planner features backup files under `features/_planner_archive` to reduce client build footprint sizes.
- **Difficulty**: Easy
- **Files**:
  - `frontend/src/features/_planner_archive/` [DELETE]
- **Dependencies**: None.
- **Estimated Hours**: 2 hours
- **Testing**: Complete build check (`npm run build`) ensuring zero dangling imports warnings.

---

## Summary Estimated Effort

| Phase / Category | Difficulty | Estimated Hours | Main Discipline |
| :--- | :---: | :---: | :--- |
| **Task 1.1: Background Tasks** | Hard | 16 hours | Backend, Integration |
| **Task 1.2: Payment Checkout** | Hard | 24 hours | Full-Stack |
| **Task 1.3: Currency conversions** | Medium | 10 hours | Frontend |
| **Task 2.1: Map Overlays** | Medium | 12 hours | Frontend, Integration |
| **Task 2.2: Skeleton loaders** | Easy | 8 hours | Frontend |
| **Task 2.3: Search Autocomplete** | Medium | 8 hours | Frontend, Integration |
| **Task 3.1: Checklist Sync** | Medium | 12 hours | Full-Stack |
| **Task 3.2: Personalized feeds** | Medium | 10 hours | Backend, Integration |
| **Task 3.3: PNR Status Lookups** | Easy | 8 hours | Backend |
| **Task 4.1: Card animations** | Easy | 6 hours | Frontend |
| **Task 4.2: Archive Cleanup** | Easy | 2 hours | Operations |
| **Total Estimated Hours** | - | **116 hours** | - |
