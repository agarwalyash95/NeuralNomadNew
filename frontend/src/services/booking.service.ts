import { apiClient } from '@/services/api';
import { Booking } from '@/types/booking';
import { PaginatedResponse } from '@/types';

export interface CreateBookingRequest {
  booking_type: string;
  amount: number;
  currency: string;
  start_date: string;
  end_date?: string | null;
  details: Record<string, any>;
  provider?: string;
}

export const bookingService = {
  async getBookings(): Promise<Booking[] | PaginatedResponse<Booking>> {
    return apiClient.get('/bookings/bookings/');
  },

  /** Items booked INSIDE a generated trip (PlanBlockCommitment) never
   *  become a bookings.Booking row — this is the separate, read-only
   *  bridge (backend committed_bookings view) so "My Bookings" can show
   *  both surfaces. See docs/planner-north-star-audit-and-vision.md
   *  Phase 0e for why the two are separate systems, not merged. */
  async getCommittedBookings(): Promise<Booking[]> {
    return apiClient.get('/planner/committed-bookings/');
  },

  async createBooking(payload: CreateBookingRequest): Promise<Booking> {
    return apiClient.post('/bookings/bookings/', payload);
  },

  async confirmPayment(id: string): Promise<Booking> {
    return apiClient.post(`/bookings/bookings/${id}/confirm_payment/`, {
      payment_method: 'card',
    });
  },
  async cancelBooking(id: string): Promise<Booking> {
    return apiClient.post(`/bookings/bookings/${id}/cancel/`);
  },
};
