/**
 * usePlanner — React Query hooks for planner server state.
 *
 * All data fetching and mutations live here.
 * The Zustand store (planner.store.ts) manages only UI chrome.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plannerService } from '@/services/planner.service';
import { usePlannerStore } from '@/features/_planner_archive/store/planner.store';
import type { ChatResponse, PlannerWorkspace } from '@/services/planner.types';

// ─── Query Keys ─────────────────────────────────────

const keys = {
  workspaces: ['planner', 'workspaces'] as const,
  workspace: (id: string) => ['planner', 'workspace', id] as const,
  messages: (id: string) => ['planner', 'messages', id] as const,
  plan: (id: string) => ['planner', 'plan', id] as const,
  context: (id: string) => ['planner', 'context', id] as const,
  recommendations: (id: string) => ['planner', 'recommendations', id] as const,
  canvases: (id: string) => ['planner', 'canvases', id] as const,
  cart: (id: string) => ['planner', 'cart', id] as const,
};

// ─── Workspaces ─────────────────────────────────────

export function useWorkspaces() {
  return useQuery({
    queryKey: keys.workspaces,
    queryFn: plannerService.listWorkspaces,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  const setActiveWorkspaceId = usePlannerStore((s) => s.setActiveWorkspaceId);

  return useMutation({
    mutationFn: (title?: string) => plannerService.createWorkspace(title),
    onSuccess: (workspace: PlannerWorkspace) => {
      qc.invalidateQueries({ queryKey: keys.workspaces });
      setActiveWorkspaceId(workspace.id);
    },
  });
}

// ─── Chat ───────────────────────────────────────────

export function useMessages(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.messages(workspaceId ?? ''),
    queryFn: () => plannerService.listMessages(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useSendMessage(workspaceId: string | null) {
  const qc = useQueryClient();
  const setIsSending = usePlannerStore((s) => s.setIsSending);

  return useMutation({
    mutationFn: (message: string) => {
      setIsSending(true);
      return plannerService.sendMessage(workspaceId!, message);
    },
    onSuccess: (_data: ChatResponse) => {
      if (workspaceId) {
        qc.invalidateQueries({ queryKey: keys.messages(workspaceId) });
        qc.invalidateQueries({ queryKey: keys.plan(workspaceId) });
        qc.invalidateQueries({ queryKey: keys.context(workspaceId) });
        qc.invalidateQueries({ queryKey: keys.recommendations(workspaceId) });
      }
    },
    onSettled: () => {
      setIsSending(false);
    },
  });
}

// ─── Plan ───────────────────────────────────────────

export function usePlan(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.plan(workspaceId ?? ''),
    queryFn: () => plannerService.getPlan(workspaceId!),
    enabled: !!workspaceId,
  });
}

// ─── Context ────────────────────────────────────────

export function useContext(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.context(workspaceId ?? ''),
    queryFn: () => plannerService.getContext(workspaceId!),
    enabled: !!workspaceId,
  });
}

// ─── Recommendations ────────────────────────────────

export function useRecommendations(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.recommendations(workspaceId ?? ''),
    queryFn: () => plannerService.getRecommendations(workspaceId!),
    enabled: !!workspaceId,
  });
}

// ─── Cart ───────────────────────────────────────────

export function useCart(workspaceId: string | null) {
  return useQuery({
    queryKey: keys.cart(workspaceId ?? ''),
    queryFn: () => plannerService.listCart(workspaceId!),
    enabled: !!workspaceId,
  });
}
