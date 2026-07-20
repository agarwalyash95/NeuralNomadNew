/**
 * planTransform — the ONLY place backend trip JSON becomes a TripViewModel
 * and the only place a view model is serialized back for PATCH.
 *
 * Rules:
 *  - Structured facts (dates, travelers, budget, cost) travel as fields.
 *    Display strings are derived here, never parsed back.
 *  - Provenance (block schema v2) is passed through untouched — the backend
 *    is the authority on where facts came from.
 */

import type { PlannerTrip, TripActivity } from '@/services/planner.types';
import { localDateToISO, parseLocalISODate, todayLocalISO } from '@/lib/utils';
import type {
  BlockCost,
  ItineraryCity,
  ItineraryItem,
  TripViewModel,
} from '../plan-canvas/types';

const parseDayNum = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/\D/g, '');
  return parseInt(cleaned, 10) || 0;
};

const formatCost = (cost: BlockCost | undefined): string | undefined => {
  if (!cost || cost.amount === null || cost.amount === undefined) return undefined;
  return `${cost.currency} ${cost.amount}`;
};

// Typical live-forecast horizon — inside this window a traveler could
// reasonably expect real forecast data, so "avg" alone undersells how
// different game-day conditions might be. Past it, a seasonal normal is
// the honest ceiling regardless, so the shorter label is enough. When a
// real forecast API lands (IN5, deferred), this is the one branch to swap:
// check for day.forecast first and only fall back to weather_normal.
const FORECAST_HORIZON_DAYS = 14;

/** Month climate normals (stamped by plan generation) → a display chip.
 *  Real historical averages only — never presented as a forecast. */
const formatWeatherNormal = (normal: any, dateStr?: string | null): string | undefined => {
  if (!normal || typeof normal !== 'object') return undefined;
  const parts: string[] = [];
  if (normal.avg_temp_c != null) {
    const daysOut = dateStr ? Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000) : null;
    const label = daysOut !== null && daysOut >= 0 && daysOut <= FORECAST_HORIZON_DAYS
      ? 'seasonal avg, no live forecast yet'
      : 'avg';
    parts.push(`~${Math.round(normal.avg_temp_c)}°C ${label}`);
  }
  if (normal.precipitation_mm != null && normal.precipitation_mm > 50) parts.push('rainy season');
  return parts.length ? parts.join(' · ') : undefined;
};

function activityToItem(a: TripActivity, trip: PlannerTrip, fallbackCity: string): ItineraryItem {
  const metadata = a.metadata || {};
  const isInactive = a.is_active === false || a.status === 'inactive';
  const cost: BlockCost | undefined = a.cost && typeof a.cost === 'object' ? a.cost : undefined;

  return {
    id: a.id,
    type: (a.category?.toLowerCase() || 'activity') as ItineraryItem['type'],
    startTime: a.start_time || '',
    endTime: a.end_time || '',
    title: a.title,
    subtitle: a.location_name || '',
    price:
      formatCost(cost) ??
      (a.estimated_cost ? `${a.currency_code || trip.currency_code} ${a.estimated_cost}` : undefined),
    cost,
    blockStatus: a.block_status,
    status: isInactive ? 'inactive' : a.status === 'booked' ? 'Confirmed' : 'Pending',
    details: a.notes ?? undefined,
    latitude: a.latitude ?? (metadata.latitude as number | undefined),
    longitude: a.longitude ?? (metadata.longitude as number | undefined),
    aiTip: a.ai_tip ?? undefined,
    aiTipStatus: (metadata.ai_tip_status as ItineraryItem['aiTipStatus']) || undefined,
    rating: a.rating ?? undefined,
    image: a.image_url ?? undefined,
    geoTag: fallbackCity,
    place_id: (metadata.place_id as string | undefined) ?? undefined,
    masterRef: (metadata.master_ref as ItineraryItem['masterRef']) || undefined,
    originCode: (metadata.origin_code as string | undefined) || undefined,
    destinationCode: (metadata.destination_code as string | undefined) || undefined,
    stayNights: (metadata.stay_nights as number | undefined) || undefined,
    checkIn: (metadata.check_in as string | undefined) || undefined,
    checkOut: (metadata.check_out as string | undefined) || undefined,
    _aiInsights: a._aiInsights,
    why: a.why ?? undefined,
    isInactive,
    _rawActivity: a,
  } as ItineraryItem;
}

