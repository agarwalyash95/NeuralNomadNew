import { ItineraryDay, ItineraryItem } from '../types';

export interface RouteOptimizationResult {
  day: ItineraryDay;
  totalDistanceKm: number;
  totalTravelMins: number;
  savedKm: number;
  savedMins: number;
}

export interface SlotRecommendationResult {
  isOptimal: boolean;
  recommendedIndex: number;
  currentDistanceKm: number;
  recommendedDistanceKm: number;
  savedTravelMins: number;
  reasonText: string;
}

/**
 * Checks if two itinerary items are at the same location or represent connected transit (e.g. station -> cab pickup at station)
 */
export function isSameLocation(item1?: ItineraryItem | null, item2?: ItineraryItem | null): boolean {
  if (!item1 || !item2) return false;
  if (item1.id === item2.id) return true;

  const t1 = ((item1.title || '') + ' ' + (item1.subtitle || '') + ' ' + ((item1 as any).location_name || '')).toLowerCase();
  const t2 = ((item2.title || '') + ' ' + (item2.subtitle || '') + ' ' + ((item2 as any).location_name || '')).toLowerCase();

  // Connected station/airport cab transition check
  const isTransitConn = (item1.type === 'train' || item1.type === 'flight' || item1.type === 'bus') &&
                        (item2.type === 'taxi' || t2.includes('pickup') || t2.includes('cab'));
  
  if (isTransitConn) {
    // If station name or location is mentioned in both
    const words1 = t1.split(/\s+/).filter(w => w.length > 3);
    for (const w of words1) {
      if (t2.includes(w)) return true;
    }
  }

  // Exact title/subtitle match — guard against blocks with no title rather
  // than crash; two blank titles are not "the same location"
  if (item1.title && item2.title && item1.title.toLowerCase().trim() === item2.title.toLowerCase().trim()) return true;

  return false;
}


/**
 * Calculates Great-Circle distance in kilometers between two lat/lng coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1?: number,
  lon1?: number,
  lat2?: number,
  lon2?: number,
  item1?: ItineraryItem | null,
  item2?: ItineraryItem | null
): number {
  if (isSameLocation(item1, item2)) return 0;

  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return 0; // Return 0 instead of fake 3.5 km fallback
  }

  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371.0; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = Math.round(R * c * 10) / 10;
  return dist < 0.3 ? 0 : dist;
}


/**
 * Estimates driving/transit duration in minutes based on distance in km.
 */
export function estimateTransitMins(distanceKm: number, type?: string): number {
  const speedKmh = type === 'walk' ? 4.5 : 28.0; // Average urban mountain driving speed
  const mins = Math.round((distanceKm / speedKmh) * 60);
  return Math.max(mins, 5); // Minimum 5 minutes transit time
}

/**
 * Dynamic Timing Cascade: Recalculates start and end times for all items on a day
 * taking into account transit durations between consecutive spots.
 */
