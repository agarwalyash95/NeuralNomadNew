import { BedDouble, Utensils, Zap, Compass, Car, Coffee, Moon, type LucideIcon } from 'lucide-react';

/**
 * One category → {icon, color} map, imported by every surface that renders
 * a category badge/icon: GenericNode, AIInsightsPanel, PlannerMap pins,
 * SuggestionCard. Previously each file had its own switch statement and
 * they disagreed (activity was rose on the timeline, emerald in the
 * insights panel; hotel was indigo on one, violet on the other) — the same
 * object read as a different object depending which surface you looked at.
 *
 * Transport modes (flight/train/bus) keep their own distinct per-mode
 * accents in TransportNode and on the map — that's a deliberately more
 * detailed scheme for specialized surfaces, not one of the disagreeing
 * "generic category" spots this map fixes. Taxi/cab already agreed (amber)
 * everywhere it appeared, so that agreement is preserved here as-is.
 */

export type BlockCategory = 'hotel' | 'food' | 'restaurant' | 'activity' | 'attraction' | 'taxi' | 'cab' | 'rest' | 'hotel_return';

interface CategoryStyleEntry {
  icon: LucideIcon;
  /** Hex — for contexts that can't use Tailwind classes (canvas-drawn map pins) */
  hex: string;
  text: string;
  bg: string;
  border: string;
  /** `from-X/20 to-Y/10` — for `bg-gradient-to-br ${gradient}` consumers */
  gradient: string;
}

export const CATEGORY_STYLE: Record<BlockCategory, CategoryStyleEntry> = {
  hotel: { icon: BedDouble, hex: '#6366f1', text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', gradient: 'from-indigo-50/20 to-indigo-100/10' },
  food: { icon: Utensils, hex: '#f97316', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', gradient: 'from-orange-50/20 to-orange-100/10' },
  restaurant: { icon: Utensils, hex: '#f97316', text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', gradient: 'from-orange-50/20 to-orange-100/10' },
  activity: { icon: Zap, hex: '#e11d48', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', gradient: 'from-rose-50/20 to-rose-100/10' },
  attraction: { icon: Compass, hex: '#059669', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', gradient: 'from-emerald-50/20 to-emerald-100/10' },
  taxi: { icon: Car, hex: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', gradient: 'from-amber-50/20 to-amber-100/10' },
  cab: { icon: Car, hex: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', gradient: 'from-amber-50/20 to-amber-100/10' },
  // Non-bookable — deliberately muted/neutral so they read as "light",
  // never competing visually with a real bookable place.
  rest: { icon: Coffee, hex: '#78716c', text: 'text-stone-500', bg: 'bg-stone-50', border: 'border-stone-200', gradient: 'from-stone-50/20 to-stone-100/10' },
  hotel_return: { icon: Moon, hex: '#a5b4fc', text: 'text-indigo-400', bg: 'bg-indigo-50/60', border: 'border-indigo-100', gradient: 'from-indigo-50/10 to-indigo-100/5' },
};

export function getCategoryStyle(type: string): CategoryStyleEntry {
  return CATEGORY_STYLE[type as BlockCategory] ?? CATEGORY_STYLE.attraction;
}
