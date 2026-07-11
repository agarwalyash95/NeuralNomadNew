import { useState, useCallback } from 'react';
import { referenceService } from '@/services/reference.service';
import type { Suggestion, SuggestionCategory } from '@/features/planner/workspace/plan-canvas/types';

export function useExploreDetails() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Suggestion | null>(null);
  const [source, setSource] = useState<string>('');

  const fetchDetails = useCallback(async (id: string | number, category: SuggestionCategory) => {
    if (!id || !category) return;
    
    setLoading(true);
    setError(null);
    setDetails(null);
    
    try {
      let data: Suggestion;
      if (category === 'restaurant') {
        data = await referenceService.getRestaurantDetails(id);
      } else if (category === 'attraction') {
        data = await referenceService.getAttractionDetails(id);
      } else if (category === 'activity') {
        data = await referenceService.getActivityDetails(id);
      } else if (category === 'hotel') {
        data = await referenceService.getHotelDetails(id);
      } else {
        throw new Error(`Unsupported category: ${category}`);
      }
      setDetails(data);
      setSource('reference_service');
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