export function recalculateDayTimings(day: ItineraryDay): ItineraryDay {
  const updatedDay: ItineraryDay = JSON.parse(JSON.stringify(day));
  if (updatedDay.items.length === 0) return updatedDay;

  let currentTotalMinutes = 9 * 60; // Default start at 9:00 AM (540 mins)

  updatedDay.items.forEach((item, index) => {
    // Parse existing start time if present
    if (index === 0 && item.startTime) {
      const match = item.startTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (match && match[1] && match[2]) {
        let hrs = parseInt(match[1], 10);
        const mins = parseInt(match[2], 10);
        const ampm = match[3]?.toUpperCase();
        if (ampm === 'PM' && hrs < 12) hrs += 12;
        if (ampm === 'AM' && hrs === 12) hrs = 0;
        currentTotalMinutes = hrs * 60 + mins;
      }
    }

    const activityDuration = 90;
    const endMinutes = currentTotalMinutes + activityDuration;

    const formatTime = (totalMins: number) => {
      const h24 = Math.floor(totalMins / 60) % 24;
      const m = totalMins % 60;
      const ampm = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    item.startTime = formatTime(currentTotalMinutes);
    item.endTime = formatTime(endMinutes);

    // Calculate transit to next item if present
    if (index < updatedDay.items.length - 1) {
      const nextItem = updatedDay.items[index + 1];
      if (nextItem) {
        const dist = calculateHaversineDistanceKm(
          item.latitude,
          item.longitude,
          nextItem.latitude,
          nextItem.longitude
        );
        const transitMins = estimateTransitMins(dist);

        (item as any)._calculatedTransitToNext = {
          distanceKm: dist,
          durationMins: transitMins,
        };

        currentTotalMinutes = endMinutes + transitMins;
      }
    }
  });

  return updatedDay;
}

/**
 * Calculates total route travel distance and duration for a given order of items.
 */
export function calculateRouteStats(items: ItineraryItem[]): { totalKm: number; totalMins: number } {
  let totalKm = 0;
  let totalMins = 0;

  for (let i = 0; i < items.length - 1; i++) {
    const cur = items[i];
    const nxt = items[i + 1];
    if (cur && nxt) {
      const dist = calculateHaversineDistanceKm(cur.latitude, cur.longitude, nxt.latitude, nxt.longitude);
      const mins = estimateTransitMins(dist);
      totalKm += dist;
      totalMins += mins;
    }
  }

  return {
    totalKm: Math.round(totalKm * 10) / 10,
    totalMins: Math.round(totalMins),
  };
}

/**
 * Smart Position Recommendation: Checks if placing `newItem` at `targetIndex`
 * causes significant backtracking and recommends the optimal index if so.
 */
export function recommendOptimalSlot(
  newItem: ItineraryItem,
  day: ItineraryDay,
  targetIndex: number
): SlotRecommendationResult {
  const items = [...day.items];
  const activeItems = items.filter(i => !i.isInactive);

  if (activeItems.length <= 1) {
    return {
      isOptimal: true,
      recommendedIndex: targetIndex,
      currentDistanceKm: 0,
      recommendedDistanceKm: 0,
      savedTravelMins: 0,
      reasonText: 'Initial spot on this day.',
    };
  }

  // Calculate total route distance if placed at targetIndex
  const testCurrent = [...activeItems];
  testCurrent.splice(Math.min(targetIndex, testCurrent.length), 0, newItem);
  const currentStats = calculateRouteStats(testCurrent);

  // Test all possible positions
  let bestIdx = targetIndex;
  let minDistance = currentStats.totalKm;

  for (let i = 0; i <= activeItems.length; i++) {
    const testCandidate = [...activeItems];
    testCandidate.splice(i, 0, newItem);
    const candidateStats = calculateRouteStats(testCandidate);

    if (candidateStats.totalKm < minDistance) {
      minDistance = candidateStats.totalKm;
      bestIdx = i;
    }
  }

  const distanceDiff = currentStats.totalKm - minDistance;
  const minsDiff = estimateTransitMins(distanceDiff);

  if (distanceDiff >= 3.0 && bestIdx !== targetIndex) {
    const nearbyItem = activeItems[Math.max(0, bestIdx - 1)];
    const nearbyName = nearbyItem ? nearbyItem.title : 'adjacent spots';
    return {
      isOptimal: false,
      recommendedIndex: bestIdx,
      currentDistanceKm: currentStats.totalKm,
      recommendedDistanceKm: minDistance,
      savedTravelMins: minsDiff,
      reasonText: `"${newItem.title}" is located closer to ${nearbyName}. Placing it at slot ${bestIdx + 1} saves ${distanceDiff.toFixed(1)} km (~${minsDiff} mins) of travel time.`,
    };
  }

  return {
    isOptimal: true,
    recommendedIndex: targetIndex,
    currentDistanceKm: currentStats.totalKm,
    recommendedDistanceKm: currentStats.totalKm,
    savedTravelMins: 0,
    reasonText: 'Position is geographically optimal.',
  };
}

/**
 * 1-Click Route Optimizer: Sorts day items using Nearest-Neighbor heuristic
 * to minimize total travel distance and eliminate backtracking.
 */
export function optimizeDayRoute(day: ItineraryDay): RouteOptimizationResult {
  const originalStats = calculateRouteStats(day.items);
  const items = [...day.items];

  if (items.length <= 2) {
    return {
      day: recalculateDayTimings(day),
      totalDistanceKm: originalStats.totalKm,
      totalTravelMins: originalStats.totalMins,
      savedKm: 0,
      savedMins: 0,
    };
  }

  // 1. Identify the indices and items of the optimizable categories (attraction, activity)
  const optimizableIndices: number[] = [];
  const optimizableItems: ItineraryItem[] = [];

  items.forEach((item, index) => {
    if (item.type === 'attraction' || item.type === 'activity') {
      optimizableIndices.push(index);
      optimizableItems.push(item);
    }
  });

  // If there are less than 2 optimizable items, optimization is a no-op
  if (optimizableItems.length <= 1) {
    return {
      day: recalculateDayTimings(day),
      totalDistanceKm: originalStats.totalKm,
      totalTravelMins: originalStats.totalMins,
      savedKm: 0,
      savedMins: 0,
    };
  }

  // Helper to generate all permutations
  function getPermutations<T>(arr: T[]): T[][] {
    if (arr.length === 0) return [[]];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i] as T;
      const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
      const remainingPerms = getPermutations(remaining);
      for (const perm of remainingPerms) {
        result.push([current, ...perm]);
      }
    }
    return result;
  }

  let bestItemsOrder = [...optimizableItems];
  let minDistance = originalStats.totalKm;

  if (optimizableItems.length <= 7) {
    const permutations = getPermutations(optimizableItems);
    
    for (const perm of permutations) {
      const testItems = [...items];
      optimizableIndices.forEach((origIdx, permIdx) => {
        testItems[origIdx] = perm[permIdx]!;
      });

      const stats = calculateRouteStats(testItems);
      if (stats.totalKm < minDistance) {
        minDistance = stats.totalKm;
        bestItemsOrder = perm;
      }
    }
  } else {
    // Fallback: Nearest-Neighbor heuristic but keeping fixed items at their indices
    const unvisited = [...optimizableItems];
    const sorted: ItineraryItem[] = [];
    
    const startRefIdx = optimizableIndices[0]! - 1;
    let currentRef: ItineraryItem | undefined = startRefIdx >= 0 ? items[startRefIdx] : undefined;

    while (unvisited.length > 0) {
      let nearestIdx = -1;
      let minDist = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const uItem = unvisited[i]!;
        const dist = currentRef 
          ? calculateHaversineDistanceKm(currentRef.latitude, currentRef.longitude, uItem.latitude, uItem.longitude, currentRef, uItem)
          : 0;
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = i;
        }
      }

      if (nearestIdx !== -1) {
        currentRef = unvisited.splice(nearestIdx, 1)[0];
        if (currentRef) {
          sorted.push(currentRef);
        } else {
          break;
        }
      } else {
        break;
      }
    }
    bestItemsOrder = sorted;
  }

  // 2. Write the optimized items back to their original slots
  const finalItems = [...items];
  optimizableIndices.forEach((origIdx, permIdx) => {
    finalItems[origIdx] = bestItemsOrder[permIdx]!;
  });

  const updatedDay: ItineraryDay = { ...day, items: finalItems };
  const recalculatedDay = recalculateDayTimings(updatedDay);
  const newStats = calculateRouteStats(recalculatedDay.items);

  return {
    day: recalculatedDay,
    totalDistanceKm: newStats.totalKm,
    totalTravelMins: newStats.totalMins,
    savedKm: Math.max(0, Math.round((originalStats.totalKm - newStats.totalKm) * 10) / 10),
    savedMins: Math.max(0, originalStats.totalMins - newStats.totalMins),
  };
}

