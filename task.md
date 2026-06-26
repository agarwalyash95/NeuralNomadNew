# NeuralNomad AI Planner — Execution Task Tracker

## Phase 1: Reference Data Module
> **Goal:** Complete reference database with all static tables and seed data.

- [x] Create `apps/reference/` Django app structure
- [x] Define all reference models (geography, transport, accommodation, dining, attractions, travel info, cache)
- [x] Create serializers with search/filter support
- [x] Create views with autocomplete endpoints
- [x] Create URL routing
- [x] Register all models in admin
- [x] Register app in settings + urls.py
- [x] Run migrations
- [x] Write seed data management command
- [x] Seed initial data

---

## Phase 2: Planner Models + API Shell
- [x] Define all planner models in `apps/planner/models.py`
- [x] Create serializers
- [x] Create `IsWorkspaceOwner` permission
- [x] Create ViewSets
- [x] Create URL routing
- [x] Register in admin
- [x] Run migrations
- [x] Wire into `config/urls.py`

---

## Phase 3: Planner Engine
- [x] Create `engine/event_bus.py`
- [x] Create `engine/context_manager.py`
- [x] Create `engine/memory_manager.py`
- [x] Create `engine/timeline_engine.py`
- [x] Create `engine/budget_engine.py`
- [x] Create `engine/route_service.py`
- [x] Create `engine/conflict_detector.py`
- [x] Create `engine/recommendation_engine.py`
- [x] Create `engine/command_executor.py`
- [x] Register all event subscriptions

---

## Phase 4: AI Provider + Chat Service
- [x] Create `providers/base.py`
- [x] Create `providers/gemini_provider.py`
- [ ] Create `providers/google_maps_provider.py`
- [x] Create `services/chat_service.py`
- [x] Create `services/workspace_service.py`
- [x] Create `services/plan_service.py`
- [ ] Create `commands/registry.py`
- [ ] Create `commands/handlers.py`

---

## Phase 5: Frontend Layout Shell
- [ ] Create planner store, services, types, hooks
- [ ] Create PlannerShell, Sidebar, Chat, Workspace panels
- [ ] Update app/planner/ routes

---

## Phase 6: Chat System + Plan Canvas
- [ ] Create chat components + widgets
- [ ] Create CanvasLayoutEngine + registry
- [ ] Create PlanCanvas + Timeline + Budget + Map

---

## Phase 7: Execution Canvases + Polish
- [ ] Create shared canvas framework
- [ ] Create all execution canvases (Flight, Hotel, Train, Bus, etc.)
- [ ] Canvas lifecycle transitions + animations
