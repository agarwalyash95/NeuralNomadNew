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
