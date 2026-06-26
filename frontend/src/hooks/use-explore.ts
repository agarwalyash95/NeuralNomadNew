import { useState, useCallback } from 'react';
import { attractionService, Attraction } from '@/services/attraction.service';

export function useExplore() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Attraction[]>([]);
  const [source, setSource] = useState<string>('');

  const exploreLocation = useCallback(async (location?: string, lat?: number, lng?: number) => {
    if (!location && (lat === undefined || lng === undefined)) return;
    
    setLoading(true);
    setError(null);
    setPlaces([]);
    
    try {
      const response = await attractionService.explore(location, lat, lng);
      setPlaces(response.results || []);
      setSource(response.source || '');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch places');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    places,
    source,
    exploreLocation
  };
}
