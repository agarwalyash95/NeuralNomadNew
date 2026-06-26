import { apiClient } from './api';

export const savedPlaceService = {
  async getSavedPlaces() {
    return apiClient.get('/planner/saved-places/');
  },

  async createSavedPlace(data: any) {
    return apiClient.post('/planner/saved-places/', data);
  },

  async getByCountry() {
    return apiClient.get('/planner/saved-places/by_country/');
  },
};