export function transformTripData(trip: PlannerTrip): TripViewModel {
  const travelers = (trip.metadata?.travelers as number) || 1;
  const stats = `${trip.days.length} days • ${trip.cities.length} locations • ${trip.currency_code} ${trip.total_budget} budget • ${travelers} travellers`;

  const sequentialCities: ItineraryCity[] = [];

  const sortedDays = [...(trip.days || [])].sort(
    (a, b) => parseDayNum(a.day_number) - parseDayNum(b.day_number)
  );

  sortedDays.forEach((day) => {
    let targetCityName = day.city;

    if (!targetCityName) {
      let nightSum = 0;
      let foundCityName = '';
      for (const city of trip.cities) {
        nightSum += city.nights;
        if (day.day_number <= nightSum) {
          foundCityName = city.name;
          break;
        }
      }
      targetCityName = foundCityName || trip.cities[trip.cities.length - 1]?.name || 'Itinerary';
    }

    const items: ItineraryItem[] =
      day.activities?.map((a, actIdx) => {
        const item = activityToItem(a, trip, targetCityName);
        if (!item.id) item.id = `activity-${day.day_number}-${actIdx}`;
        return item;
      }) || [];

    const itineraryDay = {
      id: day.id || `day-${day.day_number}`,
      dayNumber: day.day_number,
      dateStr: day.date || `Day ${day.day_number}`,
      isoDate: /^\d{4}-\d{2}-\d{2}$/.test(day.date || '') ? (day.date || undefined) : undefined,
      title: day.title || `Exploring ${targetCityName}`,
      items,
      transitHints: day.transit_hints || undefined,
      // Real month normals from reference data; absent otherwise
      weather: formatWeatherNormal(day.weather_normal, day.date),
    };

    const lastSegment = sequentialCities[sequentialCities.length - 1];
    if (lastSegment && lastSegment.cityName.toLowerCase() === targetCityName.toLowerCase()) {
      lastSegment.days.push(itineraryDay);
    } else {
      const baseCity = trip.cities.find(
        (c) => c.name.toLowerCase() === targetCityName.toLowerCase()
      );
      const baseCityIndex = baseCity ? trip.cities.indexOf(baseCity) : sequentialCities.length;

      const transit = baseCity?.transitToNext;
      let mappedTransit: ItineraryItem | undefined;
      if (transit) {
        const isTransitInactive = transit.is_active === false || transit.status === 'inactive';
        const transitCost: BlockCost | undefined =
          transit.cost && typeof transit.cost === 'object' ? transit.cost : undefined;
        mappedTransit = {
          id: transit.id || `transit-${baseCity?.id}`,
          type: (transit.type || 'taxi') as ItineraryItem['type'],
          title: transit.title,
          subtitle: transit.subtitle || '',
          details: transit.details,
          price: transit.price ?? formatCost(transitCost),
          cost: transitCost,
          blockStatus: transit.block_status,
          status: isTransitInactive
            ? 'inactive'
            : transit.status === 'booked'
              ? 'Confirmed'
              : 'Pending',
          image: transit.image,
          originCode: transit.metadata?.origin_code || undefined,
          destinationCode: transit.metadata?.destination_code || undefined,
          isInactive: isTransitInactive,
          _rawActivity: transit,
        } as ItineraryItem;
      }

      const segmentIndex = sequentialCities.length;
      sequentialCities.push({
        id: baseCity?.id ? `${baseCity.id}-seg-${segmentIndex}` : `city-segment-${segmentIndex}`,
        cityName: targetCityName,
        country: baseCity?.country || '',
        nights: baseCity?.nights ?? -1,
        dateRange: baseCity?.arrival_date
          ? `${baseCity.arrival_date} to ${baseCity.departure_date}`
          : '',
        iconBgColor: baseCityIndex % 2 === 0 ? 'bg-indigo-500' : 'bg-emerald-500',
        icon: targetCityName.substring(0, 2).toUpperCase(),
        days: [itineraryDay],
        transitToNext: mappedTransit,
      });
    }
  });

  // Live checklist completion from booking statuses
  let hasConfirmedHotel = false;
  let hasConfirmedTransport = false;

  trip.days.forEach((day) => {
    day.activities?.forEach((a) => {
      const isBooked = a.status === 'booked';
      const cat = (a.category || '').toLowerCase();
      if (cat === 'hotel' && isBooked) hasConfirmedHotel = true;
      if (['flight', 'train', 'bus', 'cab', 'taxi', 'transit'].includes(cat) && isBooked) {
        hasConfirmedTransport = true;
      }
    });
  });

  trip.cities.forEach((city) => {
    if (city.transitToNext && city.transitToNext.status === 'booked') {
      hasConfirmedTransport = true;
    }
  });

  // Segment metadata post-processing
  sequentialCities.forEach((segment) => {
    if (segment.nights < 0) segment.nights = Math.max(segment.days.length - 1, 0);
    const firstDay = segment.days[0];
    const lastDay = segment.days[segment.days.length - 1];
    if (firstDay && lastDay) {
      segment.dateRange =
        firstDay.dateStr === lastDay.dateStr
          ? firstDay.dateStr
          : `${firstDay.dateStr} to ${lastDay.dateStr}`;
    }
  });

  const firstBackendCity = trip.cities[0];
  const lastBackendCity = trip.cities[trip.cities.length - 1];

  return {
    title: trip.title || 'Your Generated Trip',
    stats,
    travelers,
    budget: trip.total_budget
      ? { amount: Number(trip.total_budget), currency: trip.currency_code }
      : null,
    startDate: firstBackendCity?.arrival_date || '',
    endDate: lastBackendCity?.departure_date || '',
    // PROV-01 (docs/planner-complete-current-audit-and-repair-plan.md §19
    // R13): previously only visible on the ephemeral generation job during
    // the ~1.8s loading-screen transition — see plan_generation.py
    // _persist_trip for why trip.metadata.degraded now persists this.
    degraded: Boolean(trip.metadata?.degraded),
    qualityReview: {
      flagged: Boolean(trip.scorecard?.flagged_for_review),
      state: trip.scorecard?.quality_state,
      gaps: [
        ...(Array.isArray(trip.metadata?.validation_gaps)
          ? (trip.metadata.validation_gaps as { reason?: string; category?: string; day?: number }[])
          : []),
        ...(Array.isArray(trip.scorecard?.reasons)
          ? trip.scorecard.reasons.map(reason => ({ reason }))
          : []),
      ],
      // M5 'expert reasoning shown' — set only when the LLM critic pass ran.
      criticReview: trip.scorecard?.critic_review ?? null,
    },
    syncStatus: (() => {
      const state = trip.metadata?.targeted_regeneration as Record<string, any> | undefined;
      if (!state || state.status === 'complete' || !Array.isArray(state.scopes) || state.scopes.length === 0) {
        return null;
      }
      return {
        status: state.status === 'failed' ? 'failed' : 'pending',
        scopes: state.scopes.filter((scope: unknown): scope is string => typeof scope === 'string'),
        invalidated: Array.isArray(state.invalidated)
          ? state.invalidated.filter((fact: unknown): fact is string => typeof fact === 'string')
          : [],
        requestedAt: typeof state.requested_at === 'string' ? state.requested_at : undefined,
      };
    })(),
    checklist: [
      { id: 'hotels', label: 'Hotel Bookings', status: hasConfirmedHotel ? 'Completed' : 'Pending', type: 'accommodation' },
      { id: 'transport', label: 'Local Transport', status: hasConfirmedTransport ? 'Completed' : 'Pending', type: 'transport' },
      { id: 'cash', label: 'Travel Funds/Forex', status: 'Pending', type: 'forex' },
    ],
    cities: sequentialCities.filter((c) => c.days.length > 0),
  };
}

