# Repository Map
## Directory Structure
- `backend/` - Django application, celery config, Dockerfile.
  - `apps/` - Django apps (planner, accounts, reference, etc.)
  - `config/` - Main Django settings and urls.
- `frontend/` - Next.js application.
  - `src/app/` - App router pages.
  - `src/components/` - React components.
  - `src/store/` - Zustand state stores.
- `scripts/` - Utility scripts.
- `docs/` - Architecture and planning documentation.

## Entry Points
- Frontend: `frontend/src/app/layout.tsx`
- Backend: `backend/config/urls.py`

## Technologies
- Next.js (App Router), TailwindCSS, Zustand, React Query
- Django, DRF, Celery, PostgreSQL (pgvector)
