/**
 * Types for the travel search module.
 *
 * These types match the shape returned by `/api/bookings/inventory/search/`.
 * The backend normalizes provider responses into this structure so the
 * frontend can keep a single contract across flights, hotels, trains, buses,
 * and cabs.
 */

export type TravelService = 'flight' | 'hotel' | 'train' | 'bus' | 'cab';

export interface ProviderOffer {
  provider: string;
  /** Price per unit: seat, room-night, or km depending on service */
  price: number;
  deeplink?: string;
}

export interface FlightClass {
  class: string;
  fare_type: string;
  price: number;
  seats_available: number;
}

export interface FlightMeta {
  cabin_classes: FlightClass[];
  baggage?: string;
  meal?: string;
}

export interface TrainClass {
  class: string;
  label: string;
  price: number;
  availability: string;
}

export interface TrainMeta {
  classes: TrainClass[];
  quotas?: string[];
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
  meta: FlightMeta & TrainMeta & HotelMeta & BusMeta & CabMeta;
  providers: ProviderOffer[];
  source?: 'live_inventory' | 'mock_inventory';
  provenance?: { source: string; label: string; is_live: boolean };
}
