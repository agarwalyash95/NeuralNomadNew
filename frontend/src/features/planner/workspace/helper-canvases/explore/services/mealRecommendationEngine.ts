import type { Suggestion } from '../../../plan-canvas/types';
import type { TripContext } from '../../../types';

export interface MealRecommendation {
  suggestion: Suggestion;
  /** Real cost.amount-derived when available; a price_label band estimate
   *  otherwise; null when neither is known — never a flat invented number. */
  estimatedCostForTwo: number | null;
  /** True when `estimatedCostForTwo` came from banding `price_label`
   *  ($/$$/$$$) rather than a real `cost.amount` — consumers should label
   *  it "Est." rather than presenting it as an exact price. */
  costIsEstimate: boolean;
  /** Real walking time derived from Google's distance_km. null when distance
   *  is unknown — we never invent a walk time from a default distance. */
  walkTimeMins: number | null;
  timeSlot: string;
  nearbyAttractions: string[];
  itineraryContext: string;
}

function deriveCostForTwo(place: Suggestion, travellers: number): { amount: number | null; isEstimate: boolean } {
  if (place.cost?.amount != null) {
    const perPerson = place.cost.amount * (travellers > 1 ? travellers / 2 : 1);
    return { amount: Math.round(perPerson * 2), isEstimate: false };
  }
  if (place.price_label) {
    const len = place.price_label.replace(/[^$₹]/g, '').length;
    const banded = len === 1 ? 300 : len === 2 ? 600 : len === 3 ? 1200 : len >= 4 ? 2000 : null;
    if (banded !== null) return { amount: banded, isEstimate: true };
  }
  return { amount: null, isEstimate: false };
}

// ── Provenance-preserving mapper ────────────────────────────────────────────
// Renders the backend's list order as-is. It does NOT rank, label, or assert
// confidence — the canvas presents provenance-tagged real fields only
// (contract §9.1, mirrors sightRecommendationEngine.ts).
export function getMealRecommendations(
  results: Suggestion[],
  tripContext: TripContext,
  selectedFilters: string[]
): MealRecommendation[] {
  const enriched: MealRecommendation[] = results.map((place) => {
    const { amount: costForTwo, isEstimate: costIsEstimate } = deriveCostForTwo(place, tripContext.travellers);
    const walkTimeMins = place.distance_km != null ? Math.round(place.distance_km * 12) : null;

    // Timing slot — from the user's own filter choice or the block this is
    // replacing; a plain default when neither is known (a UI default, not a
    // claim about the restaurant).
    let timeSlot = '1:30 PM Lunch';
    if (selectedFilters.includes('Breakfast')) {
      timeSlot = '8:30 AM Breakfast';
    } else if (selectedFilters.includes('Dinner')) {
      timeSlot = '8:00 PM Dinner';
    } else if (tripContext.activeNodeStartTime) {
      const hour = parseInt(tripContext.activeNodeStartTime.split(':')[0] || '12', 10);
      if (hour < 11) timeSlot = `${tripContext.activeNodeStartTime} AM Breakfast`;
      else if (hour < 16) timeSlot = `${tripContext.activeNodeStartTime} PM Lunch`;
      else timeSlot = `${tripContext.activeNodeStartTime} PM Dinner`;
    }

    // Nearby planned stops — real trip context only
    const activeDayItems = tripContext.activeDayItemTitles || [];
    const nearbyAttractions: string[] = [];
    if (activeDayItems.length > 0) {
      nearbyAttractions.push(...activeDayItems.slice(0, 2));
    } else if (tripContext.activeNodeTitle) {
      nearbyAttractions.push(tripContext.activeNodeTitle);
    }

    return {
      suggestion: place,
      estimatedCostForTwo: costForTwo,
      costIsEstimate,
      walkTimeMins,
      timeSlot,
      nearbyAttractions,
      itineraryContext: tripContext.activeNodeDayLabel || "Today's Itinerary",
    };
  });

  // Filtering based on selected filter chips — user-directed search, not an
  // AI-presented fact about a venue. Matching against the restaurant's real
  // name/subtitle text to answer "does this look like what the user asked
  // for" is an ordinary search heuristic, unlike asserting invented
  // specifics as recommendations.
  let filtered = [...enriched];

  selectedFilters.forEach(filter => {
    if (filter === 'All' || filter === 'AI Picks') return;
    const nameLower = (r: MealRecommendation) => r.suggestion.name.toLowerCase();

    if (filter === 'Breakfast') {
      filtered = filtered.filter(r => r.timeSlot.includes('Breakfast') || nameLower(r).includes('cafe') || nameLower(r).includes('bakery'));
    } else if (filter === 'Lunch') {
      filtered = filtered.filter(r => r.timeSlot.includes('Lunch'));
    } else if (filter === 'Dinner') {
      filtered = filtered.filter(r => r.timeSlot.includes('Dinner'));
    } else if (filter === 'Cafés') {
      filtered = filtered.filter(r => nameLower(r).includes('cafe') || nameLower(r).includes('coffee') || nameLower(r).includes('tea'));
    } else if (filter === 'Desserts') {
      filtered = filtered.filter(r => nameLower(r).includes('bakery') || nameLower(r).includes('sweet') || nameLower(r).includes('ice cream') || nameLower(r).includes('creperie'));
    } else if (filter === 'Breweries') {
      filtered = filtered.filter(r => nameLower(r).includes('brewery') || nameLower(r).includes('bar') || nameLower(r).includes('pub'));
    } else if (filter === 'Street Food') {
      filtered = filtered.filter(r => nameLower(r).includes('dhaba') || nameLower(r).includes('chat') || nameLower(r).includes('street') || nameLower(r).includes('fast food'));
    } else if (filter === 'Local Food') {
      filtered = filtered.filter(r => nameLower(r).includes('dhaba') || nameLower(r).includes('traditional') || nameLower(r).includes('indian') || nameLower(r).includes('himachal'));
    } else if (filter === 'Vegetarian') {
      filtered = filtered.filter(r => r.suggestion.details?.serves_vegetarian_food === true);
    } else if (filter === 'Family Friendly') {
      filtered = filtered.filter(r => r.suggestion.details?.good_for_children === true || r.suggestion.details?.menu_for_children === true);
    } else if (filter === 'Budget') {
      filtered = filtered.filter(r => r.estimatedCostForTwo !== null && r.estimatedCostForTwo <= 600);
    } else if (filter === 'Highly Rated') {
      filtered = filtered.filter(r => r.suggestion.rating !== null && r.suggestion.rating >= 4.5);
    }
  });

  return filtered;
}
