import { apiClient } from './api';
import { VisaInfo } from '@/types/visa';

export const visaService = {
  async getVisaData(): Promise<VisaInfo[]> {
    const response: any = await apiClient.get('/visa/visa-data/');
    return response.results !== undefined ? response.results : response;
  },

  async searchVisaByCountry(country: string): Promise<VisaInfo | VisaInfo[]> {
    const response: any = await apiClient.get(
      `/visa/visa-data/by_country/?country=${encodeURIComponent(country)}`
    );
    return response.results !== undefined ? response.results : response;
  },
};
