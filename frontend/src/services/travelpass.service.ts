import { apiClient } from './api';
import { TravelPass, CreateTravelPassRequest } from '@/types/travelpass';

export const travelPassService = {
  /**
   * List all travel passes for the authenticated user.
   * Optionally filter by document type or trip.
   */
  async getPasses(filters?: { type?: string; trip?: string }): Promise<TravelPass[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.trip) params.set('trip', filters.trip);

    const url = `/travelpass/travel-passes/${params.toString() ? '?' + params : ''}`;
    const res = await apiClient.get<any>(url);
    return res.results !== undefined ? res.results : res;
  },

  /**
   * Get summary statistics for the user's documents.
   */
  async getSummary(): Promise<{ total: number; active: number; upcoming: number; by_type: Record<string, number> }> {
    return apiClient.get('/travelpass/travel-passes/summary/');
  },

  /**
   * Create a new travel pass. If a file is provided, sends as multipart/form-data.
   */
  async createPass(data: CreateTravelPassRequest): Promise<TravelPass> {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('document_type', data.document_type);
    if (data.trip) formData.append('trip', data.trip);
    if (data.description) formData.append('description', data.description);
    if (data.origin) formData.append('origin', data.origin);
    if (data.destination) formData.append('destination', data.destination);
    if (data.valid_from) formData.append('valid_from', data.valid_from);
    if (data.valid_until) formData.append('valid_until', data.valid_until);
    if (data.status) formData.append('status', data.status);
    if (data.issuer) formData.append('issuer', data.issuer);
    if (data.seat_info) formData.append('seat_info', data.seat_info);
    if (data.document_file) formData.append('document_path', data.document_file);

    return apiClient.post<TravelPass>(
      '/travelpass/travel-passes/',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
  },

  /**
   * Delete a travel pass by ID.
   */
  async deletePass(id: string): Promise<void> {
    return apiClient.delete(`/travelpass/travel-passes/${id}/`);
  },
};
