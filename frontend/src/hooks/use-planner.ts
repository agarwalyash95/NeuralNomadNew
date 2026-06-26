import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plannerService } from '../services/planner.service';
import {
  PlannerWorkspace,
  WorkspaceContext,
  WorkspaceChat,
  CanvasInstance,
  CanvasData,
  BookingOrder,
  SavedPlace
} from '../services/planner.types';

export const plannerKeys = {
  all: ['planner'] as const,
  lists: () => [...plannerKeys.all, 'list'] as const,
  details: () => [...plannerKeys.all, 'detail'] as const,
  detail: (id: string) => [...plannerKeys.details(), id] as const,
  summary: (id: string) => [...plannerKeys.detail(id), 'summary'] as const,
  context: (id: string) => [...plannerKeys.detail(id), 'context'] as const,
  chats: (id: string) => [...plannerKeys.detail(id), 'chat'] as const,
  canvases: (id: string) => [...plannerKeys.detail(id), 'canvases'] as const,
  canvasData: (id: string, type: string) => [...plannerKeys.canvases(id), type, 'data'] as const,
  cart: (id: string) => [...plannerKeys.detail(id), 'cart'] as const,
  places: (id: string) => [...plannerKeys.detail(id), 'places'] as const,
  plan: (id: string) => [...plannerKeys.detail(id), 'plan'] as const,
  recommendations: (id: string) => [...plannerKeys.detail(id), 'recommendations'] as const,
};

// --- Workspaces ---

export function useWorkspaces() {
  return useQuery({
    queryKey: plannerKeys.lists(),
    queryFn: () => plannerService.getWorkspaces(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: plannerKeys.detail(id),
    queryFn: () => plannerService.getWorkspace(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useWorkspaceSummary(id: string) {
  return useQuery({
    queryKey: plannerKeys.summary(id),
    queryFn: () => plannerService.getWorkspaceSummary(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PlannerWorkspace>) => plannerService.createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.lists() });
    },
  });
}

export function useUpdateWorkspace(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PlannerWorkspace>) => plannerService.updateWorkspace(id, data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: plannerKeys.detail(id) });
      const previousWorkspace = queryClient.getQueryData(plannerKeys.detail(id));
      if (previousWorkspace) {
        queryClient.setQueryData(plannerKeys.detail(id), {
          ...previousWorkspace,
          ...newData,
        });
      }
      return { previousWorkspace };
    },
    onError: (err, newData, context) => {
      if (context?.previousWorkspace) {
        queryClient.setQueryData(plannerKeys.detail(id), context.previousWorkspace);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: plannerKeys.summary(id) });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plannerService.deleteWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.lists() });
    },
  });
}

// --- Context ---

export function useWorkspaceContext(workspaceId: string) {
  return useQuery({
    queryKey: plannerKeys.context(workspaceId),
    queryFn: () => plannerService.getWorkspaceContext(workspaceId),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUpdateWorkspaceContext(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<WorkspaceContext>) => plannerService.updateWorkspaceContext(workspaceId, data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: plannerKeys.context(workspaceId) });
      const previous = queryClient.getQueryData(plannerKeys.context(workspaceId));
      if (previous) {
        queryClient.setQueryData(plannerKeys.context(workspaceId), { ...previous, ...newData });
      }
      return { previous };
    },
    onError: (err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(plannerKeys.context(workspaceId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.context(workspaceId) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.summary(workspaceId) });
    },
  });
}

// --- Chat ---

export function useWorkspaceChats(workspaceId: string) {
  return useQuery({
    queryKey: plannerKeys.chats(workspaceId),
    queryFn: () => plannerService.getWorkspaceChats(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useCreateWorkspaceChat(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { message: string }) => plannerService.createWorkspaceChat(workspaceId, data),
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey: plannerKeys.chats(workspaceId) });
      const previous = queryClient.getQueryData<WorkspaceChat[]>(plannerKeys.chats(workspaceId));
      if (previous) {
        const optimisticChat: WorkspaceChat = {
          id: `temp-${Date.now()}`,
          workspace: workspaceId,
          role: 'user',
          message: newMessage.message || '',
          created_at: new Date().toISOString(),
        };
        queryClient.setQueryData(plannerKeys.chats(workspaceId), [...previous, optimisticChat]);
      }
      return { previous };
    },
    onError: (err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(plannerKeys.chats(workspaceId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.chats(workspaceId) });
    },
  });
}

