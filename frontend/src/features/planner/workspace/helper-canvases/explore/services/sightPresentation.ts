import type { AttractionRecommendation } from './sightRecommendationEngine';
import type { ActivityRecommendation } from './activityRecommendationEngine';

// ── Attraction AI Quick Actions ──────────────────────────────────────────
// 'Find quieter', 'More scenic', and 'Under a roof' were removed — Google
// Places gives no live-crowd, scenic-quality, or indoor/outdoor signal for
// attractions, so those buttons used to sort by an invented score. Don't
// reintroduce them without a real backend signal to sort on.
export type AIAttractionActionId = 'free_entry' | 'shorter_walk';

export const AI_ATTRACTION_QUICK_ACTIONS: { id: AIAttractionActionId; label: string; emoji: string }[] = [
  { id: 'free_entry', label: 'Free to enter', emoji: '🎫' },
  { id: 'shorter_walk', label: 'Shorter walk', emoji: '🚶' },
];

export function applyAttractionQuickFilter(
  recommendations: AttractionRecommendation[],
  action: AIAttractionActionId,
): AttractionRecommendation[] {
  switch (action) {
    case 'free_entry': {
      const free = recommendations.filter((r) => r.entryFeeIsReal && r.entryFee.toLowerCase().includes('free'));
      return free.length > 0 ? free : recommendations;
    }
    case 'shorter_walk':
      return [...recommendations].sort((a, b) => {
        if (a.walkTimeMins == null) return 1; // unknown distances sort last
        if (b.walkTimeMins == null) return -1;
        return a.walkTimeMins - b.walkTimeMins;
      });
    default:
      return recommendations;
  }
}

// ── Activity AI Quick Actions ─────────────────────────────────────────────
export type AIActivityActionId = 'beginner' | 'short' | 'budget' | 'indoor' | 'walkin';

export const AI_ACTIVITY_QUICK_ACTIONS: { id: AIActivityActionId; label: string; emoji: string }[] = [
  { id: 'beginner', label: 'Beginner friendly', emoji: '🌱' },
  { id: 'short', label: 'Under 2 hours', emoji: '⏱️' },
  { id: 'budget', label: 'Under ₹500', emoji: '💸' },
  { id: 'indoor', label: 'Indoor', emoji: '🏠' },
  { id: 'walkin', label: 'No booking', emoji: '🚶' },
];

export function applyActivityQuickFilter(
  recommendations: ActivityRecommendation[],
  action: AIActivityActionId,
): ActivityRecommendation[] {
  switch (action) {
    case 'beginner':
      return recommendations
        .filter((r) => r.difficultyScore !== null && r.difficultyScore <= 2)
        .sort((a, b) => (a.difficultyScore ?? 0) - (b.difficultyScore ?? 0));
    case 'short':
      return recommendations
        .filter((r) => r.durationMins !== null && r.durationMins <= 120)
        .sort((a, b) => (a.durationMins ?? 0) - (b.durationMins ?? 0));
    case 'budget': {
      const cheap = recommendations.filter((r) => r.pricePerPerson !== null && r.pricePerPerson < 500);
      const base = cheap.length > 0 ? cheap : recommendations.filter((r) => r.pricePerPerson !== null);
      return base.sort((a, b) => (a.pricePerPerson ?? 0) - (b.pricePerPerson ?? 0));
    }
    case 'indoor': {
      const indoor = recommendations.filter(
        (r) =>
          r.suggestion.name.toLowerCase().includes('museum') ||
          r.suggestion.name.toLowerCase().includes('gallery') ||
          r.suggestion.name.toLowerCase().includes('workshop') ||
          r.suggestion.name.toLowerCase().includes('cooking') ||
          r.suggestion.name.toLowerCase().includes('yoga') ||
          r.suggestion.name.toLowerCase().includes('spa'),
      );
      return indoor.length > 0 ? indoor : recommendations;
    }
    case 'walkin': {
      const walkIn = recommendations.filter((r) => r.bookingRequired === false);
      return walkIn.length > 0 ? walkIn : recommendations;
    }
    default:
      return recommendations;
  }
}

// ── Shared open-now helper ─────────────────────────────────────────────────
export type OpenStatus = 'open' | 'closed' | 'unknown';

export function isOpenNow(openingHours?: string[] | null, now: Date = new Date()): OpenStatus {
  if (!openingHours || openingHours.length === 0) return 'unknown';
  const index = (now.getDay() + 6) % 7;
  const line = openingHours[index];
  if (!line) return 'unknown';
  const rest = line.replace(/^[A-Za-z]+:\s*/, '').trim();
  if (/closed/i.test(rest)) return 'closed';
  if (/open 24 hours/i.test(rest)) return 'open';
  const ranges = rest.split(',').map((r) => r.trim());
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (const range of ranges) {
    const parts = range.split(/–|-/).map((p) => p.trim());
    if (parts.length !== 2) continue;
    const start = parseClockTime(parts[0] ?? '');
    const end = parseClockTime(parts[1] ?? '');
    if (start == null || end == null) continue;
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
  let hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function getOpenStatusLabel(openingHours?: string[] | null): string {
  const status = isOpenNow(openingHours);
  if (status === 'unknown') return '';
  return status === 'open' ? 'Open now' : 'Closed';
}
