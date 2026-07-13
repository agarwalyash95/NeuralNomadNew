import {
  Accessibility, ParkingCircle, CreditCard, Leaf, CalendarClock, Sun,
  Baby, Users, PawPrint, Compass, Backpack, type LucideIcon,
} from 'lucide-react';
import type { SuggestionDetails } from '../../../plan-canvas/types';

/**
 * Decision-fact helpers shared by every detail panel, mirroring the exact
 * vocabulary RichHoverCard uses — the detail view must read as the hover
 * preview expanded, not as a different product. Every fact here comes from
 * reference data or server-side enrichment; nothing is invented client-side.
 */

/** Google weekday descriptions start Monday; JS getDay() starts Sunday. */
export function todayHoursIndex(now: Date = new Date()): number {
  return (now.getDay() + 6) % 7;
}

export function todaysHours(openingHours?: string[] | null): string | null {
  if (!openingHours || openingHours.length === 0) return null;
  const line = openingHours[todayHoursIndex()];
  if (!line) return null;
  return line.replace(/^[A-Za-z]+:\s*/, '');
}

/**
 * One judgment line, picked by decision-relevance per the fields the
 * enrichment pipeline actually populates (apps.knowledge.services.enrichment).
 * Same priority order as RichHoverCard — absent is the honest default.
 */
export function buildJudgmentLine(insights: SuggestionDetails['insights']): string | null {
  if (!insights) return null;
  if (insights.signature_dish?.name) {
    return `Order the ${insights.signature_dish.name} — mentioned in ${insights.signature_dish.mention_count} reviews`;
  }
  if (insights.noise_profile?.text) return insights.noise_profile.text;
  if (insights.guest_fit?.tags?.length) return `Best for: ${insights.guest_fit.tags.slice(0, 3).join(', ')}`;
  if (insights.hype_calibration?.text) return insights.hype_calibration.text;
  if (insights.real_duration?.minutes) return `Typical visit: about ${Math.round(insights.real_duration.minutes / 60 * 10) / 10} hrs`;
  if (insights.vantage_point?.text) return insights.vantage_point.text;
  return null;
}

export interface FactChip {
  icon: LucideIcon;
  label: string;
}

/**
 * Quiet metadata chips, ordered by decision weight and capped so the row
 * stays scannable. Only real reference-data booleans surface — an absent
 * field renders nothing rather than a guess.
 */
export function buildFactChips(details: SuggestionDetails, max = 6): FactChip[] {
  const chips: FactChip[] = [];

  if (details.reservation_policy) {
    const label = details.reservation_policy === 'walk_in' ? 'Walk-in friendly'
      : details.reservation_policy === 'required' ? 'Reservation required' : 'Reservation recommended';
    chips.push({ icon: CalendarClock, label });
  }
  if (details.accessibility_detail?.step_free) chips.push({ icon: Accessibility, label: 'Step-free access' });
  else if (details.wheelchair_accessible) chips.push({ icon: Accessibility, label: 'Wheelchair accessible' });

  const vegetarian = details.dietary_accommodations?.vegetarian;
  if (vegetarian && vegetarian !== 'limited') {
    chips.push({ icon: Leaf, label: `Vegetarian: ${vegetarian.replace('_', ' ')}` });
  } else if (details.serves_vegetarian_food) {
    chips.push({ icon: Leaf, label: 'Vegetarian options' });
  }

  if (details.outdoor_seating) chips.push({ icon: Sun, label: 'Outdoor seating' });
  if (details.good_for_children) chips.push({ icon: Baby, label: 'Family friendly' });
  if (details.good_for_groups) chips.push({ icon: Users, label: 'Good for groups' });
  if (details.allows_dogs) chips.push({ icon: PawPrint, label: 'Dogs allowed' });
  if (details.guided_tour) chips.push({ icon: Compass, label: 'Guided tours' });
  if (details.equipment_included) chips.push({ icon: Backpack, label: 'Equipment included' });
  if (details.parking_options && Object.values(details.parking_options).some(Boolean)) {
    chips.push({ icon: ParkingCircle, label: 'Parking available' });
  }
  if (details.payment_options && Object.values(details.payment_options).some(Boolean)) {
    chips.push({ icon: CreditCard, label: 'Cards accepted' });
  }

  return chips.slice(0, max);
}
