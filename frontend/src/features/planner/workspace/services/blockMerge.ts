/**
 * blockMerge — swap a slot's occupant without losing the block's data.
 *
 * A Helper Canvas produces a fresh ItineraryItem with no `_rawActivity`
 * (the backend block dict). serializePlanUpdate persists blocks FROM
 * `_rawActivity`, so replacing a node wholesale used to strip everything
 * the canvas didn't set — times, notes, coords, tips — on the next PATCH.
 *
 * The rule here: the SLOT survives (id, timing, day placement, cached slot
 * alternatives), the PLACE changes (title, location, price, image, rating,
 * coords, tip). Facts about the old place never leak onto the new one.
 */

import type { ItineraryItem } from '../plan-canvas/types';

/**
 * Build a complete backend block dict from a view-model item.
 * Field names mirror activityToItem in planTransform.ts — the only other
 * place that maps between the two shapes.
 */
export function toRawActivity(
  item: ItineraryItem,
  base: Record<string, any> = {}
): Record<string, any> {
  const metadata = { ...(base.metadata || {}) };
  // Metadata carries per-place fallbacks (activityToItem reads them when the
  // top-level field is empty). After a swap they describe the OLD occupant —
  // drop them so stale facts can't resurface on the next plan read.
  delete metadata.latitude;
  delete metadata.longitude;
  delete metadata.rating;
  delete metadata.image;
  delete metadata.aiTip;
  delete metadata.ai_tip;
  delete metadata.geoTag;
  delete metadata.origin_code;
  delete metadata.destination_code;
  delete metadata.stay_nights;
  delete metadata.check_in;
  delete metadata.check_out;
  if (item.place_id) metadata.place_id = item.place_id;
  if (item.masterRef) metadata.master_ref = item.masterRef;
  if (item.originCode) metadata.origin_code = item.originCode;
  if (item.destinationCode) metadata.destination_code = item.destinationCode;
  if (item.stayNights) metadata.stay_nights = item.stayNights;
  if (item.checkIn) metadata.check_in = item.checkIn;
  if (item.checkOut) metadata.check_out = item.checkOut;

  const raw: Record<string, any> = {
    ...base,
    id: item.id,
    category: item.type,
    title: item.title,
    location_name: item.subtitle || '',
    start_time: item.startTime ?? base.start_time ?? '',
    end_time: item.endTime ?? base.end_time ?? '',
    notes: item.details ?? null,
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    rating: item.rating ?? null,
    image_url: item.image ?? null,
    ai_tip: item.aiTip ?? null,
    block_status: item.blockStatus ?? 'planned',
    status: item.isInactive ? 'inactive' : 'pending',
    is_active: !item.isInactive,
    _aiInsights: item._aiInsights ?? base._aiInsights,
    metadata,
  };

  if (item.cost) {
    raw.cost = item.cost;
    // Keep the legacy display fields consistent with the structured cost so
    // pre-v2 readers never show the previous occupant's price.
    raw.estimated_cost = item.cost.amount;
    raw.currency_code = item.cost.currency;
  }

  return raw;
}

/**
 * Merge a canvas selection into the slot it replaces.
 * Preserve from the old item: id, slot timing (when the new item has none),
 * cached slot alternatives. Everything place-specific comes from the new
 * item — including absence (an old aiTip about the old venue must not
 * describe the new one).
 */
export function mergeReplacementItem(
  oldItem: ItineraryItem,
  newItem: ItineraryItem
): ItineraryItem {
  const merged: ItineraryItem = {
    ...newItem,
    id: oldItem.id,
    startTime: newItem.startTime || oldItem.startTime,
    endTime: newItem.endTime || oldItem.endTime,
    status: 'Pending',
    blockStatus: newItem.blockStatus ?? 'planned',
    isInactive: false,
    isDeleting: false,
    // Slot alternatives were computed for the slot (category + city), not the
    // occupant — they remain real, still-valid swap options.
    _aiInsights: newItem._aiInsights ?? oldItem._aiInsights,
  };

  merged._rawActivity = toRawActivity(merged, oldItem._rawActivity || {});
  return merged;
}
