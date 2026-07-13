import type { Suggestion } from '../../../plan-canvas/types';
import type { TripContext } from '../../../types';

export type DifficultyTier = 'Beginner' | 'Intermediate' | 'Advanced';

const DIFFICULTY_SCORE: Record<DifficultyTier, number> = { Beginner: 1, Intermediate: 3, Advanced: 4 };

export interface ActivityRecommendation {
  suggestion: Suggestion;
  /** From the real details.difficulty_level Google Places reports — null when unknown */
  difficulty: DifficultyTier | null;
  difficultyScore: number | null;
  durationMins: number | null;
  durationLabel: string | null;
  pricePerPerson: number | null;
  priceLabel: string | null;
  /** True when `pricePerPerson` came from banding `price_label` rather than a real `cost.amount` */
  priceIsEstimate: boolean;
  /** From the real details.reservable flag — null when unknown, never guessed */
  bookingRequired: boolean | null;
  /** Only real details.equipment_included — empty when nothing is on record */
  whatIncluded: string[];
  itineraryContext: string;
}

function deriveDuration(suggestion: Suggestion): { mins: number | null; label: string | null } {
  if (suggestion.duration_label) {
    const match = suggestion.duration_label.match(/(\d+)/);
    if (match && match[1]) {
      const mins = parseInt(match[1], 10) * (suggestion.duration_label.includes('h') ? 60 : 1);
      return { mins, label: suggestion.duration_label };
    }
  }
  return { mins: null, label: null };
}

function derivePrice(suggestion: Suggestion): { amount: number | null; label: string | null; isEstimate: boolean } {
  if (suggestion.cost?.amount != null) {
    return { amount: suggestion.cost.amount, label: `₹${suggestion.cost.amount}/person`, isEstimate: false };
  }
  if (suggestion.price_label) {
    const len = suggestion.price_label.replace(/[^$₹]/g, '').length;
    const banded = len === 1 ? 300 : len === 2 ? 800 : len === 3 ? 1800 : len >= 4 ? 3000 : null;
    if (banded !== null) return { amount: banded, label: `~₹${banded}/person`, isEstimate: true };
  }
  return { amount: null, label: null, isEstimate: false };
}

function deriveDifficulty(suggestion: Suggestion): DifficultyTier | null {
  const level = suggestion.details?.difficulty_level;
  if (level === 'Easy') return 'Beginner';
  if (level === 'Moderate') return 'Intermediate';
  if (level === 'Hard') return 'Advanced';
  return null;
}

// ── Provenance-preserving mapper ────────────────────────────────────────────
// Renders the backend's list order as-is. It does NOT rank, label, or assert
// confidence — the canvas presents provenance-tagged real fields only (§9.1).
export function getActivityRecommendations(
  suggestions: Suggestion[],
  tripContext: TripContext,
): ActivityRecommendation[] {
  return suggestions.map((suggestion) => {
    const { amount: pricePerPerson, label: priceLabel, isEstimate: priceIsEstimate } = derivePrice(suggestion);
    const { mins: durationMins, label: durationLabel } = deriveDuration(suggestion);
    const difficulty = deriveDifficulty(suggestion);
    const difficultyScore = difficulty ? DIFFICULTY_SCORE[difficulty] : null;
    const bookingRequired = suggestion.details?.reservable ?? null;
    const whatIncluded = suggestion.details?.equipment_included === true ? ['Equipment included'] : [];

    return {
      suggestion,
      difficulty,
      difficultyScore,
      durationMins,
      durationLabel,
      pricePerPerson,
      priceLabel,
      priceIsEstimate,
      bookingRequired,
      whatIncluded,
      itineraryContext: tripContext.activeNodeDayLabel || "Today's plan",
    };
  });
}
