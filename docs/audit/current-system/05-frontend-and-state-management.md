# Frontend Architecture & State Management
## State Stores (Zustand)
- `auth.store.ts`: Manages JWT and user session.
- `planner-nav.store.ts`: UI state for sidebar and active panels.
- `planner-hover.store.ts`: Synchronizes hover states between map and timeline.
- `booking-selection.store.ts`: Tracks items selected for checkout.

## Connectivity Findings
- The UI heavily relies on React Query to synchronize with the backend.
- Local state (Zustand) is primarily used for ephemeral UI state, avoiding duplication of canonical DB state.
- Identified Risk: Helper canvases may dispatch mutations that conflict if the main plan canvas also initiates an autosave concurrently.
