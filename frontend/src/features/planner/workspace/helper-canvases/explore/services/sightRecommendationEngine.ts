import type { Suggestion } from '../../../plan-canvas/types';
import type { TripContext } from '../../../types';

export interface AttractionRecommendation {
  suggestion: Suggestion;
  /** Real price_label / cost.amount when known; 'Varies' when Google Places
   *  has no ticket price on file — never a category-keyword guess. */
  entryFee: string;
  entryFeeIsReal: boolean;
  /** Real walking time derived from Google's distance_km. null when distance
   *  is unknown — we never invent a walk time from a default distance. */
  walkTimeMins: number | null;
  itineraryContext: string;
}

function deriveEntryFee(suggestion: Suggestion): { label: string; isReal: boolean } {
  if (suggestion.price_label) return { label: suggestion.price_label, isReal: true };
  if (suggestion.cost?.amount != null) return { label: `₹${suggestion.cost.amount}`, isReal: true };
  return { label: 'Varies', isReal: false };
}

// ── Provenance-preserving mapper ────────────────────────────────────────────
// Renders the backend's list order as-is. It does NOT rank, label, or assert
// fit — the canvas presents provenance-tagged real fields only (contract §9.1).
export function getAttractionRecommendations(
  suggestions: Suggestion[],
  tripContext: TripContext,
): AttractionRecommendation[] {
  return suggestions.map((suggestion) => {
    const { label: entryFee, isReal: entryFeeIsReal } = deriveEntryFee(suggestion);
    const walkTimeMins =
      suggestion.distance_km != null ? Math.round(suggestion.distance_km * 12) : null;
    return {
      suggestion,
      entryFee,
      entryFeeIsReal,
      walkTimeMins,
      itineraryContext: tripContext.activeNodeDayLabel || "Today's route",
    };
  });
}
