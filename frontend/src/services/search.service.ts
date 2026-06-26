import { apiClient } from './api';
import { TravelSearchResult } from '@/types/search';
import { BookingSearchParams } from '@/types/booking';

export const searchService = {
  /**
   * Main search function.
   * Calls the Django /api/bookings/inventory/search/ endpoint.
   *
   * FUTURE API INTEGRATION:
   * To use a real third-party API (e.g., Skyscanner, Amadeus),
   * replace this function body with your API call.
   * Keep the same return type: Promise<TravelSearchResult[]>
   * The frontend components will continue to work without any changes.
   */
  async search(params: BookingSearchParams): Promise<TravelSearchResult[]> {
    const service = params.service; // singular: 'flight' | 'hotel' | 'train' | 'bus' | 'cab'

    const queryParams = new URLSearchParams();
    queryParams.append('service', service);

    // Map form fields to API query params based on service type
    if (service === 'hotel') {
      // Hotels: search by city
      if (params.city) queryParams.append('city', params.city);
    } else if (service === 'cab') {
      // Cabs: search by pickup city
      if (params.pickup) queryParams.append('pickup', params.pickup);
    } else {
      // Flights, Trains, Bus: search by origin and/or destination
      if (params.origin)      queryParams.append('origin', params.origin);
      if (params.destination) queryParams.append('destination', params.destination);
    }

    const response = await apiClient.get<TravelSearchResult[]>(
      `/bookings/inventory/search/?${queryParams.toString()}`
    );

    return Array.isArray(response) ? response : [];
  },
};
