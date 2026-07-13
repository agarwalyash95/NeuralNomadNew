'use client';

import React, { FormEvent, useState, useEffect, useRef } from 'react';
import { Plane, Search } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import FlightSearchForm from '../forms/FlightSearchForm';
import { searchService } from '@/services/search.service';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';
import ReplaceConfirmBar from '../../shared/ReplaceConfirmBar';
import { ItineraryItem, CostProvenance } from '../../../plan-canvas/types';
import { ProvenanceBadge } from '../../../../components/ProvenanceBadge';
import CurrentlyBookedCard from '../../shared/CurrentlyBookedCard';
import { useTransportPreference } from '@/features/planner/hooks/usePlannerQueries';
import { CanvasErrorCard, classifyFetchErrorVariant, type CanvasErrorVariant } from '../../shared/CanvasErrorCard';
import { LiveSearchProgress, LiveResultsBadge, useLiveSearchPhases, useTierEscalation } from '../../shared/LiveSearchProgress';
import FlightCardSkeleton from './FlightCardSkeleton';

const FLIGHT_SEARCH_PHASES = [
  { key: 'search', label: 'Searching flight inventory' },
  { key: 'fares', label: 'Checking fares & seat availability' },
  { key: 'finalize', label: 'Finalizing results' },
];

interface FlightCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem, options?: { thenBook?: boolean }) => void;
}

const QUICK_FILTER_TAGS = ['Cheapest', 'Fastest', 'Morning', 'Evening', 'Non-stop'];

/** Defensive fallback only — fetchFlights always stamps a real per-result
 *  provenance (provider name or 'Inventory search'), never this constant. */
const RESULT_PROVENANCE: CostProvenance = { tier: 'suggested', source: 'Inventory search', basis: 'Not yet price-verified' };

function buildInitialParams(ctx: TripContext): BookingSearchParams {
  let origin = 'Delhi (DEL)';
  let destination = ctx.destination ? `${ctx.destination} / Bhuntar (KUU)` : 'Mumbai (BOM)';

  if (ctx.activeNodeCityName && ctx.allCities && ctx.allCities.length > 0) {
    const idx = ctx.allCities.indexOf(ctx.activeNodeCityName);
    if (idx !== -1) {
      origin = ctx.activeNodeCityName;
      if (idx + 1 < ctx.allCities.length) {
        destination = ctx.allCities[idx + 1] || '';
      }
    }
  }

  const textToParse = (ctx.activeNodeSubtitle || ctx.activeNodeTitle || '').toLowerCase();
  if (textToParse.includes(' to ')) {
    const parts = (ctx.activeNodeSubtitle || ctx.activeNodeTitle || '').split(/ to /i);
    if (parts.length >= 2) {
      let possibleOrigin = (parts[0] || '').trim();
      if (possibleOrigin.toLowerCase().includes('from ')) {
        possibleOrigin = (possibleOrigin.split(/from /i).pop() || '').trim();
      }
      if (possibleOrigin) origin = possibleOrigin;
      destination = ((parts[1] || '').split(' • ')[0] || '').trim();
    }
  }

  return {
    service: 'flight',
    tripType: 'one-way',
    origin: origin,
    destination: destination,
    departureDate: ctx.activeNodeDateStr || ctx.startDate || '',
    returnDate: '',
    travellers: String(ctx.travellers || 2),
    cabinClass: 'Economy',
    fareType: 'Regular',
    city: '',
    checkIn: '',
    checkOut: '',
    roomCount: '1',
    nationality: 'Indian',
    trainClass: 'SL',
    quota: 'General',
    cabType: 'airport',
    pickup: '',
    drop: '',
  };
}

function updateParam(
  setParams: React.Dispatch<React.SetStateAction<BookingSearchParams>>,
  field: keyof BookingSearchParams,
  value: string
) {
  setParams(current => ({ ...current, [field]: value }));
}

