/**
 * Planner type definitions — all TypeScript types for the planner feature.
 * These map directly to the backend models and API responses.
 */

// ─── Enums & Constants ─────────────────────────────

export type WorkspaceStatus = 'draft' | 'active' | 'completed' | 'archived' | 'saved' | 'booked';
export type WorkspaceMode = 'planning' | 'exploring' | 'booking' | 'review' | 'traveling' | 'completed';
export type ChatRole = 'user' | 'assistant' | 'system';
export type CanvasType = 'plan' | 'flight' | 'hotel' | 'train' | 'bus' | 'cab' | 'attraction' | 'activity' | 'restaurant' | 'visa' | 'forex' | 'booking';
export type CanvasLifecycleState = 'preview' | 'expanded' | 'focused';
/** Matches DayTheme.day_type from the plan generation skeleton (plan_generation.py) */
export type DayType = 'exploration' | 'transit' | 'relaxation' | 'arrival' | 'departure';
/** Raw lifecycle flag on a stored block — 'inactive' means soft-removed, not "cancelled".
 *  See _LEGACY_STATUS_MAP in apps.planner.services.block_schema. */
export type ActivityStatus = 'pending' | 'booked' | 'inactive';

// ─── Workspace ─────────────────────────────────────

export type WorkspaceLifecycle = 'traveling' | 'planning' | 'upcoming' | 'past';

/** Sidebar section — one at a time: Recent → Saved (on save) → Booked (on book) */
export type WorkspaceBucket = 'recent' | 'saved' | 'booked';

// ─── Plan generation job (real progress, polled ~1s) ───

export type GenerationPhaseState = 'pending' | 'active' | 'done' | 'failed';

export interface GenerationPhase {
  key: string;
  label: string;
  state: GenerationPhaseState;
  /** Real pipeline detail, e.g. "Jaipur: 18 attractions, 12 restaurants" */
  detail: string;
  at: string | null;
}

export interface GenerationJobStatus {
  job_id: string;
  revision: number;
  status: 'queued' | 'running' | 'done' | 'failed' | 'needs_input';
  phase: string;
  progress: number;
  phases: GenerationPhase[];
  error: string | null;
  /** True when `status === 'done'` is the curated fallback plan (the AI
   * pipeline failed and a non-AI plan was built instead), not a real
   * AI-composed success. */
  degraded: boolean;
  input_revision?: number;
  input_hash?: string;
  quality_state?: 'strong' | 'review_recommended' | 'blocked' | null;
  refinement_status?: 'not_applied' | 'applied';
  blockers?: Array<{ code?: string; detail?: string; actions?: string[]; [key: string]: unknown }>;
  usage?: Record<string, unknown>;
}

export interface PlannerWorkspace {
  id: string;
  title: string;
  status: WorkspaceStatus;
  mode: WorkspaceMode;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  chat_count: number;
  active_canvases: CanvasType[];
  draft_state?: TripDraftState;
  is_modified?: boolean;
  revision: number;
  /** Derived server-side from draft readiness, generation jobs, and trip state. */
  planner_state?: 'collecting' | 'ready' | 'generating' | 'generated' | 'generated_degraded' | 'refining';
  /** Where this trip sits in time — server-computed */
  lifecycle?: WorkspaceLifecycle;
  /** Sidebar section — server-computed, drives sidebar grouping */
  bucket?: WorkspaceBucket;
  /** One-line hint: what this trip needs from the user next */
  next_action?: string;
}

export interface TripDraftState {
  id: string;
  intent?: string;
  destination_city: string | null;
  destination_country?: string;
  destination_text: string;
  origin_city?: string | null;
  origin_text?: string;
  mobility_preferences?: Record<string, unknown>;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  infants: number;
  budget_tier: string;
  budget_amount: number | null;
  budget_currency: string;
  interests: string[];
  metadata: Record<string, unknown>;
  ready_for_plan: boolean;
  missing_slots: string[];
}

// ─── Chat ──────────────────────────────────────────

export interface WidgetData {
  type: string;
  data: Record<string, unknown>;
}

