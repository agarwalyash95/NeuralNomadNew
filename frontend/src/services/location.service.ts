import { apiClient } from './api';

export interface LocationSuggestion {
  id: number;
  name: string;
  city: string;
  code: string;
  location_type: string;
  country: string;
}

export const locationService = {
  async searchLocations(query: string, type: string): Promise<LocationSuggestion[]> {
    if (!query || query.length < 2) return [];
    
    // Pass the query and the type (airport, station, city, etc.)
    const params = new URLSearchParams();
    params.append('q', query);
    if (type) {
      params.append('type', type);
    }
    
    try {
      const response = await apiClient.get<LocationSuggestion[]>(
        `/bookings/locations/search/?${params.toString()}`
      );
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Error fetching locations:', error);
      return [];
    }
  },
};
