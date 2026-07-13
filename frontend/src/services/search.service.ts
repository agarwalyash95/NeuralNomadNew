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

    if (params.origin) queryParams.append('origin', params.origin);
    if (params.destination) queryParams.append('destination', params.destination);
    if (params.city) queryParams.append('city', params.city);
    if (params.pickup) queryParams.append('pickup', params.pickup);
    if (params.drop) queryParams.append('drop', params.drop);
    if (params.departureDate) queryParams.append('departureDate', params.departureDate);
    if (params.returnDate) queryParams.append('returnDate', params.returnDate);
    if (params.checkIn) queryParams.append('checkIn', params.checkIn);
    if (params.checkOut) queryParams.append('checkOut', params.checkOut);
    if (params.travellers) queryParams.append('travellers', params.travellers);
    if (params.cabinClass) queryParams.append('cabinClass', params.cabinClass);
    if (params.roomCount) queryParams.append('roomCount', params.roomCount);
    if (params.cabType) queryParams.append('cabType', params.cabType);

    // Errors propagate to the caller — swallowing them to `[]` here made a
    // failed search indistinguishable from a real "no inventory" result
    // (design-system-spec.md §8). Canvases decide how to render a failure.
    const response = await apiClient.get<TravelSearchResult[]>(
      `/bookings/inventory/search/?${queryParams.toString()}`
    );
    return Array.isArray(response) ? response : [];
  },
};
