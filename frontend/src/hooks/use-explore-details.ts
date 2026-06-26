import { useState, useCallback } from 'react';
import { attractionService, Attraction } from '@/services/attraction.service';

export function useExploreDetails() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Attraction | null>(null);
  const [source, setSource] = useState<string>('');

  const fetchDetails = useCallback(async (id: string | number) => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    setDetails(null);
    
    try {
      const response = await attractionService.getDetails(id);
      setDetails(response.data);
      setSource(response.source || '');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch details');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    details,
    source,
    fetchDetails
  };
}
