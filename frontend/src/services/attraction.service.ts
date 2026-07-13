import { apiClient } from './api';

export interface Destination {
  id: number;
  city: string;
  country: string;
  description: string;
  popularity_score: number;
  best_time_to_visit: string;
  currency: string;
  timezone: string;
}

export interface Attraction {
  id: number;
  destination: Destination;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  category: string;
  rating: number;
  review_count: number;
  opening_hours: Record<string, string> | null;
  ticket_price: number;
  image_url: string;
  is_featured: boolean;
  
  // Deep Details
  editorial_summary?: string;
  business_status?: string;
  website?: string;
  google_maps_url?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  wheelchair_accessible_entrance?: boolean;
  reservable?: boolean;
  serves_beer?: boolean;
  serves_wine?: boolean;
  serves_vegetarian_food?: boolean;
  dine_in?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  secondary_images?: string[];
  reviews?: any[];
  ticket_info?: any;
  estimated_duration?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface FetchAttractionsParams {
  page?: number;
  search?: string;
  category?: string;
  destination?: number;
  is_featured?: boolean;
}

export const attractionService = {
  async getAttraction(id: string | number) {
    // apiClient.get already unwraps and returns response.data
    return await apiClient.get<Attraction>(`/attractions/items/${id}/`);
  },

  async getDestinations(params?: { search?: string; page?: number }) {
    return await apiClient.get<PaginatedResponse<Destination>>('/attractions/destinations/', {
      params,
    });
  },

  async getAttractions(params?: FetchAttractionsParams) {
    return await apiClient.get<PaginatedResponse<Attraction>>('/attractions/items/', { params });
  },

  async getPopular() {
    return await apiClient.get<Attraction[]>('/attractions/items/popular/');
  },

  async getCategories() {
    return await apiClient.get<string[]>('/attractions/items/categories/');
  },

  async autocomplete(query: string) {
    if (!query) return { predictions: [] };
    return await apiClient.get<any>(`/attractions/items/autocomplete/?q=${encodeURIComponent(query)}`);
  },

  async explore(location?: string, lat?: number, lng?: number): Promise<{ source: string, results: Attraction[] }> {
    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (lat !== undefined && lng !== undefined) {
      params.append('lat', lat.toString());
      params.append('lng', lng.toString());
    }
    return await apiClient.get<{source: string, results: Attraction[]}>(`/attractions/items/explore/?${params.toString()}`);
  },

  async getDetails(id: string | number) {
    return await apiClient.get<{source: string, data: Attraction}>(`/attractions/items/${id}/details/`);
  },
};
