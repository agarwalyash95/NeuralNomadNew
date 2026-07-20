# API & Integrations
## Core API Endpoints
- `/api/planner/workspaces/`: CRUD for workspaces.
- `/api/planner/workspaces/{id}/chat/`: Chat ingestion and response.
- `/api/planner/workspaces/{id}/plan/`: The core mutation endpoint for itineraries.

## External Integrations
- Maps/Geocoding (implied, used in Reference Data)
- Live Pricing: `lookup_live_price` in `apps.reference.services.live_price`.
- Payments: `verify_payment` in `apps.wallet.views`.
