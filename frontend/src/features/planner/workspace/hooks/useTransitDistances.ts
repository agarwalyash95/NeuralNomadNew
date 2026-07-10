'use client';

/**
 * useTransitDistances — instant distance/timing between consecutive places.
 *
 * Resolution order per pair:
 *  1. `transitHints` stamped on the day by plan generation (zero client work)
 *  2. server-resolved value (Distance Matrix / DB cache via /planner/distances/)
 *  3. client haversine estimate, shown immediately while 2 is in flight
 *
 * Pairs missing a hint are queued and fetched in one debounced batch (800 ms),
 * so drag-reorders and swaps reconcile from real road distances without a
 * request per render.
 */

import { useEffect, useRef, useState } from 'react';
import {
  distanceService,
  type DistancePairItem,
  type DistanceResult,
} from '@/services/distance.service';
import type { ItineraryItem, TripViewModel, TransitHint } from '../plan-canvas/types';
import {
  calculateHaversineDistanceKm,
  estimateTransitMins,
} from '../plan-canvas/utils/routeOptimizer';

export interface TransitEstimate {
  distanceKm: number;
  durationMins: number;
  source: 'hint' | 'server' | 'haversine';
}

const hasCoords = (i: ItineraryItem) =>
  typeof i.latitude === 'number' && typeof i.longitude === 'number';

// Coordinate-based key: a pair keeps its resolved distance across reorders
// and id churn as long as the two places themselves don't move.
const coordKey = (from: ItineraryItem, to: ItineraryItem) =>
  `${from.latitude!.toFixed(4)},${from.longitude!.toFixed(4)}>` +
  `${to.latitude!.toFixed(4)},${to.longitude!.toFixed(4)}`;

export function useTransitDistances(planData: TripViewModel | null) {
  const [resolved, setResolved] = useState<Record<string, DistanceResult>>({});
  const queueRef = useRef<Map<string, DistancePairItem>>(new Map());
  const inFlightRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!planData) return;

    for (const city of planData.cities) {
      for (const day of city.days) {
        const items = day.items.filter((i) => !i.isInactive && hasCoords(i));
        for (let i = 0; i < items.length - 1; i++) {
          const a = items[i]!;
          const b = items[i + 1]!;
          if (day.transitHints?.[`${a.id}:${b.id}`]) continue;
          const key = coordKey(a, b);
          if (resolved[key] || inFlightRef.current.has(key) || queueRef.current.has(key)) continue;
          queueRef.current.set(key, {
            id: key,
            origin: { lat: a.latitude, lng: a.longitude, name: a.title },
            destination: { lat: b.latitude, lng: b.longitude, name: b.title },
          });
        }
      }
    }

    if (queueRef.current.size === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const batch = Array.from(queueRef.current.values());
      queueRef.current.clear();
      batch.forEach((p) => inFlightRef.current.add(p.id));
      const res = await distanceService.getBatchDistances(batch);
      batch.forEach((p) => inFlightRef.current.delete(p.id));
      if (Object.keys(res).length > 0) {
        setResolved((prev) => ({ ...prev, ...res }));
      }
    }, 800);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [planData, resolved]);

  const getTransit = (
    from: ItineraryItem,
    to: ItineraryItem,
    hints?: Record<string, TransitHint>
  ): TransitEstimate => {
    const hint = hints?.[`${from.id}:${to.id}`];
    if (hint) {
      return { distanceKm: hint.distance_km, durationMins: hint.duration_mins, source: 'hint' };
    }
    if (hasCoords(from) && hasCoords(to)) {
      const r = resolved[coordKey(from, to)];
      if (r) {
        return { distanceKm: r.distance_km, durationMins: r.duration_mins, source: 'server' };
      }
    }
    const dist = calculateHaversineDistanceKm(
      from.latitude,
      from.longitude,
      to.latitude,
      to.longitude,
      from,
      to
    );
    return { distanceKm: dist, durationMins: estimateTransitMins(dist), source: 'haversine' };
  };

  return { getTransit };
}
