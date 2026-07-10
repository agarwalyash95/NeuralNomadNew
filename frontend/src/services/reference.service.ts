import { apiClient } from './api';
import { Airport, City, Country, TrainStation, Currency, PaginatedResponse } from './planner.types';
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';

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
  
  getCurrencies: async () => {
    const res = await apiClient.get<PaginatedResponse<Currency> | Currency[]>(`/reference/currencies/`);
    return Array.isArray(res) ? res : res.results;
  },

  searchCurrencies: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<Currency> | Currency[]>(`/reference/currencies/?search=${query}`);
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

  exploreRestaurants: async (location: string, lat?: number, lng?: number): Promise<Suggestion[]> => {
    let url = `/reference/restaurants/explore/?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await apiClient.get<{ results: Suggestion[] }>(url);
    return res.results || [];
  },

  getRestaurantDetails: async (id: string | number): Promise<Suggestion> => {
    const res = await apiClient.get<{ data: Suggestion }>(`/reference/restaurants/${id}/details/`);
    return res.data;
  },

  exploreAttractions: async (location: string, lat?: number, lng?: number): Promise<Suggestion[]> => {
    let url = `/reference/attractions/explore/?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await apiClient.get<{ results: Suggestion[] }>(url);
    return res.results || [];
  },

  getAttractionDetails: async (id: string | number): Promise<Suggestion> => {
    const res = await apiClient.get<{ data: Suggestion }>(`/reference/attractions/${id}/details/`);
    return res.data;
  },

  exploreActivities: async (location: string, lat?: number, lng?: number): Promise<Suggestion[]> => {
    let url = `/reference/activities/explore/?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await apiClient.get<{ results: Suggestion[] }>(url);
    return res.results || [];
  },

  getActivityDetails: async (id: string | number): Promise<Suggestion> => {
    const res = await apiClient.get<{ data: Suggestion }>(`/reference/activities/${id}/details/`);
    return res.data;
  },

  exploreHotels: async (location: string, lat?: number, lng?: number): Promise<Suggestion[]> => {
    let url = `/reference/hotels/explore/?location=${encodeURIComponent(location)}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    const res = await apiClient.get<{ results: Suggestion[] }>(url);
    return res.results || [];
  },

  getHotelDetails: async (id: string | number): Promise<Suggestion> => {
    const res = await apiClient.get<{ data: Suggestion }>(`/reference/hotels/${id}/details/`);
    return res.data;
  },
};
