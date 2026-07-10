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
  type: 'flight' | 'taxi' | 'hotel' | 'food' | 'activity' | 'attraction' | 'train' | 'bus';
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
  image?: string;
  rating?: number;
  geoTag?: string;
  distanceToNext?: string;
  latitude?: number;
  longitude?: number;
  /** Google Places id — identity link to reference data (rich hover, re-verify) */
  place_id?: string | null;
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