/**
 * Serialize a view model back into the backend PATCH shape.
 * Reads only structured fields — never regexes display strings.
 */
export function serializePlanUpdate(data: TripViewModel): {
  days: any[];
  cities: any[];
} {
  const days = data.cities.flatMap((city) =>
    city.days.map((day) => ({
      id: day.id,
      day_number: day.dayNumber,
      date: day.isoDate || day.dateStr,
      title: day.title,
      city: city.cityName,
      activities: day.items.map((item) => {
        const raw = { ...(item._rawActivity || {}) };
        raw.is_active = !item.isInactive;
        raw.status = item.isInactive
          ? 'inactive'
          : item.status === 'Confirmed'
            ? 'booked'
            : 'pending';
        // Phase 0d fix: this used to spread _rawActivity (the pre-edit
        // snapshot) and override only is_active/status/cost/block_status —
        // an inline time-picker edit (ItineraryTimeline.handleTimeChange)
        // only ever touched item.startTime/endTime, which were never read
        // back here, so the PATCH silently persisted the ORIGINAL time and
        // the edit reverted on reload.
        raw.start_time = item.startTime;
        raw.end_time = item.endTime;
        if (item.cost) raw.cost = item.cost;
        if (item.blockStatus) raw.block_status = item.blockStatus;
        return raw;
      }),
    }))
  );

  const cities = data.cities.map((city) => {
    const firstDay = city.days[0];
    const lastDay = city.days[city.days.length - 1];
    return {
      id: city.id,
      name: city.cityName,
      country: city.country || '',
      nights: city.nights,
      arrival_date: firstDay?.isoDate || firstDay?.dateStr || '',
      departure_date: lastDay?.isoDate || lastDay?.dateStr || '',
      transitToNext: city.transitToNext
        ? {
            ...(city.transitToNext._rawActivity || {}),
            id: city.transitToNext.id,
            type: city.transitToNext.type,
            title: city.transitToNext.title,
            subtitle: city.transitToNext.subtitle,
            details: city.transitToNext.details,
            price: city.transitToNext.price,
            cost: city.transitToNext.cost,
            block_status: city.transitToNext.blockStatus,
            is_active: !city.transitToNext.isInactive,
            status: city.transitToNext.isInactive
              ? 'inactive'
              : city.transitToNext.status === 'Confirmed'
                ? 'booked'
                : 'pending',
          }
        : null,
    };
  });

  return { days, cities };
}

