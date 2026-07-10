/**
 * Planner API service â€” all REST calls for the planner workspace.
 * Uses the existing ApiClient with JWT auth.
 */

import { apiClient } from './api';
import type {
  PlannerWorkspace,
  ChatMessage,
  ChatResponse,
  PlannerTrip,
  PlanProposal,
  CommitmentStatus,
  TripLedger,
  TravelerFact,
  GenerationJobStatus,
} from './planner.types';

const BASE = '/planner/workspaces';

export const plannerService = {
  // â”€â”€â”€ Workspaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  listWorkspaces: async (): Promise<PlannerWorkspace[]> => {
    const data = await apiClient.get<{ results: PlannerWorkspace[] } | PlannerWorkspace[]>(`${BASE}/`);
    // DRF returns paginated: { count, results: [] }
    return Array.isArray(data) ? data : (data as any).results ?? [];
  },

  createWorkspace: (title: string = 'New Trip') =>
    apiClient.post<PlannerWorkspace>(`${BASE}/`, { title }),

  sendLazyMessage: (message: string, structured_value?: any) =>
    apiClient.post<ChatResponse>('/planner/chat/', { message, structured_value }),

  getWorkspace: (id: string) =>
    apiClient.get<PlannerWorkspace>(`${BASE}/${id}/`),

  updateWorkspace: (id: string, data: Partial<PlannerWorkspace>) =>
    apiClient.patch<PlannerWorkspace>(`${BASE}/${id}/`, data),

  deleteWorkspace: (id: string) =>
    apiClient.delete(`${BASE}/${id}/`),

  // ─── Chat ────────────────────────────────────────────────

  listMessages: (workspaceId: string) =>
    apiClient.get<ChatMessage[]>(`${BASE}/${workspaceId}/chat/`),

  sendMessage: (workspaceId: string, message: string, structured_value?: any) =>
    apiClient.post<ChatResponse>(`${BASE}/${workspaceId}/chat/`, { message, structured_value }),

  /** Kicks off background generation — returns 202 with the job to poll */
  createPlan: (workspaceId: string) =>
    apiClient.post<GenerationJobStatus>(`${BASE}/${workspaceId}/plan/`),

  /** Real generation progress — poll ~1s while the loading screen shows */
  getPlanStatus: (workspaceId: string) =>
    apiClient.get<GenerationJobStatus>(`${BASE}/${workspaceId}/plan/status/`),

  // â”€â”€â”€ Plan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  getPlan: (workspaceId: string) => {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      const mockScenario = localStorage.getItem('DEV_mockScenario');
      if (mockScenario && mockScenario !== 'none') {
        return apiClient.get<PlannerTrip>(`/planner/debug/scenario/${mockScenario}/`);
      }
    }
    return apiClient.get<PlannerTrip>(`${BASE}/${workspaceId}/plan/`);
  },

  updatePlan: (workspaceId: string, data: Partial<PlannerTrip>) =>
    apiClient.patch<PlannerTrip>(`${BASE}/${workspaceId}/plan/`, data),

  // ─── Plan lifecycle: Recent → Saved → Booked ─────────────

  /** Save the plan — workspace moves to the Saved bucket until modified again */
  saveWorkspacePlan: (workspaceId: string) =>
    apiClient.post<PlannerWorkspace>(`${BASE}/${workspaceId}/save/`),

  /**
   * Book the whole trip. 409 with {blocking_blocks} when costed blocks lack
   * booked commitments — drive those through transitionBlocks first.
   */
  bookWorkspace: (workspaceId: string, options?: { allow_partial?: boolean }) =>
    apiClient.post<{ workspace: PlannerWorkspace; trip?: PlannerTrip; blocking_blocks?: { block_id: string; title: string; status: string }[] }>(
      `${BASE}/${workspaceId}/book/`,
      options ?? {}
    ),

  /**
   * Verify a block's price against real data. The server writes cost +
   * provenance atomically and returns the updated block. 404 = honest miss.
   */
  verifyBlock: (
    workspaceId: string,
    blockId: string,
    context: {
      service_type: string;
      date: string;
      provider?: string;
      code?: string;
      origin?: string;
      destination?: string;
    }
  ) =>
    apiClient.post<{ verified: boolean; block: any; price: any }>(
      `${BASE}/${workspaceId}/blocks/${blockId}/verify/`,
      context
    ),

  // ─── Commitments & Ledger ────────────────────────────────

  /** Move blocks up the commitment ladder: priced → held → booked → ticketed */
  transitionBlocks: (
    workspaceId: string,
    data: {
      to: CommitmentStatus;
      block_ids: string[];
      quote?: { amount: number; currency?: string; expires_at?: string };
      refundable_until?: string;
      provider_ref?: string;
    }
  ) =>
    apiClient.post<{ transitioned: string[]; errors: Record<string, string>; trip: PlannerTrip }>(
      `${BASE}/${workspaceId}/blocks/transition/`,
      data
    ),

  getLedger: (workspaceId: string) =>
    apiClient.get<TripLedger>(`${BASE}/${workspaceId}/ledger/`),

  // ─── Traveler memory (inspectable, deletable) ────────────

  getTravelerProfile: () =>
    apiClient.get<{ facts: TravelerFact[] }>(`/planner/profile/`),

  deleteTravelerFact: (key: string) =>
    apiClient.delete<{ deleted: number }>(`/planner/profile/?key=${encodeURIComponent(key)}`),

  // ─── Price watches — standing tasks; findings arrive as proposals ──

  watchBlock: (workspaceId: string, blockId: string, thresholdAmount?: number) =>
    apiClient.post<{ watching: boolean; block_id: string }>(
      `${BASE}/${workspaceId}/blocks/${blockId}/watch/`,
      thresholdAmount !== undefined ? { threshold_amount: thresholdAmount } : {}
    ),

  unwatchBlock: (workspaceId: string, blockId: string) =>
    apiClient.delete<{ watching: boolean }>(`${BASE}/${workspaceId}/blocks/${blockId}/watch/`),

  // ─── Proposals — AI proposes, the traveler decides ──────

  listProposals: (workspaceId: string) =>
    apiClient.get<PlanProposal[]>(`${BASE}/${workspaceId}/proposals/`),

  createProposal: (workspaceId: string, data: Partial<PlanProposal>) =>
    apiClient.post<PlanProposal>(`${BASE}/${workspaceId}/proposals/`, data),

  acceptProposal: (workspaceId: string, proposalId: string) =>
    apiClient.post<{ status: string; proposal: PlanProposal; trip: PlannerTrip }>(
      `${BASE}/${workspaceId}/proposals/${proposalId}/accept/`
    ),

  rejectProposal: (workspaceId: string, proposalId: string, reason?: string) =>
    apiClient.post<{ status: string; proposal: PlanProposal }>(
      `${BASE}/${workspaceId}/proposals/${proposalId}/reject/`,
      { reason }
    ),
};
