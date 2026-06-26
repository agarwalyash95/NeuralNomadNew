export type BookingType = 'flight' | 'hotel' | 'activity' | 'train' | 'bus' | 'cab';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
// Matches TravelService from search.ts — singular values matching the API
export type BookingService = 'flight' | 'hotel' | 'train' | 'bus' | 'cab';
export type TransportMode = 'train' | 'bus' | 'cab';

export interface BookingDetails {
  title?: string;
  service_label?: string;
  origin?: string;
  destination?: string;
  city?: string;
  hotel_name?: string;
  room_type?: string;
  traveler_name?: string;
  passenger_count?: number;
  transport_mode?: TransportMode;
  departure_time?: string;
  arrival_time?: string;
  duration?: string;
  airline?: string;
  flight_number?: string;
  class?: string;
  train_number?: string;
  train_name?: string;
  bus_type?: string;
  vehicle_type?: string;
  car_type?: string;
  from?: string;
  to?: string;
  guests?: number;
  address?: string;
  pickup?: string;
  drop?: string;
  dropoff?: string;
  notes?: string;
}

export interface ProviderOffer {
  provider: string;
  price: number;
  currency: string;

  rating?: number;

  bookingUrl?: string;

  badge?: 'Lowest' | 'Recommended' | 'Fastest';
}

export interface SearchResult {
  id: string;

  service: BookingService;

  title: string;

  origin?: string;
  destination?: string;

  departureTime?: string;
  arrivalTime?: string;

  duration?: string;

  offers: ProviderOffer[];
}

export interface Booking {
  id: string;
  user: string;
  booking_type: BookingType;
  reference_number: string;
  status: BookingStatus;
  amount: string;
  currency: string;
  booking_date: string;
  start_date: string;
  end_date: string | null;
  details: BookingDetails;
  payment_confirmed: boolean;
  payment_method: string;
  provider?: string;
  provider_booking_id?: string;
  created_at: string;
  updated_at: string;
}

export interface BookingSearchParams {
  service: BookingService;

  // Flights
  tripType: 'one-way' | 'round-trip' | 'multi-city';
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  travellers: string;
  cabinClass: string;
  fareType: string;

  // Hotels
  city: string;
  checkIn: string;
  checkOut: string;
  roomCount: string;
  nationality: string;

  // Trains
  trainClass: string;
  quota: string;

  // Cab
  cabType: 'airport' | 'outstation' | 'hourly';
  pickup: string;
  drop: string;
}
