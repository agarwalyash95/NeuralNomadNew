export interface Trip {
  id: string;
  destination: string;
  destination_country?: string;
  destination_city?: string;

  start_date: string;
  end_date: string;

  budget: number;
  estimated_budget: number;
  actual_budget: number;

  status: 'planning' | 'booked' | 'ongoing' | 'completed' | 'cancelled';

  trip_type: 'leisure' | 'business' | 'adventure' | 'cultural';

  description?: string;
  cover_image?: string;

  created_at: string;
  updated_at: string;
}

export interface CreateTripRequest {
  destination: string;
  destination_country?: string;
  destination_city?: string;

  start_date: string;
  end_date: string;

  budget: number;

  trip_type: string;

  description?: string;
}
