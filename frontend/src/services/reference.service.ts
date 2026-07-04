import { apiClient } from './api';
import { Airport, City, Country, TrainStation, Currency, PaginatedResponse } from './planner.types';

export const referenceService = {
  searchAirports: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<Airport> | Airport[]>(`/reference/airports/?search=${query}`);
    return Array.isArray(res) ? res : res.results;
  },
  
  searchCities: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<City> | City[]>(`/reference/cities/?search=${query}`);
    return Array.isArray(res) ? res : res.results;
  },
  
  getCountries: async () => {
    const res = await apiClient.get<PaginatedResponse<Country> | Country[]>(`/reference/countries/`);
    return Array.isArray(res) ? res : res.results;
  },

  searchCountries: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<Country> | Country[]>(`/reference/countries/?search=${query}`);
    return Array.isArray(res) ? res : res.results;
  },
  
  searchTrainStations: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<TrainStation> | TrainStation[]>(`/reference/railway-stations/?search=${query}`);
    return Array.isArray(res) ? res : res.results;
  },
  
  getCurrencies: async () => {
    const res = await apiClient.get<PaginatedResponse<Currency> | Currency[]>(`/reference/currencies/`);
    return Array.isArray(res) ? res : res.results;
  },

  searchCurrencies: async (query: string) => {
    const res = await apiClient.get<PaginatedResponse<Currency> | Currency[]>(`/reference/currencies/?search=${query}`);
    return Array.isArray(res) ? res : res.results;
  },
};
