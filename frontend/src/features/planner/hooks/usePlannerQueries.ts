import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plannerService } from '@/services/planner.service';
import { referenceService } from '@/services/reference.service';
import type { PlannerWorkspace, TransportPreference } from '@/services/planner.types';

export const plannerKeys = {
  all: ['planner'] as const,
  workspaces: ['planner', 'workspaces'] as const,
  workspace: (id: string) => ['planner', 'workspace', id] as const,
  messages: (id: string) => ['planner', 'messages', id] as const,
  plan: (id: string) => ['planner', 'plan', id] as const,
  proposals: (id: string) => ['planner', 'proposals', id] as const,
  ledger: (id: string) => ['planner', 'ledger', id] as const,
  insights: (id: string) => ['planner', 'insights', id] as const,
  transportPreference: ['planner', 'transport-preference'] as const,
  cityBriefing: (cityName: string, month?: number) => ['reference', 'city-briefing', cityName, month ?? null] as const,
};

/**
 * City Briefing — fetched only when the collapsed section under
 * CityHeaderNode is actually expanded (`enabled`), since most sections
 * never get opened. A 404 (city not on file) resolves to `null` rather
 * than surfacing as a query error — "we don't have this city yet" is a
 * normal, expected result here, not a failure.
 */
export function useCityBriefing(cityName: string, month?: number, enabled = true) {
  return useQuery({
    queryKey: plannerKeys.cityBriefing(cityName, month),
    queryFn: async () => {
      try {
        return await referenceService.getCityBriefing(cityName, month);
      } catch (err: any) {
        if (err?.status === 404) return null;
        throw err;
      }
    },
    enabled: enabled && Boolean(cityName),
    staleTime: 10 * 60_000,
  });
}

export function useTransportPreference() {
  return useQuery({
    queryKey: plannerKeys.transportPreference,
    queryFn: async () => {
      const { facts } = await plannerService.getTravelerProfile();
      const fact = facts.find((f) => f.key === 'transport_preference');
      return (fact?.value as TransportPreference | undefined) ?? {};
    },
    staleTime: 60_000,
  });
}

export function useSetTransportPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: TransportPreference) => plannerService.setTransportPreference(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.transportPreference });
    },
  });
}

export function useLedger(workspaceId: string | null) {
  return useQuery({
    queryKey: plannerKeys.ledger(workspaceId ?? ''),
    queryFn: () => plannerService.getLedger(workspaceId!),
    enabled: Boolean(workspaceId),
    retry: false, // draft workspaces legitimately 404
  });
}

export function useWorkspaces() {
  return useQuery({
    queryKey: plannerKeys.workspaces,
    queryFn: plannerService.listWorkspaces,
    staleTime: 30_000,
  });
}

export function useWorkspace(workspaceId: string | null) {
  return useQuery({
    queryKey: plannerKeys.workspace(workspaceId ?? ''),
    queryFn: () => plannerService.getWorkspace(workspaceId!),
    enabled: Boolean(workspaceId),
  });
}

export function usePlan(workspaceId: string | null) {
  return useQuery({
    queryKey: plannerKeys.plan(workspaceId ?? ''),
    queryFn: () => plannerService.getPlan(workspaceId!),
    enabled: Boolean(workspaceId),
    retry: false, // draft workspaces legitimately 404 here
    // Always re-fetch on mount so PlannerWorkspace never inherits a stale
    // error cached from before the plan was generated (the 404 draft phase).
    refetchOnMount: 'always',
  });
}

export function useProposals(workspaceId: string | null) {
  return useQuery({
    queryKey: plannerKeys.proposals(workspaceId ?? ''),
    queryFn: () => plannerService.listProposals(workspaceId!),
    enabled: Boolean(workspaceId),
    select: (proposals) => proposals.filter((p) => p.status === 'open'),
  });
}

export function useAcceptProposal(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => plannerService.acceptProposal(workspaceId!, proposalId),
    onSettled: () => {
      // Accept mutates the trip server-side; expired proposals also refresh
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: plannerKeys.proposals(workspaceId) });
        queryClient.invalidateQueries({ queryKey: plannerKeys.plan(workspaceId) });
        queryClient.invalidateQueries({ queryKey: plannerKeys.insights(workspaceId) });
      }
    },
  });
}

export function useInsights(workspaceId: string | null) {
  return useQuery({
    queryKey: plannerKeys.insights(workspaceId ?? ''),
    queryFn: () => plannerService.getInsights(workspaceId!),
    enabled: Boolean(workspaceId),
    retry: false,
  });
}

export function useDismissInsight(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contextHash: string) => plannerService.dismissInsight(workspaceId!, contextHash),
    onSettled: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: plannerKeys.insights(workspaceId) });
      }
    },
  });
}

export function useOptimizeRoute(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => plannerService.optimizeRoute(workspaceId!),
    onSuccess: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: plannerKeys.proposals(workspaceId) });
      }
    },
  });
}

export function useRejectProposal(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, reason }: { proposalId: string; reason?: string }) =>
      plannerService.rejectProposal(workspaceId!, proposalId, reason),
    onSettled: () => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: plannerKeys.proposals(workspaceId) });
      }
    },
  });
}

export function useSavePlan(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => plannerService.saveWorkspacePlan(workspaceId!),
    onSuccess: (workspace) => {
      // The updated workspace carries the new bucket — patch caches in place
      queryClient.setQueryData<PlannerWorkspace[]>(plannerKeys.workspaces, (prev) =>
        prev?.map((w) => (w.id === workspace.id ? workspace : w))
      );
      queryClient.setQueryData(plannerKeys.workspace(workspace.id), workspace);
    },
  });
}

export function useBookTrip(workspaceId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options?: { allow_partial?: boolean }) =>
      plannerService.bookWorkspace(workspaceId!, options),
    onSuccess: ({ workspace }) => {
      if (!workspace) return;
      queryClient.setQueryData<PlannerWorkspace[]>(plannerKeys.workspaces, (prev) =>
        prev?.map((w) => (w.id === workspace.id ? workspace : w))
      );
      queryClient.setQueryData(plannerKeys.workspace(workspace.id), workspace);
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: plannerKeys.plan(workspaceId) });
        queryClient.invalidateQueries({ queryKey: plannerKeys.ledger(workspaceId) });
      }
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plannerService.deleteWorkspace(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<PlannerWorkspace[]>(plannerKeys.workspaces, (prev) =>
        prev?.filter((w) => w.id !== id)
      );
      queryClient.removeQueries({ queryKey: plannerKeys.workspace(id) });
      queryClient.removeQueries({ queryKey: plannerKeys.messages(id) });
      queryClient.removeQueries({ queryKey: plannerKeys.plan(id) });
    },
  });
}

// ─── Recommended Trips Hooks ────────────────────────────────

export function useRecommendedTrips() {
  return useQuery({
    queryKey: ['recommended-trips'],
    queryFn: plannerService.listRecommendedTrips,
    staleTime: 300_000,
  });
}

export function useCopyRecommendedTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => plannerService.copyRecommendedTrip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plannerKeys.workspaces });
    },
  });
}

