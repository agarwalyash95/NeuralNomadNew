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
  PlanInsight,
  CommitmentStatus,
  TripLedger,
  TravelerFact,
  TransportPreference,
  TransportLegComparison,
  GenerationJobStatus,
  JourneyOption,
  RecommendedTrip,
  StructuredRecommendation,
  PlanMutationResponse,
  PriceLookupResult,
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

  sendLazyMessage: (message: string, structured_value?: any, turn_id?: string) =>
    apiClient.post<ChatResponse>('/planner/chat/', { message, structured_value, turn_id }),

  getWorkspace: (id: string) =>
    apiClient.get<PlannerWorkspace>(`${BASE}/${id}/`),

  updateWorkspace: (id: string, data: Partial<PlannerWorkspace>) =>
    apiClient.patch<PlannerWorkspace>(`${BASE}/${id}/`, data),

  deleteWorkspace: (id: string) =>
    apiClient.delete(`${BASE}/${id}/`),

  // ─── Chat ────────────────────────────────────────────────

  listMessages: (workspaceId: string) =>
    apiClient.get<ChatMessage[]>(`${BASE}/${workspaceId}/chat/`),

  sendMessage: (workspaceId: string, message: string, structured_value?: any, turn_id?: string) =>
    apiClient.post<ChatResponse>(`${BASE}/${workspaceId}/chat/`, { message, structured_value, turn_id }),

  /** Kicks off background generation — returns 202 with the job to poll */
  createPlan: (
    workspaceId: string,
    options: {
      confirm: true;
      expected_draft_revision: number;
      regenerate?: boolean;
    }
  ) => apiClient.post<GenerationJobStatus>(`${BASE}/${workspaceId}/plan/`, options),

  /** Real generation progress — poll ~1s while the loading screen shows */
  getPlanStatus: (workspaceId: string) =>
    apiClient.get<GenerationJobStatus>(`${BASE}/${workspaceId}/plan/status/`),

  resolveJourneyOptions: (workspaceId: string, expectedRevision: number) =>
    apiClient.post<{ revision: number; options: JourneyOption[]; needs_input: boolean }>(
      `${BASE}/${workspaceId}/journey-options/`,
      { expected_revision: expectedRevision }
    ),

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

  updatePlan: (
    workspaceId: string,
    data: Partial<PlannerTrip> & { expected_revision?: number; mutation_id?: string; source?: string }
  ) =>
    apiClient.patch<PlannerTrip>(`${BASE}/${workspaceId}/plan/`, data),

  selectPlanItem: (
    workspaceId: string,
    data: {
      target_block_id: string;
      selected_item: Record<string, any>;
      expected_revision: number;
      mutation_id: string;
      provider: string;
      selected_id: string;
      provenance: 'user_input' | 'widget' | 'manual_edit' | 'database' | 'cached_api' | 'live_api' | 'model_knowledge' | 'model_inference';
    }
  ) => apiClient.post<PlanMutationResponse>(`${BASE}/${workspaceId}/mutations/`, { type: 'select_item', ...data }),

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
    apiClient.post<{ verified: boolean; block: any; price: any; revision: number }>(
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

  /** Cross-trip transport preference — Cheapest/Fastest/Comfort priority +
   *  avoid-flights/avoid-overnight/minimal-transfers, read by booking
   *  canvases as their default sort/filter. */
  setTransportPreference: (value: TransportPreference) =>
    apiClient.put<{ facts: TravelerFact[] }>(`/planner/profile/`, { transport_preference: value }),

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

  // ─── Proactive insights — advisory, never a silent change ───

  getInsights: (workspaceId: string) =>
    apiClient.get<PlanInsight[]>(`${BASE}/${workspaceId}/insights/`),

  dismissInsight: (workspaceId: string, contextHash: string) =>
    apiClient.post<{ dismissed: boolean }>(`${BASE}/${workspaceId}/insights/${contextHash}/dismiss/`),

  // ─── Explainability — "why this?" on any recommendation card ───

  explainBlock: (block: { title: string; category?: string; city?: string; note?: string }, context?: string) =>
    apiClient.post<StructuredRecommendation>('/planner/recommendations/explain/', {
      block,
      context: context ?? '',
    }),

  getTripPrep: (workspaceId: string) =>
    apiClient.get<{
      weather: { avg_temp_c: number | null; precipitation_mm: number | null; provenance: string; note: string };
      packing: string[];
      health: { score: number; metrics: Record<string, { status: string; penalty: number }> };
    }>(`${BASE}/${workspaceId}/trip-prep/`),

  // ─── Transport mode comparison for one inter-city leg ────

  compareLegs: (origin: string, destination: string, date?: string, travelers?: number) => {
    const params = new URLSearchParams({ origin, destination });
    if (date) params.set('date', date);
    if (travelers) params.set('travelers', String(travelers));
    return apiClient.get<TransportLegComparison>(`/planner/legs/compare/?${params.toString()}`);
  },

  /**
   * Phase 2e (docs/planner-north-star-audit-and-vision.md) — a price check
   * for something not yet in the plan (e.g. a hotel search result). Never
   * fabricates: throws (404 via apiClient's error handling) when no live
   * or historical price exists, the same honest outcome verifyBlockPrice
   * already gives for a placed block.
   */
  lookupPrice: (params: { serviceType: string; date: string; provider?: string; destination?: string; origin?: string; code?: string }) => {
    const query = new URLSearchParams({ service_type: params.serviceType, date: params.date });
    if (params.provider) query.set('provider', params.provider);
    if (params.destination) query.set('destination', params.destination);
    if (params.origin) query.set('origin', params.origin);
    if (params.code) query.set('code', params.code);
    return apiClient.get<{ found: boolean; price: PriceLookupResult }>(`/planner/price-lookup/?${query.toString()}`);
  },

  // ─── Route optimization — always files a proposal, never mutates directly ──

  optimizeRoute: (workspaceId: string) =>
    apiClient.post<{ detail: string | null; proposal: PlanProposal | null }>(
      `${BASE}/${workspaceId}/optimize-route/`
    ),

  // ─── Recommended Trips ───────────────────────────────────
  // The `travel_intelligence` app (and this endpoint) was removed — it kept its
  // own duplicate trip schema instead of deriving from real PlannerTrip data.
  // Stubbed empty until the community PlanTemplate corpus (planner-master-plan.md
  // §2) replaces it with real, anonymized, derived trips. RecommendedTripsSection
  // already hides itself when the list is empty, so this is a safe no-op today.

  listRecommendedTrips: async (): Promise<RecommendedTrip[]> => [],

  copyRecommendedTrip: (_id: string): Promise<{ workspace_id: string; title: string }> => {
    throw new Error('Recommended trips are temporarily unavailable.');
  },
};
