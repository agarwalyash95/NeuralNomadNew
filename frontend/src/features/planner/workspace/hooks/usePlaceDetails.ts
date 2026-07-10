'use client';

/**
 * usePlaceDetails — rich reference data for a plan block, keyed by its
 * place_id. Backed by GET /reference/places/details/ (Suggestion envelope).
 *
 * usePrefetchPlaceDetails warms the cache for every identifiable block as
 * soon as the plan loads (idle-time, 24h staleTime), so hovering an item
 * shows photos/hours/phone instantly instead of a skeleton.
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { referenceService } from '@/services/reference.service';
import type { ItineraryItem, Suggestion, TripViewModel } from '../plan-canvas/types';

const STALE_TIME = 24 * 60 * 60 * 1000; // reference data moves slowly

export const placeDetailsKey = (placeId: string) => ['reference', 'place-details', placeId] as const;

export function usePlaceDetails(item: ItineraryItem | null) {
  const placeId = item?.place_id ?? null;
  return useQuery<Suggestion>({
    queryKey: placeDetailsKey(placeId ?? ''),
    queryFn: () => referenceService.getPlaceDetails(placeId!, item?.type),
    enabled: Boolean(placeId),
    staleTime: STALE_TIME,
    retry: false, // pre-redesign blocks legitimately 404 — degrade quietly
  });
}

export function usePrefetchPlaceDetails(planData: TripViewModel | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!planData) return;

    const targets: { placeId: string; category: string }[] = [];
    for (const city of planData.cities) {
      for (const day of city.days) {
        for (const item of day.items) {
          if (item.place_id && !item.isInactive) {
            targets.push({ placeId: item.place_id, category: item.type });
          }
        }
      }
    }
    if (targets.length === 0) return;

    const prefetch = () => {
      targets.forEach(({ placeId, category }) => {
        queryClient.prefetchQuery({
          queryKey: placeDetailsKey(placeId),
          queryFn: () => referenceService.getPlaceDetails(placeId, category),
          staleTime: STALE_TIME,
        });
      });
    };

    // Low priority: never compete with the plan render itself
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(prefetch, { timeout: 4000 });
      return () => (window as any).cancelIdleCallback?.(handle);
    }
    const timer = setTimeout(prefetch, 1500);
    return () => clearTimeout(timer);
  }, [planData, queryClient]);
}
