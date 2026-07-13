import { apiClient } from './api';
import { Airport, City, Country, TrainStation, PaginatedResponse } from './planner.types';
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';

/**
 * Which tier actually resolved an explore fetch — mirrors the `source` field
 * apps.reference.services.places_explore.explore_places always returns.
 * 'cache' = served from our DB; 'google_places' = a live Places API call
 * just ran. Callers should show this, not discard it — see
 * contract-audit.md §5 for the loading/error standard this backs.
 */
export type ExploreSource = 'cache' | 'google_places';

export interface ExploreResult {
  results: Suggestion[];
  source: ExploreSource;
}

export const referenceService = {
  searchAirports: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<Airport> | Airport[]>(`/reference/airports/?search=${query}`);
    return Array.isArray(res) ? res : res.results;
  },
  
  searchCities: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<City> | City[]>(`/reference/cities/?search=${query}`);
    return Array.isArray(res) ? res : res.results;
  },
  
  getCountries: async () => {
    const res = await apiClient.get<PaginatedResponse<Country> | Country[]>(`/reference/countries/`);
    return Array.isArray(res) ? res : res.results;
  },

  searchCountries: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<Country> | Country[]>(`/reference/countries/?search=${query}`);
    return Array.isArray(res) ? res : res.results;
  },
  
  searchTrainStations: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<TrainStation> | TrainStation[]>(`/reference/railway-stations/?search=${query}`);
    return Array.isArray(res) ? res : res.results;
  },
  
  /**
   * Unified place resolver for plan blocks — one URL, any category.
   * Returns the same Suggestion envelope the explore endpoints use.
   */
  getPlaceDetails: async (placeId: string, category?: string): Promise<Suggestion> => {
    let url = `/reference/places/details/?place_id=${encodeURIComponent(placeId)}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;
    const res = await apiClient.get<{ data: Suggestion }>(url);
    return res.data;
  },

  exploreAll: async (location: string, lat?: number, lng?: number): Promise<{ location?: string; results: Suggestion[] }> => {
    let url = `/reference/explore-all/?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await apiClient.get<{ location?: string; results: Suggestion[] }>(url);
    return {
      location: res.location,
      results: res.results || []
    };
  },

  exploreRestaurants: async (location: string, lat?: number, lng?: number): Promise<ExploreResult> => {
    let url = `/reference/restaurants/explore/?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await apiClient.get<{ results: Suggestion[]; source: ExploreSource }>(url);
    return { results: res.results || [], source: res.source };
  },

  getRestaurantDetails: async (id: string | number): Promise<Suggestion> => {
    const res = await apiClient.get<{ data: Suggestion }>(`/reference/restaurants/${id}/details/`);
    return res.data;
  },

  exploreAttractions: async (location: string, lat?: number, lng?: number): Promise<ExploreResult> => {
    let url = `/reference/attractions/explore/?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await apiClient.get<{ results: Suggestion[]; source: ExploreSource }>(url);
    return { results: res.results || [], source: res.source };
  },

  getAttractionDetails: async (id: string | number): Promise<Suggestion> => {
    const res = await apiClient.get<{ data: Suggestion }>(`/reference/attractions/${id}/details/`);
    return res.data;
  },

  exploreActivities: async (location: string, lat?: number, lng?: number): Promise<ExploreResult> => {
    let url = `/reference/activities/explore/?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await apiClient.get<{ results: Suggestion[]; source: ExploreSource }>(url);
    return { results: res.results || [], source: res.source };
  },

  getActivityDetails: async (id: string | number): Promise<Suggestion> => {
    const res = await apiClient.get<{ data: Suggestion }>(`/reference/activities/${id}/details/`);
    return res.data;
  },

  exploreHotels: async (location: string, lat?: number, lng?: number): Promise<ExploreResult> => {
    let url = `/reference/hotels/explore/?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await apiClient.get<{ results: Suggestion[]; source: ExploreSource }>(url);
    return { results: res.results || [], source: res.source };
  },

  getHotelDetails: async (id: string | number): Promise<Suggestion> => {
    const res = await apiClient.get<{ data: Suggestion }>(`/reference/hotels/${id}/details/`);
    return res.data;
  },

  /**
   * City Briefing — weather normals, travel season, and reviewed local tips
   * for the collapsed-by-default section under CityHeaderNode. Any domain
   * with nothing on file comes back null/empty, never a placeholder.
   */
  getCityBriefing: async (cityName: string, month?: number): Promise<CityBriefing> => {
    const params = new URLSearchParams({ name: cityName });
    if (month) params.set('month', String(month));
    return apiClient.get<CityBriefing>(`/reference/city-briefing/?${params.toString()}`);
  },
};

export interface CityBriefing {
  city: string;
  country: string;
  weather: {
    month: number;
    avg_temp_c: number | null;
    precipitation_mm: number | null;
    feels_like_bucket: string | null;
    packing_note: string | null;
  } | null;
  season: {
    month: number;
    season_type: string;
    natural_phenomena: { name: string; typical_window: [string, string]; year_variability_days: number }[];
  } | null;
  local_tips: { category: string; text: string; confidence: 'verified' | 'estimated' | 'suggested' }[];
}