// --- Canvases ---

export function useWorkspaceCanvases(workspaceId: string) {
  return useQuery({
    queryKey: plannerKeys.canvases(workspaceId),
    queryFn: () => plannerService.getWorkspaceCanvases(workspaceId),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateCanvas(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CanvasInstance>) => plannerService.createCanvas(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.canvases(workspaceId) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.summary(workspaceId) });
    },
  });
}

export function useCanvasData(workspaceId: string, canvasType: string) {
  return useQuery({
    queryKey: plannerKeys.canvasData(workspaceId, canvasType),
    queryFn: () => plannerService.getCanvasData(workspaceId, canvasType),
    enabled: !!workspaceId && !!canvasType,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useSaveCanvasData(workspaceId: string, canvasType: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CanvasData>) => plannerService.saveCanvasData(workspaceId, canvasType, data),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({ queryKey: plannerKeys.canvasData(workspaceId, canvasType) });
      const previous = queryClient.getQueryData(plannerKeys.canvasData(workspaceId, canvasType));
      if (previous) {
        queryClient.setQueryData(plannerKeys.canvasData(workspaceId, canvasType), { ...previous, ...newData });
      }
      return { previous };
    },
    onError: (err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(plannerKeys.canvasData(workspaceId, canvasType), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.canvasData(workspaceId, canvasType) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.summary(workspaceId) });
    },
  });
}

// --- Bookings (Cart) ---

export function useBookingOrders(workspaceId: string) {
  return useQuery({
    queryKey: plannerKeys.cart(workspaceId),
    queryFn: () => plannerService.getBookingOrders(workspaceId),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 1, // 1 minute
  });
}

export function useCreateBookingOrder(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BookingOrder>) => plannerService.createBookingOrder(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.cart(workspaceId) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.summary(workspaceId) });
    },
  });
}

export function useUpdateBookingOrder(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: string; data: Partial<BookingOrder> }) => 
      plannerService.updateBookingOrder(workspaceId, orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.cart(workspaceId) });
    },
  });
}

export function useDeleteBookingOrder(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => plannerService.deleteBookingOrder(workspaceId, orderId),
    onMutate: async (orderId) => {
      await queryClient.cancelQueries({ queryKey: plannerKeys.cart(workspaceId) });
      const previous = queryClient.getQueryData<BookingOrder[]>(plannerKeys.cart(workspaceId));
      if (previous) {
        queryClient.setQueryData<BookingOrder[]>(
          plannerKeys.cart(workspaceId), 
          old => old?.filter(o => o.id !== orderId) || []
        );
      }
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(plannerKeys.cart(workspaceId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.cart(workspaceId) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.summary(workspaceId) });
    },
  });
}

// --- Saved Places ---

export function useSavedPlaces(workspaceId: string) {
  return useQuery({
    queryKey: plannerKeys.places(workspaceId),
    queryFn: () => plannerService.getSavedPlaces(workspaceId),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSavePlace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SavedPlace>) => plannerService.savePlace(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.places(workspaceId) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.summary(workspaceId) });
    },
  });
}

export function useDeletePlace(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (placeId: string) => plannerService.deletePlace(workspaceId, placeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.places(workspaceId) });
      queryClient.invalidateQueries({ queryKey: plannerKeys.summary(workspaceId) });
    },
  });
}

// --- Plan & Recommendations ---

export function usePlan(workspaceId: string) {
  return useQuery({
    queryKey: plannerKeys.plan(workspaceId),
    queryFn: () => plannerService.getPlan(workspaceId),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useRecalculatePlan(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode?: string) => plannerService.recalculatePlan(workspaceId, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.plan(workspaceId) });
    },
  });
}

export function useRecommendations(workspaceId: string) {
  return useQuery({
    queryKey: plannerKeys.recommendations(workspaceId),
    queryFn: () => plannerService.getRecommendations(workspaceId),
    enabled: !!workspaceId,
    staleTime: 1000 * 60 * 2,
  });
}
