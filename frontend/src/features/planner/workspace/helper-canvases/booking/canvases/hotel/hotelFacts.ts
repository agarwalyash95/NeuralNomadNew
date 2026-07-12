/**
 * Real-only fact chips for a hotel card. Cancellation policy, refundability,
 * and breakfast-included are deliberately absent: `HotelMaster` /
 * `SuggestionDetails` carry no such fields today (Google-Places-sourced),
 * so a chip for them would be fabricated. Add the field to the data model
 * first; don't invent the chip to fill a layout.
 */
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';

export interface HotelFact {
  label: string;
}

export function buildHotelFacts(hotel: Suggestion): HotelFact[] {
  const d = hotel.details || {};
  const facts: HotelFact[] = [];
  if (d.star_rating) facts.push({ label: `${d.star_rating}-star property` });
  if (d.good_for_children) facts.push({ label: 'Family-friendly' });
  if (d.wheelchair_accessible) facts.push({ label: 'Wheelchair accessible' });
  if (d.good_for_groups) facts.push({ label: 'Good for groups' });
  if (d.outdoor_seating) facts.push({ label: 'Outdoor seating' });
  return facts;
}
