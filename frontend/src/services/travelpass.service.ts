import axios from 'axios';
import { TravelPass, CreateTravelPassRequest } from '@/types/travelpass';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const travelPassService = {
  /**
   * List all travel passes for the authenticated user.
   * Optionally filter by document type or trip.
   */
  async getPasses(filters?: { type?: string; trip?: string }): Promise<TravelPass[]> {
    const params = new URLSearchParams();
    if (filters?.type) params.set('type', filters.type);
    if (filters?.trip) params.set('trip', filters.trip);

    const res = await axios.get<any>(
      `${API_BASE}/travelpass/travel-passes/${params.toString() ? '?' + params : ''}`,
      { headers: getAuthHeaders() }
    );
    return res.data.results !== undefined ? res.data.results : res.data;
  },

  /**
   * Get summary statistics for the user's documents.
   */
  async getSummary(): Promise<{ total: number; active: number; upcoming: number; by_type: Record<string, number> }> {
    const res = await axios.get(
      `${API_BASE}/travelpass/travel-passes/summary/`,
      { headers: getAuthHeaders() }
    );
    return res.data;
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

    const res = await axios.post<TravelPass>(
      `${API_BASE}/travelpass/travel-passes/`,
      formData,
      {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data;
  },

  /**
   * Delete a travel pass by ID.
   */
  async deletePass(id: string): Promise<void> {
    await axios.delete(`${API_BASE}/travelpass/travel-passes/${id}/`, {
      headers: getAuthHeaders(),
    });
  },
};
