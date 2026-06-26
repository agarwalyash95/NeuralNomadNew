/**
 * Types for the Search Travel module.
 *
 * FUTURE API INTEGRATION NOTE:
 * These types match the shape returned by /api/bookings/inventory/search/
 * When you plug in a real third-party API, the backend view normalises
 * the external response into this same shape — the frontend never changes.
 * Matches the service_type values returned by the Django SearchInventory API
 */

export type TravelService = 'flight' | 'hotel' | 'train' | 'bus' | 'cab';

// ── Shared ───────────────────────────────────────────────────────────────────

export interface ProviderOffer {
  provider: string;
  /** Price per unit (per seat for flights/trains/bus, per night for hotels, per km for cabs) */
  price: number;
  deeplink?: string;
}

// ── Service-specific meta shapes ─────────────────────────────────────────────

export interface FlightClass {
  class: string;        // Economy, Business, First
  fare_type: string;    // Regular, Flexi, SpiceMax...
  price: number;
  seats_available: number;
}

export interface FlightMeta {
  cabin_classes: FlightClass[];
  baggage?: string;
  meal?: string;
}

export interface TrainClass {
  class: string;          // SL, 3A, 2A, 1A, CC, EC
  label: string;          // Sleeper Class, AC 3-Tier...
  price: number;
  availability: string;   // AVAILABLE-142, WL/12, RAC-4
}

export interface TrainMeta {
  classes: TrainClass[];
  quotas?: string[];      // GN, TQ, LD, HP
  pantry?: boolean;
}

export interface HotelRoom {
  type: string;
  price_per_night: number;
  max_guests: number;
}

export interface HotelMeta {
  star_rating: number;
  address?: string;
  amenities?: string[];
  rooms: HotelRoom[];
}

export interface BusSeat {
  type: string;
  price: number;
  seats_available: number;
}

export interface BusMeta {
  bus_type?: string;
  seats: BusSeat[];
}

export interface CabType {
  type: string;
  price_per_km: number;
  base_fare: number;
  max_seats: number;
}

export interface CabMeta {
  cab_types: CabType[];
}

export type ServiceMeta = FlightMeta | TrainMeta | HotelMeta | BusMeta | CabMeta;

// ── Main result shape returned by the API ────────────────────────────────────

export interface TravelSearchResult {
  id: string;
  service_type: TravelService;
  title: string;
  code: string;

  origin_city: string;
  destination_city: string;
  origin_code: string;
  destination_code: string;

  departure_time: string;
  arrival_time: string;
  duration: string;
  days_of_week: string[];
  stops: number;

  // Service-specific data (cabin classes, train classes, hotel rooms, etc.)
  meta: FlightMeta & TrainMeta & HotelMeta & BusMeta & CabMeta;

  // OTA price comparison (empty for trains)
  providers: ProviderOffer[];
}
