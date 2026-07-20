# Runtime Architecture
## Startup Flow
1. User hits Next.js frontend, `layout.tsx` initializes `QueryProvider` and `AuthProvider`.
2. Frontend makes requests to Django backend via DRF endpoints.
3. Backend authenticates via SimpleJWT.
4. Heavy tasks (AI generation, reference enrichment) are offloaded to Celery.

## System Context Diagram
```mermaid
graph TD
    User -->|HTTP| NextJS[Frontend: Next.js]
    NextJS -->|REST API| Django[Backend: Django DRF]
    Django --> Postgres[(PostgreSQL / pgvector)]
    Django --> Celery[Celery Workers]
    Celery --> ExternalAPI[External Providers / LLMs]
    Celery --> Postgres
```
