# NeuralNomad AI Planner — Implementation Blueprint

Concise implementation reference. See `ARCHITECTURE.md` and `DATABASE.md` for platform context.

---

## Layout Structure (18% / 32% / 50%)

```
PlannerPage (fullscreen, below nav)
└── PlannerShell
    ├── Sidebar (18%, collapsible)     — New Plan, Draft/Saved/Booked lists
    ├── ChatPanel (32%, collapsible)   — Schema-driven widget renderer
    └── WorkspacePanel (50%→auto)      — CanvasLayoutEngine (single | dual split)
```

Collapsed: workspace expands. Max 2 canvases visible. Plan canvas opens first.

---

## Frontend Component Hierarchy

```
features/planner/
├── layout/
│   ├── PlannerShell.tsx
│   ├── PlannerSidebar.tsx
│   ├── ChatPanel.tsx
│   └── WorkspacePanel.tsx
├── chat/
│   ├── WidgetRenderer.tsx
│   ├── widgets/          # text, buttons, cards, calendar, budget, etc.
│   └── components/       # ChatInput, ChatMessage, ChatHeader
├── canvas/
│   ├── CanvasLayoutEngine.tsx
│   ├── PlannerCanvas.tsx
│   ├── canvas.registry.ts
│   ├── canvas.components.ts
│   ├── plan/PlanCanvas.tsx          # intelligence hub (reads trip, not search UI)
│   ├── flight|train|bus|hotel|...   # editing canvases
│   └── shared/StandardCanvas, ItemCard, ...
├── store/planner.store.ts           # Zustand: layout, workspace, canvas state
└── hooks/                           # re-exports use-planner from src/hooks

src/hooks/use-planner.ts             # React Query (server state)
src/services/planner.service.ts      # API client (unchanged contract)
```

---

## Backend Service Hierarchy

```
apps/planner/
├── models.py                        # workspace, context, chat, canvas, cart, trip journey
├── serializers.py
├── views.py                         # WorkspaceViewSet + reference + maps
├── permissions.py                   # IsWorkspaceOwner
├── services/
│   ├── workspace_service.py
│   ├── chat_service.py              # orchestrates AI + saves messages
│   ├── plan_service.py              # trip/journey CRUD + recalculation
│   └── providers/
│       ├── base.py                  # abstract AIProvider, MapsProvider, PlacesProvider
│       ├── gemini_provider.py
│       ├── google_maps_provider.py
│       └── google_places_provider.py
```

Provider logic never in views. Swap providers via settings.

---

## Database Schema Overview

| Model | Purpose |
|-------|---------|
| `PlannerWorkspace` | Session/workspace per user |
| `WorkspaceContext` | Trip params (dates, travelers, budget) |
| `WorkspaceChat` | Messages + `widgets` JSON |
| `WorkspaceActivity` | Audit trail |
| `CanvasInstance` | Active canvas per workspace |
| `CanvasData` | JSON blob per canvas |
| `BookingOrder` | Cart / booking drafts |
| `SavedPlace` | Google Places bookmarks |
| `PlannerTrip` | Journey plan (1:1 workspace) |
| `TripCity` | Multi-city legs |
| `TripDay` | Days per city |
| `TripActivity` | Timeline items (location, coords, times) |
| `TripRoute` | Distance/duration/mode between activities |
| `Recommendation` | AI suggestions linked to workspace |

All extend `BaseModel` (UUID PK, soft delete). Every FK to workspace validated via `user` ownership.

Reference data: reuse `bookings.Location` + `SearchInventory` — no duplicate Airport/City tables.

---

## API Layout

Base: `/api/planner/`

| Group | Endpoints |
|-------|-----------|
| **Workspaces** | CRUD `/workspaces/`, GET `/workspaces/{id}/summary/` |
| **Context** | GET/PATCH `/workspaces/{id}/context/` |
| **Chat** | GET/POST `/workspaces/{id}/chat/` (POST triggers AI) |
| **Canvases** | GET/POST `/workspaces/{id}/canvases/`, GET/PATCH `/workspaces/{id}/canvases/{type}/data/` |
| **Cart** | CRUD `/workspaces/{id}/cart/` |
| **Places** | GET/POST/DELETE `/workspaces/{id}/places/` |
| **Plan** | GET/PATCH `/workspaces/{id}/plan/`, POST `/workspaces/{id}/plan/recalculate/` |
| **Recommendations** | GET `/workspaces/{id}/recommendations/` |
| **Reference** | `/reference/airports|cities|countries|train-stations|currencies/` |
| **Maps** | POST `/maps/distance/`, `/maps/route/` |

Auth: JWT. Ownership: `workspace.user == request.user` on every nested route.

---

## Folder Structure

```
backend/apps/planner/     — as above
frontend/src/features/planner/  — UI module (isolated)
frontend/src/app/planner/       — page + layout (fullscreen)
```

---

## Canvas Communication Flow

```
PlanCanvas (primary intelligence)
    │ reads PlannerTrip + Recommendations via API
    │ emits recommendation clicks → planner.store.requestCanvasOpen(type)
    ▼
Editing Canvas (flight/hotel/...)
    │ reads CanvasData via useCanvasPersistence
    │ writes selections → PATCH canvas data + POST cart
    ▼
BookingCanvas
    │ reads cart via useBookingOrders
    │ checkout → existing bookings API
```

Plan canvas never searches inventory directly; editing canvases use `SearchInventory` / provider search.

---

## State Management Flow

| Layer | Responsibility |
|-------|----------------|
| **Zustand** (`planner.store`) | Sidebar/chat open, activeWorkspaceId, layoutMode, primary/secondary canvas |
| **React Query** (`use-planner`) | Workspaces, context, chat, canvases, cart, places, plan |
| **useCanvasPersistence** | Local form state ↔ CanvasData API |

Single source of truth: server for data, Zustand for UI chrome only.

---

## Reuse from Audit

- Keep: `planner.service.ts`, `planner.types.ts`, `use-planner.ts`, `use-reference.ts`
- Promote: `features_backup/planner` → `features/planner` (adapt layout)
- Rebuild: Shell layout proportions, Plan canvas, WidgetRenderer
- Backend: entire `apps/planner` (shell only today)
