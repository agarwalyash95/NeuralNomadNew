import { apiClient } from './api';
import {
  ForexRate,
  ForexVendor,
  ForexDeliveryRequest,
  CreateDeliveryRequestPayload,
} from '@/types/forex';

export const forexService = {
  // ── Rates ──────────────────────────────────────────────────────────────────
  async getRates(): Promise<ForexRate[]> {
    return apiClient.get('/forex/forex-rates/all_rates/');
  },

  async getCurrency(currency: string): Promise<ForexRate> {
    return apiClient.get(`/forex/forex-rates/by_currency/?currency=${currency}`);
  },

  async convert(from: string, to: string, amount: number): Promise<{
    from_currency: string;
    to_currency: string;
    amount: string;
    converted_amount: number;
    rate: number;
  }> {
    return apiClient.get(
      `/forex/forex-rates/convert/?from=${from}&to=${to}&amount=${amount}`
    );
  },

  // ── Vendors ────────────────────────────────────────────────────────────────
  async getVendors(currency?: string): Promise<ForexVendor[]> {
    const query = currency ? `?currency=${currency}` : '';
    const response: any = await apiClient.get(`/forex/forex-vendors/${query}`);
    return response.results !== undefined ? response.results : response;
  },

  // ── Delivery / Pickup Requests ─────────────────────────────────────────────
  async getMyRequests(): Promise<ForexDeliveryRequest[]> {
    const response: any = await apiClient.get('/forex/delivery-requests/');
    return response.results !== undefined ? response.results : response;
  },

  async createDeliveryRequest(
    data: CreateDeliveryRequestPayload
  ): Promise<ForexDeliveryRequest> {
    return apiClient.post('/forex/delivery-requests/', data);
  },
};
