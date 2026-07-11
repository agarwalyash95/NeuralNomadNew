import { useState, useCallback } from 'react';
import { referenceService } from '@/services/reference.service';
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';

export function useExplore() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Suggestion[]>([]);
  const [source, setSource] = useState<string>('');
  const [resolvedLocation, setResolvedLocation] = useState<string>('');

  const exploreLocation = useCallback(async (location?: string, lat?: number, lng?: number) => {
    if (!location && (lat === undefined || lng === undefined)) return;
    
    setLoading(true);
    setError(null);
    setPlaces([]);
    setResolvedLocation('');
    
    try {
      // If we don't have location but have coordinates, we could reverse geocode or handle it.
      // But exploreAll expects location string. If not provided, we can pass fallback or let it resolve.
      const searchLoc = location || '';
      const response = await referenceService.exploreAll(searchLoc, lat, lng);
      setPlaces(response.results || []);
      if (response.location) {
        setResolvedLocation(response.location);
      }
      setSource('reference_service');
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
    resolvedLocation,
    exploreLocation
  };
}