export interface CommandData {
  type: string;
  payload: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  message: string;
  widgets?: WidgetData[];
  commands?: CommandData[];
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ChatResponse {
  workspace: PlannerWorkspace;
  draft_state: TripDraftState;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
  command_results: Array<{
    type: string;
    status: string;
    result?: Record<string, unknown>;
    error?: string;
  }>;
  ready_for_plan: boolean;
  missing_slots: string[];
}

// ─── Trip / Plan ───────────────────────────────────

/**
 * A single itinerary block, as generated (plan_generation.py `_candidate_block`
 * / `_transport_block`) or as rewritten by a helper-canvas edit (blockMerge.ts
 * `toRawActivity` — the only other place this shape is constructed, and it
 * deliberately mirrors this one).
 */
export interface TripActivity {
  id: string;
  title: string;
  /** Block kind: attraction | activity | food | hotel | flight | train | bus | cab */
  category: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  end_time: string | null;
  estimated_cost: number | null;
  currency_code: string;
  status: ActivityStatus;
  /** Soft-delete flag, independent of `status` */
  is_active?: boolean;
  notes: string | null;
  rating: number | null;
  image_url: string | null;
  ai_tip: string | null;
  /** M5 'expert reasoning shown': the PreferenceScorer reason(s) this block
   *  was ranked/chosen (plan_generation.py `_candidate_block`). Always
   *  present on a generated block; absent on a manually-added one. */
  why?: string | null;
  metadata: Record<string, unknown>;
  /** Block schema v2 — structured cost with provenance (trust grammar).
   *  Always present on reads: PlannerTripSerializer.to_representation upcasts
   *  every activity (apps.planner.services.block_schema.upcast_activity). */
  cost: {
    amount: number | null;
    currency: string;
    provenance: {
      tier: 'verified' | 'estimated' | 'suggested';
      source?: string;
      basis?: string;
      verified_at?: string;
    };
  };
  /** Block schema v2 — commitment ladder. Always present on reads (see `cost`). */
  block_status: 'idea' | 'planned' | 'priced' | 'booked';
  /** Alternate candidates from the same composition pass — real cached
   *  places only, absent when none were generated for this slot. */
  _aiInsights?: {
    candidates: {
      id: string;
      title: string;
      subtitle: string;
      rating: number | null;
      aiTip: string | null;
      place_id: string | null;
      /** M5: grounded "chosen over this because..." sentence, computed at
       *  generation time from the same PreferenceScorer reasons as `why` —
       *  never a separate LLM call. */
      tradeoff?: string | null;
    }[];
  } | null;
}

export interface TripDay {
  id: string;
  day_number: number;
  date: string | null;
  title: string;
  day_type: DayType;
  /** City name this day belongs to */
  city: string;
  activities: TripActivity[];
  /** Precomputed leg distances between consecutive geo-tagged blocks,
   *  keyed `${fromBlockId}:${toBlockId}` */
  transit_hints?: Record<string, { distance_km: number; duration_mins: number; source?: string }>;
  /** Real month climate normals stamped at generation — never a live forecast */
  weather_normal?: { month: number; avg_temp_c: number | null; precipitation_mm: number | null };
}

/**
 * Legacy transit-leg shape stored on TripCity.transitToNext — pre-dates
 * block schema v2's activity shape and was never migrated onto it (`type`
 * instead of `category`, `details` instead of `notes`, no `location_name`/
 * `ai_tip`/`rating`/`image_url`). apps.planner.services.block_schema /
 * commitments / insight_engine read it generically via dict .get(), so the
 * mismatch is backend-tolerated but real — see planTransform.ts's inline
 * mapping (the one place this shape is read) and serializePlanUpdate (the
 * one place it's written).
 */
export interface TripCityTransit {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  details?: string;
  price?: string;
  cost?: {
    amount: number | null;
    currency: string;
    provenance: {
      tier: 'verified' | 'estimated' | 'suggested';
      source?: string;
      basis?: string;
      verified_at?: string;
    };
  };
  block_status?: 'idea' | 'planned' | 'priced' | 'booked';
  status?: ActivityStatus;
  is_active?: boolean;
  image?: string;
  metadata?: { origin_code?: string; destination_code?: string; [key: string]: unknown };
}

export interface TripCity {
  /** Not stamped by plan generation — only present once the frontend
   *  round-trips a saved edit through serializePlanUpdate */
  id?: string;
  name: string;
  country: string;
  order: number;
  nights: number;
  arrival_date: string | null;
  departure_date: string | null;
  /** Transport leg into the NEXT city. Legacy/frontend-authored field, not
   *  written by plan_generation.py — absent on the trip's last city. */
  transitToNext?: TripCityTransit | null;
}

export interface PlannerTrip {
  id: string;
  title: string;
  summary: string;
  total_budget: number;
  spent_budget: number;
  currency_code: string;
  metadata: Record<string, unknown>;
  scorecard?: {
    quality_state?: 'strong' | 'review_recommended' | 'blocked';
    flagged_for_review?: boolean;
    reasons?: string[];
    /** M5 'expert reasoning shown' — set only when the LLM critic pass ran
     *  (plan was flagged for review and the AI-call budget allowed it). */
    critic_review?: {
      summary: string;
      findings: { issue: string; day_number?: number | null; severity: string }[];
    } | null;
    [key: string]: unknown;
  };
  cities: TripCity[];
  days: TripDay[];
  /** Block schema version emitted by the backend (v2 = provenance-aware) */
  schema_version?: number;
  /** Monotonic backend revision used for compare-and-swap writes. */
  revision: number;
}

export interface JourneySegment {
  journey_id: string;
  segment_index: number;
  segment_role: 'first_mile' | 'mainline' | 'last_mile';
  mode: string;
  origin: string;
  destination: string;
  booking_availability: 'available' | 'limited' | 'unavailable' | 'unverified';
  provenance: 'live_provider' | 'cached_provider' | 'verified_database' | 'estimated' | 'ai_recommended' | 'fallback';
  freshness: 'live' | 'fresh' | 'stale' | 'unknown';
  [key: string]: unknown;
}

export interface JourneyOption {
  id: string;
  mode: string;
  feasible: boolean;
  recommended: boolean;
  requires_verification: boolean;
  planning_suitability: { score: number; reasons: string[] };
  booking_availability: 'available' | 'limited' | 'unavailable' | 'unverified';
  segments: JourneySegment[];
  [key: string]: unknown;
}

export interface PlanMutationResponse {
  trip: PlannerTrip;
  revision: number;
  changed_sections: string[];
}

// ─── Proposals — AI proposes, the traveler decides ──

export type ProposalStatus = 'open' | 'accepted' | 'rejected' | 'expired';

export interface DiffExplanation {
  what_changed: string;
  why: string;
  what_improved: string[];
  what_got_worse: string[];
  confidence: string;
  can_undo: boolean;
}

export interface PlanProposal {
  id: string;
  kind: 'route_optimization' | 'plan_edit' | 'price_watch' | 'insight';
  title: string;
  rationale: string;
  diff: {
    before?: { days: any[] };
    after?: { days: any[] };
    deltas?: { saved_km?: number; saved_mins?: number; cost_delta?: number };
  };
  metadata?: {
    diff_explanation?: DiffExplanation;
    [key: string]: any;
  };
  status: ProposalStatus;
  rejection_reason: string;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
}

// ─── Proactive insights — advisory, never a silent plan change ──────

export interface PlanInsight {
  rule: string;
  day_number: number | null;
  severity: 'info' | 'warning';
  message: string;
  related_block_ids: string[];
  action: null; // K3's two rules are advisory-only; actionable rules land in K5
  context_hash: string;
}

// ─── Explainability (T2.1 / T5.1) ────────────────────

export interface ConfidenceDimension {
  dimension: string;
  score: number;
  explanation: string;
  trust_tier: 'verified' | 'estimated' | 'suggested';
}

export interface RecommendationAlternative {
  title: string;
  rationale: string;
  tradeoffs: string[];
}

export interface StructuredRecommendation {
  title: string;
  rationale: string;
  why_this: string[];
  confidence_score: number;
  confidence_explanation: string;
  confidence_dimensions: ConfidenceDimension[];
  assumptions: string[];
  tradeoffs: string[];
  expected_impact: Record<string, string>;
  alternatives: RecommendationAlternative[];
  uncertainty_state: 'high_confidence' | 'medium_confidence' | 'needs_decision' | 'weather_dependent' | 'traffic_dependent';
}

// ─── Traveler memory ────────────────────────────────

export interface TravelerFact {
  key: string;
  value: unknown;
  /** stated = user said it; inferred = derived from behavior; confirmed = inferred then user-approved */
  provenance: 'stated' | 'inferred' | 'confirmed';
  source_trip: string | null;
  updated_at: string;
}

/** A `transport_preference` TravelerFact's value shape — cross-trip, set
 *  once in the header kebab, read by booking canvases as their default sort/filter. */
export interface TransportPreference {
  priority?: 'cheapest' | 'fastest' | 'comfort' | null;
  avoid_flights?: boolean;
  avoid_overnight?: boolean;
  minimal_transfers?: boolean;
}

// ─── Transport leg comparison ───────────────────────

export interface TransportLegRow {
  mode: 'flight' | 'train' | 'bus' | 'cab';
  duration_mins: number | null;
  duration_label: string | null;
  distance_km: number | null;
  price: number | null;
  price_label: string | null;
  provenance: { tier: string; source?: string; basis?: string } | null;
}

export interface TransportLegComparison {
  origin: string;
  destination: string;
  rows: TransportLegRow[];
  recommendation: { mode: string; alternative_mode?: string; reason: string } | null;
}

// ─── Price lookup (Phase 2e, docs/planner-north-star-audit-and-vision.md) ──
// A price check for something NOT YET in the plan (e.g. a hotel search
// result) — mirrors the shape apps.reference.services.live_price returns.

export interface PriceLookupResult {
  status: string;
  price: string;
  exact_price: number;
  provider: string;
  code: string;
  details: Record<string, any>;
  provenance: { tier: string; source?: string; basis?: string; verified_at?: string };
  price_trend: { direction: 'up' | 'down' | 'flat'; magnitude_pct: number; basis: string } | null;
}

// ─── Commitments & Ledger ──────────────────────────

export type CommitmentStatus = 'priced' | 'held' | 'booked' | 'ticketed';

export interface BlockCommitment {
  block_id: string;
  status: CommitmentStatus;
  amount: number | null;
  currency: string;
  refundable_until: string | null;
  provider_ref: string;
}

export interface TripLedger {
  currency: string;
  budget: number | null;
  /** Money actually committed (booked/ticketed rows) */
  committed: number;
  /** Cost of remaining active blocks — honesty-labeled by weakest input tier */
  planned_estimate: number;
  planned_tier: 'verified' | 'estimated' | 'suggested' | null;
  commitments: BlockCommitment[];
}

// ─── Reference Data ────────────────────────────────

export interface Country {
  id: string;
  name: string;
  iso_code: string;
  currency_code: string;
  continent: string;
}

export interface City {
  id: string;
  name: string;
  state_name?: string;
  country_name?: string;
  latitude: number;
  longitude: number;
  is_major: boolean;
}

export interface Airport {
  id: string;
  iata_code: string;
  name: string;
  display_name: string;
  city_name?: string;
  is_international: boolean;
}

export interface TrainStation {
  id: string;
  code: string;
  name: string;
  city_name?: string;
  station_type: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

// ─── Paginated Response ────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Canvas Color Theme ────────────────────────────

export const CANVAS_COLORS: Record<CanvasType, { accent: string; bg: string; text: string }> = {
  plan:       { accent: 'hsl(200, 80%, 55%)', bg: 'hsl(200, 80%, 97%)', text: 'hsl(200, 80%, 25%)' },
  flight:     { accent: 'hsl(220, 75%, 50%)', bg: 'hsl(220, 75%, 97%)', text: 'hsl(220, 75%, 25%)' },
  hotel:      { accent: 'hsl(280, 60%, 55%)', bg: 'hsl(280, 60%, 97%)', text: 'hsl(280, 60%, 25%)' },
  train:      { accent: 'hsl(25, 85%, 50%)',  bg: 'hsl(25, 85%, 97%)',  text: 'hsl(25, 85%, 25%)' },
  bus:        { accent: 'hsl(40, 90%, 50%)',  bg: 'hsl(40, 90%, 97%)',  text: 'hsl(40, 90%, 25%)' },
  cab:        { accent: 'hsl(150, 60%, 40%)', bg: 'hsl(150, 60%, 97%)', text: 'hsl(150, 60%, 20%)' },
  attraction: { accent: 'hsl(15, 80%, 55%)',  bg: 'hsl(15, 80%, 97%)',  text: 'hsl(15, 80%, 25%)' },
  activity:   { accent: 'hsl(175, 60%, 40%)', bg: 'hsl(175, 60%, 97%)', text: 'hsl(175, 60%, 20%)' },
  restaurant: { accent: 'hsl(340, 65%, 55%)', bg: 'hsl(340, 65%, 97%)', text: 'hsl(340, 65%, 25%)' },
  visa:       { accent: 'hsl(245, 60%, 50%)', bg: 'hsl(245, 60%, 97%)', text: 'hsl(245, 60%, 25%)' },
  forex:      { accent: 'hsl(160, 55%, 45%)', bg: 'hsl(160, 55%, 97%)', text: 'hsl(160, 55%, 20%)' },
  booking:    { accent: 'hsl(250, 70%, 55%)', bg: 'hsl(250, 70%, 97%)', text: 'hsl(250, 70%, 25%)' },
};

export const CANVAS_ICONS: Record<CanvasType, string> = {
  plan: 'Map',
  flight: 'Plane',
  hotel: 'Hotel',
  train: 'TrainFront',
  bus: 'Bus',
  cab: 'Car',
  attraction: 'Landmark',
  activity: 'Activity',
  restaurant: 'UtensilsCrossed',
  visa: 'FileCheck',
  forex: 'Coins',
  booking: 'ShoppingCart',
};

// ─── Recommended Trip ──────────────────────────────

export interface RecommendedTrip {
  id: string;
  title: string;
  destination: string;
  duration_days: number;
  best_season: string;
  budget_category: string;
  trip_style: string;
  ai_recommendation_score: number;
  short_description: string;
  number_of_cities: number;
  highlights: string[];
  estimated_total_cost: string;
  destination_image: string;
  is_active: boolean;
}

