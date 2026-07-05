import { referenceService } from '@/services/reference.service';

/**
 * In-memory background pre-fetch cache for workspace destination options.
 */
interface PrefetchCache {
  restaurants: any[];
  attractions: any[];
  activities: any[];
  destination: string;
  isPrefetched: boolean;
}

const prefetchCache: PrefetchCache = {
  restaurants: [],
  attractions: [],
  activities: [],
  destination: '',
  isPrefetched: false,
};

/**
 * Pre-fetch destination restaurants/attractions/activities options in the background
 * immediately when the PlannerWorkspace mounts.
 */
export async function prefetchWorkspaceData(destination: string) {
  if (!destination || prefetchCache.destination === destination) return;

  prefetchCache.destination = destination;
  prefetchCache.isPrefetched = false;

  try {
    const [restaurants, attractions, activities] = await Promise.allSettled([
      referenceService.exploreRestaurants(destination),
      referenceService.exploreAttractions(destination),
      referenceService.exploreActivities(destination),
    ]);

    if (restaurants.status === 'fulfilled') prefetchCache.restaurants = restaurants.value || [];
    if (attractions.status === 'fulfilled') prefetchCache.attractions = attractions.value || [];
    if (activities.status === 'fulfilled') prefetchCache.activities = activities.value || [];

    prefetchCache.isPrefetched = true;
  } catch (err) {
    console.warn('Background prefetch completed with partial results:', err);
  }
}

export function getPrefetchedData() {
  return prefetchCache;
}

