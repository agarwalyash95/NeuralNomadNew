import type { Suggestion } from '../../../plan-canvas/types';
import type { MealRecommendation } from './mealRecommendationEngine';

/**
 * Presentation-only helpers for the restaurant canvas. Nothing here changes
 * how a recommendation is scored or labelled (that's mealRecommendationEngine.ts) —
 * these only reorder/reshape the same fields for display, or re-sort/filter
 * the already-computed recommendation list client-side.
 */

// ── Food-first photo ordering ────────────────────────────────────────────
// Google Places usually orders photos with the storefront/exterior shot
// first and food/interior shots afterwards. We don't get a category tag per
// photo, so rather than guess which secondary image is "food", we simply
// prefer the first secondary image as the hero when one exists — it's more
// often a dish or the dining room than the street-facing primary photo —
// and keep the primary photo in the strip so nothing is hidden.
export function getFoodFirstPhotos(suggestion: Suggestion): string[] {
  const secondary = suggestion.secondary_images.filter(Boolean);
  if (secondary.length === 0) {
    return suggestion.image_url ? [suggestion.image_url] : [];
  }
  if (!suggestion.image_url) return secondary;
  return [secondary[0]!, suggestion.image_url, ...secondary.slice(1)];
}

// ── Open-now heuristic ───────────────────────────────────────────────────
// Same weekday-index convention as RichHoverCard's todaysHours(): Google's
// weekday descriptions start Monday, JS getDay() starts Sunday.
export type OpenStatus = 'open' | 'closed' | 'unknown';

export function isOpenNow(openingHours?: string[] | null, now: Date = new Date()): OpenStatus {
  if (!openingHours || openingHours.length === 0) return 'unknown';
  const index = (now.getDay() + 6) % 7;
  const line = openingHours[index];
  if (!line) return 'unknown';
  const rest = line.replace(/^[A-Za-z]+:\s*/, '').trim();
  if (/closed/i.test(rest)) return 'closed';
  if (/open 24 hours/i.test(rest)) return 'open';

  // "9:00 AM – 10:00 PM" (also handles a plain hyphen and comma-joined ranges)
  const ranges = rest.split(',').map((r) => r.trim());
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (const range of ranges) {
    const parts = range.split(/–|-/).map((p) => p.trim());
    if (parts.length !== 2) continue;
    const [startStr, endStr] = parts;
    if (!startStr || !endStr) continue;
    const start = parseClockTime(startStr);
    const end = parseClockTime(endStr);
    if (start == null || end == null) continue;
    // Overnight ranges (e.g. 6:00 PM – 1:00 AM) wrap past midnight.
    if (end < start) {
      if (nowMinutes >= start || nowMinutes < end) return 'open';
    } else if (nowMinutes >= start && nowMinutes < end) {
      return 'open';
    }
  }
  return 'closed';
}

function parseClockTime(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(text.trim());
  if (!match) return null;
  let hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// ── Contextual quick actions ──────────────────────────────────────────────
// Re-sort/filter over the already-scored recommendation list, using only
// real fields (cost, real opening_hours). 'Find quieter' and 'More
// authentic' were removed — Google Places gives us no live-crowd or
// cuisine-authenticity signal, so those buttons used to invent a
// crowdLevel/label to sort by. Don't reintroduce them without a real
// backend signal to sort on.
export type AIQuickActionId = 'cheaper' | 'open_now';

export function applyAIQuickFilter(
  recommendations: MealRecommendation[],
  action: AIQuickActionId
): MealRecommendation[] {
  switch (action) {
    case 'cheaper':
      return [...recommendations].sort(
        (a, b) => (a.estimatedCostForTwo ?? Infinity) - (b.estimatedCostForTwo ?? Infinity)
      );
    case 'open_now': {
      const open = recommendations.filter((r) => isOpenNow(r.suggestion.details?.opening_hours) !== 'closed');
      return open.length > 0 ? open : recommendations;
    }
    default:
      return recommendations;
  }
}

export const AI_QUICK_ACTIONS: { id: AIQuickActionId; label: string }[] = [
  { id: 'cheaper', label: 'Cheaper' },
  { id: 'open_now', label: 'Open now' },
];
