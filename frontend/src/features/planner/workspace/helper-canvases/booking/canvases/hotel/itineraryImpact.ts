/**
 * itineraryImpact — turns a hotel's coordinates into a real answer to
 * "how does staying here affect my planned days," instead of the generic
 * straight-line-to-search-box distance the old card showed.
 *
 * Every number here comes from real itinerary coordinates
 * (`TripContext.activeCityItems`) run through the same haversine/transit
 * estimators the Plan Canvas timeline already uses — nothing is guessed or
 * fabricated. A hotel with no coordinates, or a trip with no geo-tagged
 * stops yet, returns `null` and the UI omits the section entirely rather
 * than showing a zero.
 */
import type { TripContext } from '@/features/planner/workspace/types';
import { calculateHaversineDistanceKm, estimateTransitMins } from '@/features/planner/workspace/plan-canvas/utils/routeOptimizer';

export interface ItineraryStopImpact {
  id: string;
  title: string;
  type: string;
  dayLabel: string;
  dayNumber: number;
  distanceKm: number;
  durationMins: number;
  mode: 'walk' | 'cab';
}

export interface ItineraryImpact {
  stops: ItineraryStopImpact[];
  totalMinutes: number;
  averageMinutes: number;
  nearestStop: ItineraryStopImpact;
  farthestStop: ItineraryStopImpact;
  /** Stops reachable on foot (<= WALK_THRESHOLD_KM) */
  walkableCount: number;
}

/** Below this, a stop reads as "walk" rather than "cab" — matches the
 *  walking speed assumption already baked into estimateTransitMins. */
const WALK_THRESHOLD_KM = 1.2;

export function computeItineraryImpact(
  hotelLat: number | null | undefined,
  hotelLng: number | null | undefined,
  cityItems: TripContext['activeCityItems']
): ItineraryImpact | null {
  if (hotelLat == null || hotelLng == null || !cityItems || cityItems.length === 0) return null;

  const stops: ItineraryStopImpact[] = cityItems.map((item) => {
    const distanceKm = calculateHaversineDistanceKm(hotelLat, hotelLng, item.latitude, item.longitude);
    const mode: 'walk' | 'cab' = distanceKm <= WALK_THRESHOLD_KM ? 'walk' : 'cab';
    return {
      id: item.id,
      title: item.title,
      type: item.type,
      dayLabel: item.dayLabel,
      dayNumber: item.dayNumber,
      distanceKm,
      durationMins: estimateTransitMins(distanceKm, mode),
      mode,
    };
  });

  const sorted = [...stops].sort((a, b) => a.distanceKm - b.distanceKm);
  const totalMinutes = stops.reduce((sum, s) => sum + s.durationMins, 0);

  return {
    stops,
    totalMinutes,
    averageMinutes: Math.round(totalMinutes / stops.length),
    nearestStop: sorted[0]!,
    farthestStop: sorted[sorted.length - 1]!,
    walkableCount: stops.filter((s) => s.mode === 'walk').length,
  };
}

/** Positive = candidate saves time per stop vs. the currently-booked hotel. */
export function minutesSavedVsCurrent(
  candidate: ItineraryImpact | null,
  current: ItineraryImpact | null
): number | null {
  if (!candidate || !current) return null;
  return current.averageMinutes - candidate.averageMinutes;
}
