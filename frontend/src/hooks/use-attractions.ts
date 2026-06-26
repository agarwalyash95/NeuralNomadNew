import { useState, useEffect, useCallback } from 'react';
import {
  attractionService,
  Attraction,
  FetchAttractionsParams,
} from '../services/attraction.service';

export function useAttractions(initialParams: FetchAttractionsParams = {}) {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);

  // We stringify the params to safely use them in the dependency array
  const paramsString = JSON.stringify(initialParams);

  const fetchAttractions = useCallback(async (params: FetchAttractionsParams, append = false) => {
    try {
      setLoading(true);
      setError(null);

      const data = await attractionService.getAttractions(params);

      setAttractions((prev) => (append ? [...prev, ...data.results] : data.results));
      setTotalCount(data.count);
      setHasNextPage(!!data.next);
    } catch (err: any) {
      console.error('Failed to fetch attractions:', err);
      setError(
        err?.response?.data?.detail ||
          err.message ||
          'An error occurred while fetching attractions.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and dependency-based re-fetches
  useEffect(() => {
    fetchAttractions(initialParams, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsString, fetchAttractions]);

  const loadMore = useCallback(
    async (currentPage: number) => {
      if (!hasNextPage || loading) return;
      const nextParams = { ...initialParams, page: currentPage + 1 };
      await fetchAttractions(nextParams, true);
    },
    [hasNextPage, loading, initialParams, fetchAttractions]
  );

  return {
    attractions,
    loading,
    error,
    totalCount,
    hasNextPage,
    loadMore,
    refresh: () => fetchAttractions(initialParams, false),
  };
}
