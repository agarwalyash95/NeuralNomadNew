'use client';

import { useEffect, useMemo, useState } from 'react';

import { bookingService } from '@/services/booking.service';
import { Booking, BookingSearchParams, BookingService } from '@/types/booking';
import { PaginatedResponse } from '@/types';

function normalizeBookings(data: Booking[] | PaginatedResponse<Booking>): Booking[] {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data?.results) ? data.results : [];
}

function matchesText(value: string | undefined, search: string) {
  if (!search.trim()) {
    return true;
  }

  return value?.toLowerCase().includes(search.trim().toLowerCase()) ?? false;
}

function bookingServiceName(booking: Booking): BookingService | null {
  switch (booking.booking_type) {
    case 'flight':
      return 'flight';

    case 'hotel':
      return 'hotel';

    case 'train':
      return 'train';

    case 'bus':
      return 'bus';

    case 'cab':
      return 'cab';

    default:
      return null;
  }
}

function matchesSearch(booking: Booking, params: BookingSearchParams) {
  if (bookingServiceName(booking) !== params.service) {
    return false;
  }

  if (params.service === 'hotel') {
    const cityMatch = matchesText(booking.details?.city, params.city);
    const hotelMatch = matchesText(booking.details?.hotel_name, params.destination);
    const dateMatch = !params.checkIn || booking.start_date === params.checkIn;
    return cityMatch && hotelMatch && dateMatch;
  }

  if (params.service === 'cab') {
    const pickupMatch = matchesText(
      booking.details?.pickup || booking.details?.origin,
      params.pickup
    );
    const dropMatch = matchesText(
      booking.details?.drop || booking.details?.destination,
      params.drop
    );
    const dateMatch = !params.departureDate || booking.start_date === params.departureDate;
    return pickupMatch && dropMatch && dateMatch;
  }

  const originMatch = matchesText(booking.details?.origin, params.origin);
  const destinationMatch = matchesText(booking.details?.destination, params.destination);
  const dateMatch = !params.departureDate || booking.start_date === params.departureDate;
  return originMatch && destinationMatch && dateMatch;
}

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState<BookingSearchParams | null>(null);

  async function loadBookings() {
    try {
      setLoading(true);
      setError(null);
      const data = await bookingService.getBookings();
      setBookings(normalizeBookings(data));
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load booking inventory.');
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(params: BookingSearchParams) {
    setSearching(true);
    setLastSearch(params);

    if (bookings.length === 0) {
      await loadBookings();
    }

    setSearching(false);
  }

  async function bookOption(id: string) {
    try {
      setActionBookingId(id);
      setError(null);
      const updated = await bookingService.confirmPayment(id);
      setBookings((current) => current.map((booking) => (booking.id === id ? updated : booking)));
    } catch (bookingError) {
      console.error(bookingError);
      setError('Unable to book this option.');
    } finally {
      setActionBookingId(null);
    }
  }

  async function cancelOption(id: string) {
    try {
      setActionBookingId(id);
      setError(null);
      const updated = await bookingService.cancelBooking(id);
      setBookings((current) => current.map((booking) => (booking.id === id ? updated : booking)));
    } catch (bookingError) {
      console.error(bookingError);
      setError('Unable to cancel this option.');
    } finally {
      setActionBookingId(null);
    }
  }

  const results = useMemo(() => {
    if (!lastSearch) {
      return [];
    }

    return bookings.filter((booking) => matchesSearch(booking, lastSearch));
  }, [bookings, lastSearch]);

  useEffect(() => {
    loadBookings();
  }, []);

  return {
    bookings,
    results,
    loading,
    searching,
    actionBookingId,
    error,
    lastSearch,
    runSearch,
    bookOption,
    cancelOption,
  };
}