/**
 * Parses local currency values and returns an estimated converted INR string.
 */
export function formatConvertedPrice(priceStr?: string): string | null {
  if (!priceStr) return null;
  const str = priceStr.trim();
  
  const match = str.match(/^(¥|€|£|\$|USD|EUR|GBP|JPY)\s*([\d,.]+)/i) || str.match(/^([\d,.]+)\s*(Yen|Euro|USD|EUR|GBP|JPY|¥|€|£|\$)/i);
  if (!match) return null;
  
  let valStr = '';
  let currency = '';
  
  if (match[2] && isNaN(Number(match[2].replace(/,/g, '')))) {
    valStr = match[1] || '';
    currency = match[2] || '';
  } else {
    valStr = match[2] || match[1] || '';
    currency = match[1] || match[2] || '';
  }
  
  const val = parseFloat(valStr.replace(/,/g, ''));
  if (isNaN(val)) return null;
  
  currency = currency.toUpperCase().trim();
  let rate = 1;
  let showConvert = false;
  
  if (currency === '$' || currency === 'USD') {
    rate = 83.5;
    showConvert = true;
  } else if (currency === '€' || currency === 'EUR') {
    rate = 90.0;
    showConvert = true;
  } else if (currency === '¥' || currency === 'JPY' || currency === 'YEN') {
    rate = 0.55;
    showConvert = true;
  } else if (currency === '£' || currency === 'GBP') {
    rate = 106.0;
    showConvert = true;
  }
  
  if (showConvert) {
    const converted = Math.round(val * rate);
    return `₹${converted.toLocaleString()}`;
  }
  
  return null;
}

