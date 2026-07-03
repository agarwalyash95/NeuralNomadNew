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
export type DayType = 'preparation' | 'travel' | 'exploration' | 'return' | 'rest';
export type ActivityStatus = 'planned' | 'booked' | 'completed' | 'cancelled';

// ─── Workspace ─────────────────────────────────────

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
}

export interface TripDraftState {
  id: string;
  destination_city: string | null;
  destination_text: string;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  infants: number;
  budget_tier: string;
  budget_amount: string | null;
  budget_currency: string;
  interests: string[];
  metadata: Record<string, unknown>;
  ready_for_plan: boolean;
  missing_slots: string[];
}

// ─── Memory ────────────────────────────────────────

export interface PlannerMemory {
  destination: Record<string, string>;
  origin: Record<string, string>;
  dates: Record<string, string>;
  travelers: Record<string, number>;
  budget: Record<string, string | number>;
  transportation_preference: string[];
  hotel_preference: Record<string, unknown>;
  interests: string[];
  food_preference: Record<string, string>;
  accessibility: Record<string, unknown>;
  visa_status: Record<string, string>;
  booking_summary: Record<string, number>;
  current_phase: string;
  conversation_summary: string;
  last_ai_action: Record<string, unknown>;
}

// ─── Context ───────────────────────────────────────

export interface WorkspaceContext {
  origin_location: string;
  destination_location: string;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  infants: number;
  budget: number | null;
  budget_currency: string;
  travel_style: string;
  interests: string[];
  metadata: Record<string, unknown>;
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
  widgets: WidgetData[];
  commands: CommandData[];
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ChatResponse {
  workspace: PlannerWorkspace;
  draft_state: TripDraftState;
  user_message: {
    id: string;
    role: 'user';
    message: string;
    created_at: string;
  };
  assistant_message: {
    id: string;
    role: 'assistant';
    message: string;
    widgets: WidgetData[];
    commands: CommandData[];
    metadata?: Record<string, any>;
    created_at: string;
  };
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

export interface TripActivity {
  id: string;
  title: string;
  category: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  distance_km: number | null;
  travel_time_minutes: number | null;
  transport_mode: string;
  estimated_cost: number;
  currency_code: string;
  status: ActivityStatus;
  order: number;
  notes: string;
  weather_info: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface TripDay {
  id: string;
  day_number: number;
  date: string | null;
  title: string;
  day_type: DayType;
  activities: TripActivity[];
}

export interface TripCity {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  order: number;
  nights: number;
  arrival_date: string | null;
  departure_date: string | null;
}

export interface PlannerTrip {
  id: string;
  title: string;
  summary: string;
  total_budget: number;
  spent_budget: number;
  currency_code: string;
  metadata: Record<string, unknown>;
  cities: TripCity[];
  days: TripDay[];
}

// ─── Recommendation ────────────────────────────────

export interface Recommendation {
  id: string;
  type: string;
  canvas_type: CanvasType;
  title: string;
  description: string;
  confidence: number;
  priority: number;
  reason: string;
  estimated_cost: number | null;
  estimated_time: number | null;
  impact: string;
  dependencies: string[];
  actions: Array<{
    label: string;
    command_type: string;
    payload: Record<string, unknown>;
  }>;
  data: Record<string, unknown>;
  is_dismissed: boolean;
  is_accepted: boolean;
}

// ─── Canvas ────────────────────────────────────────

export interface CanvasInstance {
  id: string;
  canvas_type: CanvasType;
  lifecycle_state: CanvasLifecycleState;
  is_active: boolean;
  display_order: number;
}

// ─── Booking / Cart ────────────────────────────────

export interface BookingOrder {
  id: string;
  item_type: string;
  source_canvas: string;
  title: string;
  provider: string;
  price: number;
  currency_code: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Saved Places ──────────────────────────────────

export interface SavedPlace {
  id: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
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
