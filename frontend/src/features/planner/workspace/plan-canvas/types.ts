/** Where a fact came from — the product-wide trust grammar (block schema v2) */
export type ProvenanceTier = 'verified' | 'estimated' | 'suggested';

export interface CostProvenance {
  tier: ProvenanceTier;
  source?: string;
  basis?: string;
  verified_at?: string;
}

export interface BlockCost {
  amount: number | null;
  currency: string;
  provenance: CostProvenance;
}

/** Commitment ladder for a block (v2) */
export type BlockStatus = 'idea' | 'planned' | 'priced' | 'booked';

export interface ItineraryItem {
  id: string;
  type: 'flight' | 'taxi' | 'cab' | 'hotel' | 'food' | 'activity' | 'attraction' | 'train' | 'bus';
  startTime?: string;
  endTime?: string;
  title: string;
  subtitle: string;
  details?: string;
  price?: string;
  status?: 'Confirmed' | 'Pending' | 'Book Now' | 'inactive';
  /** Structured cost with provenance — source of truth over the display `price` string */
  cost?: BlockCost;
  blockStatus?: BlockStatus;
  aiTip?: string;
  aiTipStatus?: 'pending' | 'ready';
  image?: string;
  rating?: number;
  geoTag?: string;
  latitude?: number;
  longitude?: number;
  /** Google Places id — identity link to reference data (rich hover, re-verify) */
  place_id?: string | null;
  /** Real IATA/station code for the departure point — flight/train only. A
   *  missing value means no real code is known; never fabricate one by
   *  truncating a city name (that produced e.g. "MAN" for Manali, which is
   *  actually Manchester's airport code). */
  originCode?: string | null;
  /** Real IATA/station code for the arrival point — flight/train only. */
  destinationCode?: string | null;
  /** Hotel stay-span — how many of the city segment's days (starting from
   *  this block's own day) this booking covers. 1 or undefined means a
   *  single-night/unspecified stay with no continuation ribbon needed. */
  stayNights?: number;
  checkIn?: string;
  checkOut?: string;
  /** Reference master-table row this block was composed from */
  masterRef?: { table: string; id: number | string } | null;
  isInactive?: boolean;
  isDeleting?: boolean;
  /** Pre-computed backend insights (real cached candidates only) */
  _aiInsights?: any;
  _rawActivity?: any;
}

/** Precomputed leg distance stamped by plan generation, keyed `${fromId}:${toId}` */
export interface TransitHint {
  distance_km: number;
  duration_mins: number;
  source?: string;
}

export interface ItineraryDay {
  id: string;
  dayNumber: number;
  dateStr: string;
  title: string;
  items: ItineraryItem[];
  weather?: string;
  transitHints?: Record<string, TransitHint>;
}

export interface ItineraryCity {
  id: string;
  cityName: string;
  nights: number;
  dateRange: string;
  /** Only populated from real forecast data — never synthesized */
  weather?: string;
  iconBgColor: string;
  icon: string;
  days: ItineraryDay[];
  transitToNext?: ItineraryItem;
}

export interface TripViewModel {
  title: string;
  stats: string;
  /** Structured trip facts — never parse these back out of display strings */
  travelers?: number;
  budget?: { amount: number; currency: string } | null;
  startDate?: string;
  endDate?: string;
  checklist: {
    id: string;
    label: string;
    status: 'Completed' | 'Pending' | 'Book Now';
    type: string;
  }[];
  cities: ItineraryCity[];
}

/** @deprecated legacy alias — this models real backend data, use TripViewModel */
export type MockTripData = TripViewModel;

// ── Helper Canvas suggestions ────────────────────────────────────────────
/**
 * Normalized shape returned by every Google-Places-backed reference explore
 * endpoint (restaurants/attractions/activities/hotels). One shape across all
 * four categories — see backend/apps/reference/services/suggestions.py.
 */
export type SuggestionCategory = 'restaurant' | 'attraction' | 'activity' | 'hotel';

export interface SuggestionDetails {
  reviews?: any[];
  opening_hours?: string[];
  national_phone_number?: string | null;
  website_uri?: string | null;
  editorial_summary?: string | null;
  parking_options?: Record<string, any>;
  payment_options?: Record<string, any>;
  good_for_children?: boolean | null;
  good_for_groups?: boolean | null;
  wheelchair_accessible?: boolean | null;
  outdoor_seating?: boolean | null;
  allows_dogs?: boolean | null;
  menu_for_children?: boolean | null;
  serves_vegetarian_food?: boolean | null;
  dine_in?: boolean | null;
  takeout?: boolean | null;
  delivery?: boolean | null;
  guided_tour?: boolean | null;
  equipment_included?: boolean | null;
  difficulty_level?: string | null;
  star_rating?: number | null;
  price_range?: string | null;
  // Knowledge Engine K1 additions — see docs/travel-intelligence-implementation-roadmap.md §3
  reservation_policy?: 'walk_in' | 'recommended' | 'required' | null;
  typical_lead_time_days?: number | null;
  dietary_accommodations?: Record<'vegetarian' | 'vegan' | 'gluten_free' | 'halal' | 'kosher', string>;
  accessibility_detail?: {
    step_free?: boolean | null;
    terrain?: string | null;
    typical_walk_distance_m?: number | null;
    difficulty_level?: string | null;
  };
  seasonal_amenities?: { amenity: string; active_months: number[] }[];
  room_tiers?: { tier_name: string; price_premium_pct: number | null; feature_tags: string[] }[];
  // Cached AI judgment synthesis (apps.knowledge.services.enrichment) — real
  // for whatever's been enriched, absent for everything else (never faked).
  insights?: Record<string, {
    text?: string | null;
    tags?: string[];
    verdict?: string;
    name?: string;
    mention_count?: number;
    minutes?: number;
    provenance: { tier: string; basis?: string; source?: string };
  }>;
  // Approved local tips (apps.knowledge.LocalTip) — only tips that cleared
  // the human-review gate reach the frontend; see suggestions.py::_local_tips.
  local_tips?: {
    category: 'scam_warning' | 'after_dark' | 'etiquette' | 'emergency_prep' | 'safety' | 'money' | 'transport' | 'food';
    text: string;
    confidence: 'verified' | 'estimated' | 'suggested';
  }[];
  [key: string]: any;
}

export interface Suggestion {
  id: number;
  place_id: string | null;
  category: SuggestionCategory;
  name: string;
  subtitle: string;
  rating: number | null;
  ratings_count: number;
  image_url: string | null;
  secondary_images: string[];
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  duration_label: string | null;
  price_label: string | null;
  cost: BlockCost;
  details: SuggestionDetails;
}
