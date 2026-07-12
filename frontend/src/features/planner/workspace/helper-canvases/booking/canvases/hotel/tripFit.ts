/**
 * tripFit — a transparent, deterministic score over real fields, standing in
 * for the old passive "AI suggested" badge. Every input is a real value
 * already on the `Suggestion` or computed by `itineraryImpact.ts`; nothing
 * here calls a model or invents a number. That's why it's presented in the
 * UI as an `estimated`-tier fact (a stated formula, not a verified truth) —
 * see ProvenanceBadge's trust grammar.
 *
 * Weighted toward itinerary fit on purpose (proximity + current-hotel delta
 * = 65 of 100 points): the brief this exists to serve is "does this hotel
 * serve my plan," not "is this the cheapest/highest-rated hotel in town."
 */
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';
import type { ItineraryImpact } from './itineraryImpact';

export interface TripFitReason {
  text: string;
  /** positive = why it scores well; tradeoff = an honest cost of this choice */
  tone: 'positive' | 'tradeoff';
}

export interface TripFitResult {
  score: number; // 0-100
  reasons: TripFitReason[];
}

const PRICE_TIER_RANK: Record<string, number> = { $: 1, $$: 2, $$$: 3, $$$$: 4 };

/** 0 = at-or-below the set's minimum, 1 = at-or-above its maximum. */
function percentile(value: number, values: number[]): number {
  if (values.length <= 1) return 1;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  return (value - min) / (max - min);
}

export function computeTripFit(
  hotel: Suggestion,
  impact: ItineraryImpact | null,
  currentImpact: ItineraryImpact | null,
  allImpacts: (ItineraryImpact | null)[],
  allHotels: Suggestion[]
): TripFitResult {
  const reasons: TripFitReason[] = [];
  let score = 0;

  // Proximity to the actual planned stops — the dominant signal (0–45).
  if (impact) {
    const others = allImpacts.filter((i): i is ItineraryImpact => !!i).map((i) => i.averageMinutes);
    const closeness = 1 - percentile(impact.averageMinutes, others.length ? others : [impact.averageMinutes]);
    score += Math.round(closeness * 45);

    reasons.push({
      text: `${impact.nearestStop.durationMins} min ${impact.nearestStop.mode === 'walk' ? 'walk' : 'cab ride'} to ${impact.nearestStop.title} (${impact.nearestStop.dayLabel})`,
      tone: 'positive',
    });
    if (impact.walkableCount > 0) {
      reasons.push({
        text: `Walking distance to ${impact.walkableCount} of ${impact.stops.length} planned stop${impact.stops.length === 1 ? '' : 's'}`,
        tone: 'positive',
      });
    }
    if (impact.farthestStop.durationMins - impact.nearestStop.durationMins > 25) {
      reasons.push({
        text: `${impact.farthestStop.durationMins} min to reach ${impact.farthestStop.title} (${impact.farthestStop.dayLabel}) — furthest of your planned stops`,
        tone: 'tradeoff',
      });
    }
  }

  // Delta vs. the currently-booked hotel (0–20) — the number that actually
  // answers "is switching worth it."
  if (impact && currentImpact) {
    const delta = currentImpact.averageMinutes - impact.averageMinutes;
    if (delta > 1) {
      score += Math.min(20, Math.round(delta));
      reasons.push({ text: `Saves ~${Math.round(delta)} min per stop vs. your current hotel`, tone: 'positive' });
    } else if (delta < -1) {
      reasons.push({ text: `~${Math.round(Math.abs(delta))} min further per stop than your current hotel`, tone: 'tradeoff' });
    }
  }

  // Rating, relative to the rest of this search's results (0–20).
  if (hotel.rating != null) {
    const ratings = allHotels.map((h) => h.rating).filter((r): r is number => r != null);
    score += Math.round(percentile(hotel.rating, ratings.length ? ratings : [hotel.rating]) * 20);
    if (ratings.length > 1 && hotel.rating >= Math.max(...ratings) - 0.05) {
      reasons.push({ text: `Highest-rated option in this search (${hotel.rating}★, ${hotel.ratings_count} reviews)`, tone: 'positive' });
    }
  }

  // Price tier, relative to this search's spread (0–15) — smallest weight
  // on purpose; a good fit isn't just "cheapest."
  const tier = hotel.details?.price_range ? PRICE_TIER_RANK[hotel.details.price_range] : undefined;
  if (tier) {
    const tiers = allHotels
      .map((h) => (h.details?.price_range ? PRICE_TIER_RANK[h.details.price_range] : undefined))
      .filter((t): t is number => t != null);
    score += Math.round((1 - percentile(tier, tiers.length ? tiers : [tier])) * 15);
    if (tiers.length > 1 && tier <= Math.min(...tiers)) {
      reasons.push({ text: 'Lower price tier than most nearby options', tone: 'positive' });
    }
  }

  // Stable order: what it costs you should never be buried below the sell.
  reasons.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'positive' ? -1 : 1));

  return { score: Math.max(0, Math.min(100, score)), reasons: reasons.slice(0, 4) };
}
