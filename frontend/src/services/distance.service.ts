import { apiClient } from './api';

export interface DistancePairItem {
  id: string;
  origin: {
    lat?: number;
    lng?: number;
    name?: string;
  };
  destination: {
    lat?: number;
    lng?: number;
    name?: string;
  };
}

export interface DistanceResult {
  distance_km: number;
  duration_mins: number;
  cached: boolean;
  source: string;
}

export const distanceService = {
  /**
   * Fetch batch distance metrics from backend Distance Matrix API + DB Cache.
   */
  async getBatchDistances(
    pairs: DistancePairItem[],
    mode: 'driving' | 'transit' | 'walking' = 'driving'
  ): Promise<Record<string, DistanceResult>> {
    if (!pairs || pairs.length === 0) return {};
    try {
      const resp = await apiClient.post<{ distances: Record<string, DistanceResult> }>('/planner/distances/', {
        pairs,
        mode,
      });
      return resp.distances || {};
    } catch (err) {

      console.warn('Failed to fetch batch distances from backend, using client fallback:', err);
      return {};
    }
  },
};

