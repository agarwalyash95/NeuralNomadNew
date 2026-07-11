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

import type { PlannerTrip } from '@/services/planner.types';
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

function activityToItem(a: any, trip: PlannerTrip, fallbackCity: string): ItineraryItem {
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
    details: a.notes,
    latitude: a.latitude ?? (metadata.latitude as number | undefined),
    longitude: a.longitude ?? (metadata.longitude as number | undefined),
    aiTip: a.aiTip || a.ai_tip || (metadata.aiTip as string) || (metadata.ai_tip as string),
    rating: a.rating || (metadata.rating as number | undefined),
    image: a.image || a.image_url || (metadata.image as string | undefined),
    geoTag: a.geoTag || a.geo_tag || (metadata.geoTag as string) || fallbackCity,
    place_id: a.place_id || (metadata.place_id as string | undefined) || undefined,
    masterRef: (metadata.master_ref as ItineraryItem['masterRef']) || undefined,
    originCode: (metadata.origin_code as string | undefined) || undefined,
    destinationCode: (metadata.destination_code as string | undefined) || undefined,
    stayNights: (metadata.stay_nights as number | undefined) || undefined,
    checkIn: (metadata.check_in as string | undefined) || undefined,
    checkOut: (metadata.check_out as string | undefined) || undefined,
    _aiInsights: a._aiInsights || metadata._aiInsights,
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
    let targetCityName = (day as any).city || (day as any).cityName;

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
      day.activities?.map((a: any, actIdx: number) => {
        const item = activityToItem(a, trip, targetCityName);
        if (!item.id) item.id = `activity-${day.day_number}-${actIdx}`;
        return item;
      }) || [];

    const itineraryDay = {
      id: day.id || `day-${day.day_number}`,
      dayNumber: day.day_number,
      dateStr: day.date || `Day ${day.day_number}`,
      title: day.title || `Exploring ${targetCityName}`,
      items,
      transitHints: (day as any).transit_hints || undefined,
      // Real month normals from reference data; absent otherwise
      weather: formatWeatherNormal((day as any).weather_normal, day.date),
    };

    const lastSegment = sequentialCities[sequentialCities.length - 1];
    if (lastSegment && lastSegment.cityName.toLowerCase() === targetCityName.toLowerCase()) {
      lastSegment.days.push(itineraryDay);
    } else {
      const baseCity = trip.cities.find(
        (c) => c.name.toLowerCase() === targetCityName.toLowerCase()
      );
      const baseCityIndex = baseCity ? trip.cities.indexOf(baseCity) : sequentialCities.length;

      const transit = (baseCity as any)?.transitToNext;
      let mappedTransit: ItineraryItem | undefined;
      if (transit) {
        const isTransitInactive = transit.is_active === false || transit.status === 'inactive';
        const transitCost: BlockCost | undefined =
          transit.cost && typeof transit.cost === 'object' ? transit.cost : undefined;
        mappedTransit = {
          id: transit.id || `transit-${(baseCity as any).id}`,
          type: transit.type || 'taxi',
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
          originCode: (transit.metadata?.origin_code as string | undefined) || undefined,
          destinationCode: (transit.metadata?.destination_code as string | undefined) || undefined,
          isInactive: isTransitInactive,
          _rawActivity: transit,
        } as ItineraryItem;
      }

      const segmentIndex = sequentialCities.length;
      sequentialCities.push({
        id: baseCity?.id ? `${baseCity.id}-seg-${segmentIndex}` : `city-segment-${segmentIndex}`,
        cityName: targetCityName,
        nights: baseCity?.nights || 1,
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
    day.activities?.forEach((a: any) => {
      const isBooked = a.status === 'booked';
      const cat = (a.category || '').toLowerCase();
      if (cat === 'hotel' && isBooked) hasConfirmedHotel = true;
      if (['flight', 'train', 'bus', 'cab', 'taxi', 'transit'].includes(cat) && isBooked) {
        hasConfirmedTransport = true;
      }
    });
  });

  trip.cities.forEach((city: any) => {
    if (city.transitToNext && city.transitToNext.status === 'booked') {
      hasConfirmedTransport = true;
    }
  });

  // Segment metadata post-processing
  sequentialCities.forEach((segment, idx) => {
    segment.nights = Math.max(segment.days.length, 1);
    const firstDay = segment.days[0];
    const lastDay = segment.days[segment.days.length - 1];
    if (firstDay && lastDay) {
      segment.dateRange =
        firstDay.dateStr === lastDay.dateStr
          ? firstDay.dateStr
          : `${firstDay.dateStr} to ${lastDay.dateStr}`;
    }
    if (idx === sequentialCities.length - 1) {
      delete segment.transitToNext;
    }
  });

  const firstBackendCity: any = trip.cities[0];
  const lastBackendCity: any = trip.cities[trip.cities.length - 1];

  return {
    title: trip.title || 'Your Generated Trip',
    stats,
    travelers,
    budget: trip.total_budget
      ? { amount: Number(trip.total_budget), currency: trip.currency_code }
      : null,
    startDate: firstBackendCity?.arrival_date || '',
    endDate: lastBackendCity?.departure_date || '',
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
      date: day.dateStr,
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
      nights: city.nights,
      arrival_date: firstDay?.dateStr || '',
      departure_date: lastDay?.dateStr || '',
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

  let date = new Date().toISOString().split('T')[0]!;
  if (dayDateStr) {
    const parsed = new Date(dayDateStr);
    if (!isNaN(parsed.getTime())) {
      date = parsed.toISOString().split('T')[0]!;
    } else {
      // Legacy day labels like "12 Aug" lack a year — assume the current one
      const withYear = new Date(`${dayDateStr} ${new Date().getFullYear()}`);
      if (!isNaN(withYear.getTime())) date = withYear.toISOString().split('T')[0]!;
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
