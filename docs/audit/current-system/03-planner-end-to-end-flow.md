# Planner End-to-End Flow
## Lifecycle Trace
1. **Load:** User opens planner, frontend hits `GET /api/planner/workspaces/`.
2. **Chat:** User sends message `POST /api/planner/workspaces/{id}/chat/`.
3. **Generation:** Backend verifies draft state and starts async generation `POST /api/planner/workspaces/{id}/plan/`.
4. **Poll:** Frontend polls `GET /api/planner/workspaces/{id}/plan/status/`.
5. **Render:** Canvas displays generated trip.
6. **Mutate:** User drag-and-drops or changes items `PATCH /api/planner/workspaces/{id}/plan/`.
7. **Book:** Final booking request `POST /api/planner/workspaces/{id}/book/`.

## Sequence Diagram
```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as Django
    participant Worker as Celery
    participant LLM as AI Provider
    
    UI->>API: POST /chat (Message)
    API-->>UI: ChatResponse
    UI->>API: POST /plan (Generate)
    API->>Worker: spawn_generation_task
    API-->>UI: 202 Accepted (Job ID)
    Worker->>LLM: Prompt
    LLM-->>Worker: JSON Itinerary
    Worker->>API: Save Trip to DB
    UI->>API: GET /plan/status (Poll)
    API-->>UI: 200 OK (Trip Data)
```