export default function FlightCanvas({ onClose, tripContext, onAddToPlan }: FlightCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(() => buildInitialParams(tripContext));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [fetchError, setFetchError] = useState<CanvasErrorVariant | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Cheapest']);
  const [pendingItem, setPendingItem] = useState<any | null>(null);
  /** 'trip' = plan the flight; 'booking' = price it and go straight to Checkout */
  const [pendingAction, setPendingAction] = useState<'trip' | 'booking'>('trip');
  const [wasLiveSearch, setWasLiveSearch] = useState(false);

  // No backend tier signal exists for this DB-backed search (unlike explore's
  // cache/google_places source) — escalate from skeleton to phased progress
  // purely on elapsed time, and only claim "live" on the resolved badge when
  // that escalation actually happened, never a fabricated cache/live split.
  const escalated = useTierEscalation(loading);
  const escalatedRef = useRef(false);
  useEffect(() => { escalatedRef.current = escalated; }, [escalated]);
  const { activeIndex, elapsedMs } = useLiveSearchPhases(loading && escalated, FLIGHT_SEARCH_PHASES.length);

  // Re-prefill if trip context changes
  useEffect(() => {
    setParams(buildInitialParams(tripContext));
  }, [tripContext.tripId]);

  // Cross-trip transport preference (set once in the header kebab) seeds the
  // default sort — a one-time seed, not a forced override of a choice the
  // user already made in this canvas.
  const { data: transportPreference } = useTransportPreference();
  const appliedPreference = useRef(false);
  useEffect(() => {
    if (appliedPreference.current || !transportPreference?.priority) return;
    appliedPreference.current = true;
    if (transportPreference.priority === 'cheapest') setSelectedTags(['Cheapest']);
    else if (transportPreference.priority === 'fastest') setSelectedTags(['Fastest']);
  }, [transportPreference]);

  const fetchFlights = async (searchParams: BookingSearchParams) => {
    setLoading(true);
    setFetchError(null);
    try {
      const apiResults = await searchService.search(searchParams);
      const mapped = apiResults.map((flight) => {
        const cabinClass = flight.meta?.cabin_classes?.[0];
        const providerOffer = flight.providers?.[0];
        // A missing fact renders as absent, never a fabricated default — a
        // made-up "12 seats left" is a scarcity cue that didn't happen, and
        // a made-up ₹4850 enters the ledger as a real number.
        const price = providerOffer?.price ?? cabinClass?.price ?? null;
        const seats = cabinClass?.seats_available != null ? `${cabinClass.seats_available} seats left` : null;
        const baggage = flight.meta?.baggage || null;
        const meal = flight.meta?.meal;
        const getTime = (s: string) => !s ? null : s.includes('T') ? s.split('T')[1]?.slice(0, 5) ?? null : s.slice(0, 5);
        // Provenance reflects what actually produced this price — a real
        // provider quote outranks the reference-table fallback, and "Live
        // search" is never claimed for either.
        const provenance: CostProvenance = providerOffer
          ? { tier: 'estimated', source: providerOffer.provider || 'Provider search', basis: 'Not yet price-verified' }
          : cabinClass
            ? { tier: 'suggested', source: 'Inventory search', basis: 'Reference fare, not a live quote' }
            : { tier: 'suggested', source: 'Inventory search', basis: 'No fare on file' };
        return {
          id: flight.id,
          airline: flight.title,
          logo: (flight as any).logo_url || (flight.meta as any)?.airline_logo || (flight.providers?.[0] as any)?.logo || null,
          flightNumber: flight.code,
          departure: {
            time: getTime(flight.departure_time),
            // Real IATA code only — never the free-text search query or a
            // hardcoded 'DEL' default standing in for an unknown airport.
            airport: flight.origin_code || null,
            city: flight.origin_city || searchParams.origin || 'Origin'
          },
          arrival: {
            time: getTime(flight.arrival_time),
            airport: flight.destination_code || null,
            city: flight.destination_city || searchParams.destination || tripContext.destination || 'Destination'
          },
          duration: flight.duration || null,
          stops: flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop(s)`,
          price,
          class: cabinClass?.class || 'Economy',
          seats,
          baggage,
          meal: meal ? ['Meal'] : [],
          amenities: meal ? ['WiFi', 'Meal'] : ['WiFi'],
          provenance,
        };
      });
      setResults(mapped);
    } catch (err: any) {
      console.error('Error fetching flights:', err?.message || err);
      setResults([]);
      setFetchError(classifyFetchErrorVariant(err));
    } finally {
      setWasLiveSearch(escalatedRef.current);
      setLoading(false);
    }
  };

  useEffect(() => { fetchFlights(params); }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!params.origin.trim() && !params.destination.trim()) {
      setFormError('Enter origin or destination.');
      return;
    }
    setFormError(null);
    setIsSearchExpanded(false);
    await fetchFlights(params);
  };

  const handleSelect = (flight: any, action: 'trip' | 'booking') => {
    setPendingItem(flight);
    setPendingAction(action);
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `flight-${pendingItem.id}-${Date.now()}`,
      type: 'flight',
      startTime: pendingItem.departure.time ?? undefined,
      endTime: pendingItem.arrival.time ?? undefined,
      title: `${pendingItem.airline} ${pendingItem.flightNumber}`,
      subtitle: `${pendingItem.departure.city} to ${pendingItem.arrival.city}`,
      originCode: pendingItem.departure.airport ?? undefined,
      destinationCode: pendingItem.arrival.airport ?? undefined,
      price: pendingItem.price != null ? `₹${pendingItem.price.toLocaleString()}` : undefined,
      status: 'Pending',
      details: [pendingItem.duration, pendingItem.stops, pendingItem.baggage].filter(Boolean).join(' • ') || undefined,
      // "Add to booking" carries a quote the commitment ladder starts from
      blockStatus: pendingAction === 'booking' ? 'priced' : 'planned',
      cost: { amount: pendingItem.price, currency: 'INR', provenance: pendingItem.provenance ?? RESULT_PROVENANCE },
    };
    onAddToPlan(newItem, { thenBook: pendingAction === 'booking' });
    setPendingItem(null);
  };

  // 'Cheapest'/'Fastest' are sort toggles, not predicates — a flight can't be
  // excluded for being expensive, only ranked lower. Everything else filters.
  const filteredResults = results
    .filter(f => {
      if (selectedTags.length === 0) return true;
      return selectedTags.every(tag => {
        if (tag === 'Non-stop') return f.stops === 'Non-stop';
        if (tag === 'Morning') return parseInt(f.departure.time) < 12;
        if (tag === 'Evening') return parseInt(f.departure.time) >= 17;
        return true;
      });
    })
    .sort((a, b) => {
      // Unknown price/duration sorts last, never treated as 0/cheapest.
      if (selectedTags.includes('Cheapest')) return (a.price ?? Infinity) - (b.price ?? Infinity);
      if (selectedTags.includes('Fastest')) return (parseInt(a.duration || '') || Infinity) - (parseInt(b.duration || '') || Infinity);
      return 0;
    });

  const searchSummary = `${params.origin} → ${params.destination}`;
  const searchSecondary = [params.departureDate, `${params.travellers} traveller(s)`, params.cabinClass].filter(Boolean).join(' • ');

  return (
    <div className="flex h-full flex-col bg-paper-1">
      <CanvasHeader
        icon={<Plane size={18} />}
        iconColor="bg-blue-600"
        label="Flights"
        title={searchSummary}
        tripContext={tripContext}
        onClose={onClose}
      />
      <CurrentlyBookedCard tripContext={tripContext} nodeType="flight" />

      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar
            primary={searchSummary}
            secondary={searchSecondary}
            accentColor="group-hover:text-blue-600"
            onClick={() => setIsSearchExpanded(true)}
          >
            <QuickFilterBar
              tags={QUICK_FILTER_TAGS}
              selected={selectedTags}
              activeColor="border-blue-600 bg-blue-600 text-white shadow-surface"
              hoverColor="border-line bg-paper-2 text-ink-500 hover:border-blue-300 hover:bg-blue-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
            />
          </SearchSummaryBar>
        )}

        {isSearchExpanded && (
          <div className="border-b border-line bg-paper-2 p-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-title">Edit Search</h3>
                <button type="button" onClick={() => setIsSearchExpanded(false)} className="text-caption font-semibold text-ink-500 hover:text-ink-700">Cancel</button>
              </div>
              <FlightSearchForm params={params} onUpdateParam={(field, value) => updateParam(setParams, field, value)} />
              {formError && <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-caption font-semibold text-red-600"><div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />{formError}</div>}
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-body font-semibold text-white transition-all duration-[var(--motion-hover)] ease-[var(--ease-out)] hover:bg-blue-700 disabled:opacity-50">
                {loading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Searching...</> : <><Search size={16} />Update Search</>}
              </button>
            </form>
          </div>
        )}

        <div className="p-4">
          {loading && !escalated ? (
            <div className="space-y-3">
              {Array.from({ length: Math.min(results.length || 3, 6) }).map((_, i) => (
                <FlightCardSkeleton key={i} />
              ))}
            </div>
          ) : loading && escalated ? (
            <LiveSearchProgress phases={FLIGHT_SEARCH_PHASES} activeIndex={activeIndex} elapsedMs={elapsedMs} />
          ) : fetchError ? (
            <CanvasErrorCard variant={fetchError} onRetry={() => fetchFlights(params)} />
          ) : filteredResults.length > 0 ? (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-caption font-semibold">
                {filteredResults.length} flights found
                {wasLiveSearch && <LiveResultsBadge />}
              </p>
              {filteredResults.map((flight) => (
                <div
                  key={flight.id}
                  className={`group overflow-hidden rounded-2xl border bg-paper-2 shadow-surface transition-all duration-[var(--motion-card)] ease-[var(--ease-out)] hover:shadow-hover ${pendingItem?.id === flight.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-line hover:border-blue-300'}`}
                >
                  <div className="p-4 pb-3">
                    {/* Airline identity + price */}
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {flight.logo ? (
                          <img src={flight.logo} alt={flight.airline} className="h-8 w-8 shrink-0 rounded-lg border border-line object-contain p-0.5" />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-caption font-bold !text-blue-700">
                            {String(flight.airline || '?').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-body font-semibold !text-ink-900">{flight.airline}</p>
                          <p className="text-caption font-medium">
                            {flight.flightNumber}
                            {flight.class && <span className="ml-1.5 rounded-sm bg-paper-0 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-ink-500">{flight.class}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold tabular-nums text-ink-900">
                          {flight.price != null ? `₹${flight.price.toLocaleString()}` : 'Price on request'}
                        </p>
                        <p className="-mt-0.5 text-caption !text-ink-400">{flight.price != null ? 'per person' : ''}</p>
                      </div>
                    </div>

                    {/* Route timeline */}
                    <div className="flex items-center gap-3">
                      <div className="shrink-0">
                        <p className="text-base font-bold tabular-nums text-ink-900">{flight.departure.time || '--:--'}</p>
                        <p className="text-caption font-semibold">{flight.departure.airport || flight.departure.city}</p>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col items-center">
                        <p className="text-caption font-bold !text-ink-400">{flight.duration || 'Duration TBD'}</p>
                        <div className="relative my-1 h-px w-full bg-line-strong">
                          <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full border border-line-strong bg-paper-2" />
                          <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-blue-600" />
                        </div>
                        <p className={`text-caption font-bold ${flight.stops === 'Non-stop' ? '!text-trust-verified' : '!text-ink-400'}`}>{flight.stops}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-bold tabular-nums text-ink-900">{flight.arrival.time || '--:--'}</p>
                        <p className="text-caption font-semibold">{flight.arrival.airport || flight.arrival.city}</p>
                      </div>
                    </div>

                    {/* Fact chips — a missing fact simply doesn't render a chip */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {flight.baggage && (
                        <span className="rounded-full border border-line bg-paper-1 px-2 py-0.5 text-caption font-bold">🧳 {flight.baggage}</span>
                      )}
                      {flight.seats && (
                        <span className="rounded-full border border-line bg-paper-1 px-2 py-0.5 text-caption font-bold">{flight.seats}</span>
                      )}
                      {flight.meal?.length > 0 && (
                        <span className="rounded-full border border-line bg-paper-1 px-2 py-0.5 text-caption font-bold">🍽 Meal</span>
                      )}
                      <span className="ml-auto"><ProvenanceBadge provenance={flight.provenance} /></span>
                    </div>
                  </div>

                  {/* Split action row */}
                  <div className="flex border-t border-line">
                    <button
                      onClick={() => handleSelect(flight, 'trip')}
                      className={`flex-1 cursor-pointer py-2 text-xs font-bold transition-colors duration-[var(--motion-hover)] ease-[var(--ease-out)] ${
                        pendingItem?.id === flight.id && pendingAction === 'trip'
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-ink-700 hover:bg-paper-1'
                      }`}
                    >
                      {pendingItem?.id === flight.id && pendingAction === 'trip' ? '✓ Adding to trip' : '+ Add to trip'}
                    </button>
                    <div className="w-px bg-line" />
                    <button
                      onClick={() => handleSelect(flight, 'booking')}
                      className={`flex-1 cursor-pointer py-2 text-xs font-bold transition-colors duration-[var(--motion-hover)] ease-[var(--ease-out)] ${
                        pendingItem?.id === flight.id && pendingAction === 'booking'
                          ? 'bg-blue-700 text-white'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {pendingItem?.id === flight.id && pendingAction === 'booking' ? '✓ Booking…' : 'Add to booking'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-paper-1 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-line"><Plane size={24} className="text-ink-400" /></div>
              <p className="text-body font-semibold text-ink-700">No flights found</p>
              <p className="mt-1 text-caption">Try adjusting your search or check the backend inventory</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Replace Confirmation Bar */}
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar
          newItemTitle={`${pendingItem.airline} ${pendingItem.flightNumber}`}
          newItemPrice={pendingItem.price != null ? `₹${pendingItem.price.toLocaleString()}` : undefined}
          tripContext={tripContext}
          confirmColor="bg-blue-600 hover:bg-blue-700"
          confirmLabel={pendingAction === 'booking' ? 'Add & go to Checkout' : 'Add to trip'}
          onCancel={() => setPendingItem(null)}
          onConfirm={handleConfirmReplace}
        />
      )}
    </div>
  );
}
