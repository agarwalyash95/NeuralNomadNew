import { useQuery } from '@tanstack/react-query';
import { referenceService } from '../services/reference.service';

export const referenceKeys = {
  all: ['reference'] as const,
  airports: (query: string) => [...referenceKeys.all, 'airports', query] as const,
  cities: (query: string) => [...referenceKeys.all, 'cities', query] as const,
  countriesList: () => [...referenceKeys.all, 'countries', 'list'] as const,
  countriesSearch: (query: string) => [...referenceKeys.all, 'countries', 'search', query] as const,
  trainStations: (query: string) => [...referenceKeys.all, 'trainStations', query] as const,
  currenciesList: () => [...referenceKeys.all, 'currencies', 'list'] as const,
  currenciesSearch: (query: string) => [...referenceKeys.all, 'currencies', 'search', query] as const,
};

export function useAirports(query: string) {
  return useQuery({
    queryKey: referenceKeys.airports(query),
    queryFn: () => referenceService.searchAirports(query),
    enabled: query.length > 1,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function useCities(query: string) {
  return useQuery({
    queryKey: referenceKeys.cities(query),
    queryFn: () => referenceService.searchCities(query),
    enabled: query.length > 1,
    staleTime: 1000 * 60 * 60,
  });
}

export function useCountries() {
  return useQuery({
    queryKey: referenceKeys.countriesList(),
    queryFn: () => referenceService.getCountries(),
    staleTime: 1000 * 60 * 60,
  });
}

export function useCountrySearch(query: string) {
  return useQuery({
    queryKey: referenceKeys.countriesSearch(query),
    queryFn: () => referenceService.searchCountries(query),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 60,
  });
}

export function useTrainStations(query: string) {
  return useQuery({
    queryKey: referenceKeys.trainStations(query),
    queryFn: () => referenceService.searchTrainStations(query),
    enabled: query.length > 1,
    staleTime: 1000 * 60 * 60,
  });
}

export function useCurrencies() {
  return useQuery({
    queryKey: referenceKeys.currenciesList(),
    queryFn: () => referenceService.getCurrencies(),
    staleTime: 1000 * 60 * 60,
  });
}

export function useCurrencySearch(query: string) {
  return useQuery({
    queryKey: referenceKeys.currenciesSearch(query),
    queryFn: () => referenceService.searchCurrencies(query),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 60,
  });
}
