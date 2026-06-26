import { apiClient } from './api';
import { Trip, CreateTripRequest } from '@/types/trip';

export const tripService = {
  async getTrips(): Promise<Trip[]> {
    return apiClient.get('/planner/trips/');
  },

  async getTrip(id: string): Promise<Trip> {
    return apiClient.get(`/planner/trips/${id}/`);
  },

  async createTrip(data: CreateTripRequest): Promise<Trip> {
    return apiClient.post('/planner/trips/', data);
  },

  async updateTrip(id: string, data: Partial<Trip>): Promise<Trip> {
    return apiClient.put(`/planner/trips/${id}/`, data);
  },

  async deleteTrip(id: string) {
    return apiClient.delete(`/planner/trips/${id}/`);
  },

  async getUpcomingTrips(): Promise<Trip[]> {
    return apiClient.get('/planner/trips/upcoming/');
  },

  async getPastTrips(): Promise<Trip[]> {
    return apiClient.get('/planner/trips/past/');
  },
};
