import { TravelSearchResult } from '@/types/search';

export function mapSearchResultToBooking(result: TravelSearchResult, selectedProvider?: { provider: string; price: number }) {
  // Pick lowest provider price or the explicitly selected one
  const resolvedProvider =
    selectedProvider ??
    (result.providers && result.providers.length > 0
      ? [...result.providers].sort((a, b) => a.price - b.price)[0]
      : null) ?? { provider: 'Unknown', price: 0 };

  // Map service_type (from API) to booking_type (Django model)
  const bookingTypeMap: Record<string, string> = {
    flight: 'flight',
    train: 'train',
    hotel: 'hotel',
    bus: 'bus',
    cab: 'cab',
  };

  return {
    booking_type: bookingTypeMap[result.service_type] || result.service_type,
    amount: resolvedProvider.price,
    currency: 'INR',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    provider: resolvedProvider.provider,
    details: {
      title: result.title,
      code: result.code,
      origin: result.origin_city,
      destination: result.destination_city,
      departure_time: result.departure_time,
      arrival_time: result.arrival_time,
      duration: result.duration,
    },
  };
}