/**
 * Assemble the search context for verifying a block's price.
 * Origin/destination are best-effort hints for the lookup (the server owns
 * the authoritative write); dates come from structured day data.
 */
export function getVerifyContext(
  item: ItineraryItem,
  cityName: string,
  dayDateStr: string | undefined
): {
  service_type: string;
  date: string;
  provider: string;
  code: string;
  origin: string;
  destination: string;
} {
  const serviceType = item.type === 'taxi' ? 'cab' : item.type;

  let origin = cityName;
  let destination = cityName;
  const routeParts = (item.subtitle || item.title || '').split(' to ');
  if (routeParts.length >= 2 && routeParts[0] && routeParts[1]) {
    origin = routeParts[0].trim();
    destination = routeParts[1].trim();
  }

  let date = todayLocalISO();
  if (dayDateStr) {
    const parsed = parseLocalISODate(dayDateStr);
    if (parsed) {
      date = dayDateStr;
    } else {
      // Legacy day labels like "12 Aug" lack a year — assume the current one
      const withYear = new Date(`${dayDateStr} ${new Date().getFullYear()}`);
      if (!isNaN(withYear.getTime())) date = localDateToISO(withYear);
    }
  }

  return {
    service_type: serviceType,
    date,
    provider: item.title,
    code: (item as any).code || '',
    origin,
    destination,
  };
}
