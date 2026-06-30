/**
 * Planner API service â€” all REST calls for the planner workspace.
 * Uses the existing ApiClient with JWT auth.
 */

import { apiClient } from './api';
import type {
  PlannerWorkspace,
  PlannerMemory,
  WorkspaceContext,
  ChatMessage,
  ChatResponse,
  PlannerTrip,
  Recommendation,
  CanvasInstance,
  BookingOrder,
  SavedPlace,
  PaginatedResponse,
} from './planner.types';

const BASE = '/planner/workspaces';

export const plannerService = {
  // â”€â”€â”€ Workspaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  listWorkspaces: () =>
    apiClient.get<PlannerWorkspace[]>(`${BASE}/`),

  createWorkspace: (title: string = 'New Trip') =>
    apiClient.post<PlannerWorkspace>(`${BASE}/`, { title }),

  getWorkspace: (id: string) =>
    apiClient.get<PlannerWorkspace>(`${BASE}/${id}/`),

  updateWorkspace: (id: string, data: Partial<PlannerWorkspace>) =>
    apiClient.patch<PlannerWorkspace>(`${BASE}/${id}/`, data),

  deleteWorkspace: (id: string) =>
    apiClient.delete(`${BASE}/${id}/`),

  getWorkspaceSummary: (id: string) =>
    apiClient.get<Record<string, unknown>>(`${BASE}/${id}/summary/`),

  // â”€â”€â”€ Memory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  getMemory: (workspaceId: string) =>
    apiClient.get<PlannerMemory>(`${BASE}/${workspaceId}/memory/`),

  updateMemory: (workspaceId: string, data: Partial<PlannerMemory>) =>
    apiClient.patch<PlannerMemory>(`${BASE}/${workspaceId}/memory/`, data),

  // â”€â”€â”€ Context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  getContext: (workspaceId: string) =>
    apiClient.get<WorkspaceContext>(`${BASE}/${workspaceId}/context/`),

  updateContext: (workspaceId: string, data: Partial<WorkspaceContext>) =>
    apiClient.patch<WorkspaceContext>(`${BASE}/${workspaceId}/context/`, data),

  // â”€â”€â”€ Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  listMessages: (workspaceId: string) =>
    apiClient.get<ChatMessage[]>(`${BASE}/${workspaceId}/chat/`),

  sendMessage: (workspaceId: string, message: string) =>
    apiClient.post<ChatResponse>(`${BASE}/${workspaceId}/chat/`, { message }),

  // â”€â”€â”€ Plan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  getPlan: (workspaceId: string) => {
    if (typeof window !== 'undefined') {
      const mockScenario = localStorage.getItem('DEV_mockScenario');
      if (mockScenario && mockScenario !== 'none') {
        return apiClient.get<PlannerTrip>(`/planner/debug/scenario/${mockScenario}/`);
      }
    }
    return apiClient.get<PlannerTrip>(`${BASE}/${workspaceId}/plan/`);
  },

  updatePlan: (workspaceId: string, data: Partial<PlannerTrip>) =>
    apiClient.patch<PlannerTrip>(`${BASE}/${workspaceId}/plan/`, data),

  // â”€â”€â”€ Recommendations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  getRecommendations: (workspaceId: string) =>
    apiClient.get<Recommendation[]>(`${BASE}/${workspaceId}/recommendations/`),

  // â”€â”€â”€ Canvases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  listCanvases: (workspaceId: string) =>
    apiClient.get<CanvasInstance[]>(`${BASE}/${workspaceId}/canvases/`),

  createCanvas: (workspaceId: string, data: Partial<CanvasInstance>) =>
    apiClient.post<CanvasInstance>(`${BASE}/${workspaceId}/canvases/`, data),

  // â”€â”€â”€ Cart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  listCart: (workspaceId: string) =>
    apiClient.get<BookingOrder[]>(`${BASE}/${workspaceId}/cart/`),

  addToCart: (workspaceId: string, data: Partial<BookingOrder>) =>
    apiClient.post<BookingOrder>(`${BASE}/${workspaceId}/cart/`, data),

  // â”€â”€â”€ Saved Places â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  listPlaces: (workspaceId: string) =>
    apiClient.get<SavedPlace[]>(`${BASE}/${workspaceId}/places/`),

  savePlace: (workspaceId: string, data: Partial<SavedPlace>) =>
    apiClient.post<SavedPlace>(`${BASE}/${workspaceId}/places/`, data),
};
