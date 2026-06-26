export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PlannerWorkspace {
  id: string;
  user: number;
  title: string;
  status: 'draft' | 'active' | 'completed' | 'archived' | 'booked';
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceChat {
  id: string;
  workspace: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  widgets?: ChatWidget[];
  created_at: string;
}

export interface ChatWidget {
  type: string;
  id?: string;
  label?: string;
  content?: string;
  actions?: Array<{ label: string; canvas?: string; action?: string }>;
  [key: string]: unknown;
}

export interface WorkspaceContext {
  id: string;
  workspace: string;
  origin_location: string;
  destination_location: string;
  start_date: string | null;
  end_date: string | null;
  adults: number;
  children: number;
  infants: number;
  budget: string | null;
  travel_style: string;
  interests: any[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceActivity {
  id: string;
  workspace: string;
  activity_type: string;
  description: string;
  created_at: string;
}

export interface CanvasInstance {
  id: string;
  workspace: string;
  canvas_type: 'plan' | 'flight' | 'hotel' | 'train' | 'bus' | 'cab' | 'attraction' | 'activity' | 'restaurant' | 'visa' | 'forex' | 'booking' | 'itinerary';
  is_active: boolean;
  is_visible: boolean;
  display_order: number;
  created_at: string;
}

export interface CanvasData {
  id: string;
  canvas_instance: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BookingOrder {
  id: string;
  workspace: string;
  item_type: string;
  source_canvas: 'flight' | 'hotel' | 'train' | 'bus' | 'cab' | 'attraction' | 'activity' | 'restaurant' | 'visa' | 'forex';
  title: string;
  provider: string;
  external_reference: string;
  price: string;
  currency_code: string;
  status: 'draft' | 'saved' | 'booked' | 'cancelled';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SavedPlace {
  id: string;
  workspace: string;
  google_place_id: string;
  name: string;
  category: string;
  address: string;
  latitude: string | null;
  longitude: string | null;
  rating: number | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface PlannerWorkspaceSummary extends PlannerWorkspace {
  context: WorkspaceContext;
  canvas_instances: (CanvasInstance & { data?: CanvasData | null })[];
  booking_count: number;
  saved_places_count: number;
  recent_activities: WorkspaceActivity[];
}

export interface Recommendation {
  id: string;
  workspace: string;
  category: string;
  title: string;
  description: string;
  canvas_type: string;
  priority: number;
  data: Record<string, unknown>;
  is_dismissed: boolean;
  created_at: string;
}

export interface PlannerTrip {
  id: string;
  workspace: string;
  title: string;
  summary: string;
  metadata: Record<string, unknown>;
  cities: TripCity[];
  days: TripDay[];
  routes: TripRoute[];
  created_at: string;
  updated_at: string;
}

export interface TripCity {
  id: string;
  trip: string;
  name: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  order: number;
  nights: number;
}

export interface TripDay {
  id: string;
  trip: string;
  city: string | null;
  day_number: number;
  date: string | null;
  title: string;
  activities: TripActivity[];
}

export interface TripActivity {
  id: string;
  day: string;
  title: string;
  category: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  start_time: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  travel_time_minutes: number | null;
  transport_mode: string;
  status: string;
  order: number;
  metadata: Record<string, unknown>;
}

export interface TripRoute {
  id: string;
  trip: string;
  from_activity: string | null;
  to_activity: string | null;
  distance_km: number | null;
  duration_minutes: number | null;
  transport_mode: string;
  polyline: string;
}

// Reference Models
export interface Airport {
  iata_code: string;
  icao_code: string;
  name: string;
  display_name: string;
  city_name: string;
  country_name: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

export interface City {
  id: number;
  name: string;
  country: number;
  latitude: number | null;
  longitude: number | null;
}

export interface Country {
  id: number;
  name: string;
  iso_code: string;
  currency_code: string;
}

export interface TrainStation {
  id: number;
  code: string;
  name: string;
  city: string;
  country: number;
}

export interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
}
