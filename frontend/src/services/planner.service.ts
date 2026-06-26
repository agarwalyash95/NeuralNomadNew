import { apiClient } from './api';
import {
  PlannerWorkspace,
  PlannerWorkspaceSummary,
  WorkspaceContext,
  WorkspaceChat,
  CanvasInstance,
  CanvasData,
  BookingOrder,
  SavedPlace,
  PlannerTrip,
  Recommendation,
  PaginatedResponse
} from './planner.types';

export const plannerService = {
  // Workspaces
  getWorkspaces: async () => {
    const res = await apiClient.get<PaginatedResponse<PlannerWorkspace> | PlannerWorkspace[]>('/planner/workspaces/');
    return Array.isArray(res) ? res : res.results;
  },
  
  getWorkspace: (id: string) => {
    return apiClient.get<PlannerWorkspace>(`/planner/workspaces/${id}/`);
  },
  
  getWorkspaceSummary: (id: string) => {
    return apiClient.get<PlannerWorkspaceSummary>(`/planner/workspaces/${id}/summary/`);
  },
  
  createWorkspace: (data: Partial<PlannerWorkspace>) => {
    return apiClient.post<PlannerWorkspace>('/planner/workspaces/', data);
  },
  
  updateWorkspace: (id: string, data: Partial<PlannerWorkspace>) => {
    return apiClient.patch<PlannerWorkspace>(`/planner/workspaces/${id}/`, data);
  },
  
  deleteWorkspace: (id: string) => {
    return apiClient.delete<void>(`/planner/workspaces/${id}/`);
  },

  // Context
  getWorkspaceContext: (workspaceId: string) => {
    return apiClient.get<WorkspaceContext>(`/planner/workspaces/${workspaceId}/context/`);
  },
  
  updateWorkspaceContext: (workspaceId: string, data: Partial<WorkspaceContext>) => {
    return apiClient.patch<WorkspaceContext>(`/planner/workspaces/${workspaceId}/context/`, data);
  },

  // Chat
  getWorkspaceChats: async (workspaceId: string) => {
    const res = await apiClient.get<PaginatedResponse<WorkspaceChat> | WorkspaceChat[]>(`/planner/workspaces/${workspaceId}/chat/`);
    return Array.isArray(res) ? res : res.results;
  },
  
  createWorkspaceChat: (workspaceId: string, data: { message: string }) => {
    return apiClient.post<WorkspaceChat>(`/planner/workspaces/${workspaceId}/chat/`, data);
  },

  // Canvases
  getWorkspaceCanvases: async (workspaceId: string) => {
    const res = await apiClient.get<PaginatedResponse<CanvasInstance> | CanvasInstance[]>(`/planner/workspaces/${workspaceId}/canvases/`);
    return Array.isArray(res) ? res : res.results;
  },
  
  createCanvas: (workspaceId: string, data: Partial<CanvasInstance>) => {
    return apiClient.post<CanvasInstance>(`/planner/workspaces/${workspaceId}/canvases/`, data);
  },
  
  getCanvasData: (workspaceId: string, canvasType: string) => {
    return apiClient.get<CanvasData>(`/planner/workspaces/${workspaceId}/canvases/${canvasType}/data/`);
  },
  
  saveCanvasData: (workspaceId: string, canvasType: string, data: Partial<CanvasData>) => {
    return apiClient.patch<CanvasData>(`/planner/workspaces/${workspaceId}/canvases/${canvasType}/data/`, data);
  },

  // Booking Orders
  getBookingOrders: async (workspaceId: string) => {
    const res = await apiClient.get<PaginatedResponse<BookingOrder> | BookingOrder[]>(`/planner/workspaces/${workspaceId}/cart/`);
    return Array.isArray(res) ? res : res.results;
  },
  
  createBookingOrder: (workspaceId: string, data: Partial<BookingOrder>) => {
    return apiClient.post<BookingOrder>(`/planner/workspaces/${workspaceId}/cart/`, data);
  },
  
  updateBookingOrder: (workspaceId: string, orderId: string, data: Partial<BookingOrder>) => {
    return apiClient.patch<BookingOrder>(`/planner/workspaces/${workspaceId}/cart/${orderId}/`, data);
  },
  
  deleteBookingOrder: (workspaceId: string, orderId: string) => {
    return apiClient.delete<void>(`/planner/workspaces/${workspaceId}/cart/${orderId}/`);
  },

  // Saved Places
  getSavedPlaces: async (workspaceId: string) => {
    const res = await apiClient.get<PaginatedResponse<SavedPlace> | SavedPlace[]>(`/planner/workspaces/${workspaceId}/places/`);
    return Array.isArray(res) ? res : res.results;
  },
  
  savePlace: (workspaceId: string, data: Partial<SavedPlace>) => {
    return apiClient.post<SavedPlace>(`/planner/workspaces/${workspaceId}/places/`, data);
  },
  
  deletePlace: (workspaceId: string, placeId: string) => {
    return apiClient.delete<void>(`/planner/workspaces/${workspaceId}/places/${placeId}/`);
  },

  getPlan: (workspaceId: string) => {
    return apiClient.get<PlannerTrip>(`/planner/workspaces/${workspaceId}/plan/`);
  },

  recalculatePlan: (workspaceId: string, mode = 'driving') => {
    return apiClient.post<{ routes_updated: number; trip: PlannerTrip }>(
      `/planner/workspaces/${workspaceId}/plan/recalculate/`,
      { mode },
    );
  },

  getRecommendations: async (workspaceId: string) => {
    const res = await apiClient.get<Recommendation[] | PaginatedResponse<Recommendation>>(
      `/planner/workspaces/${workspaceId}/recommendations/`,
    );
    return Array.isArray(res) ? res : res.results;
  },
};
