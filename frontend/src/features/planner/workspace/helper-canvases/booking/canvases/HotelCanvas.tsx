'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BedDouble, Calendar, Users, Info, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { referenceService, type ExploreSource } from '@/services/reference.service';
import { TripContext } from '../../../types';
import CanvasSearchToolbar from '../../shared/CanvasSearchToolbar';
import SortFilterPopover from '../../shared/SortFilterPopover';
import { TierBadge } from '../../shared/ExploreStatusUI';
import { CanvasErrorCard, classifyFetchErrorVariant, type CanvasErrorVariant } from '../../shared/CanvasErrorCard';
import { ItineraryItem, Suggestion } from '../../../plan-canvas/types';
import HotelCard from './hotel/HotelCard';
import HotelDetailSections from './hotel/HotelDetailSections';
import HotelCardSkeleton from './hotel/HotelCardSkeleton';
import { DEFAULT_HOTEL_FILTERS, isFiltersDefault, type HotelFilters } from './hotel/HotelFilterSheet';
import { computeItineraryImpact, type ItineraryImpact } from './hotel/itineraryImpact';
import { computeTripFit } from './hotel/tripFit';
import { addDaysToISO } from '@/lib/utils';

interface HotelCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem, options?: { thenBook?: boolean }) => void;
}

const QUICK_FILTER_TAGS = ['All', '4+ Stars', 'Budget', 'Premium'];
const PRICE_TIER_RANK: Record<string, number> = { $: 1, $$: 2, $$$: 3, $$$$: 4 };
const TIER_LABELS = ['$', '$$', '$$$', '$$$$'];

export default function HotelCanvas({ onClose, tripContext, onAddToPlan }: HotelCanvasProps) {
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination;
  const [searchQuery, setSearchQuery] = useState(defaultLocation ? `${defaultLocation}, India` : '');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<HotelFilters>(DEFAULT_HOTEL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['All']);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);

  const [canvasMode, setCanvasMode] = useState<'compare' | 'decide'>('compare');
  const [listScrollTop, setListScrollTop] = useState(0);
  const listScrollContainerRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedData, setSelectedData] = useState<Suggestion | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [results, setResults] = useState<Suggestion[]>([]);
  const [source, setSource] = useState<ExploreSource | null>(null);
  const [fetchError, setFetchError] = useState<CanvasErrorVariant | null>(null);
  const [isCommitSuccess, setIsCommitSuccess] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : '');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  const fetchHotels = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setSource(null);
      setFetchError(null);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const loc = tripContext.activeNodeCityName || tripContext.destination;
      const useCoords = loc && query.toLowerCase().includes(loc.toLowerCase());
      const { results: data, source: src } = await referenceService.exploreHotels(
        query,
        useCoords ? tripContext.activeNodeLatitude : undefined,
        useCoords ? tripContext.activeNodeLongitude : undefined
      );
      setResults(data);
      setSource(src);
    } catch (err: any) {
      console.error('Error fetching hotels:', err?.message || err);
      setResults([]);
      setSource(null);
      setFetchError(classifyFetchErrorVariant(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHotels(searchQuery); }, [searchQuery]);

  // Stay length defaults to how many nights the itinerary already spends in
  // this city (auto), but the traveler can override it — e.g. arriving a day
  // early or extending a stay beyond the rest of the plan. Resets back to
  // auto whenever the active city context changes underneath the canvas.
  const [nightsOverride, setNightsOverride] = useState<number | null>(null);
  useEffect(() => {
    setNightsOverride(null);
  }, [tripContext.activeNodeCityId, tripContext.activeNodeCityName]);

  const stayContext = useMemo(() => {
    const range = tripContext.activeNodeCityDateRange;
    const [checkIn, autoCheckOut] = range ? range.split(' to ') : [tripContext.activeNodeDateStr || tripContext.startDate, undefined];
    const autoNights = tripContext.activeNodeCityNights;
    const nights = nightsOverride ?? autoNights;
    const checkOut = nightsOverride != null
      ? addDaysToISO(checkIn, nightsOverride) ?? autoCheckOut ?? checkIn
      : (autoCheckOut || checkIn);
    return {
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      nights,
      autoNights,
      isOverridden: nightsOverride != null && nightsOverride !== autoNights,
      guests: tripContext.travellers || 1,
    };
  }, [tripContext.activeNodeCityDateRange, tripContext.activeNodeDateStr, tripContext.startDate, tripContext.activeNodeCityNights, tripContext.travellers, nightsOverride]);

  const plannedTitles = useMemo(
    () => new Set((tripContext.activeDayItemTitles || []).map(t => t.trim().toLowerCase())),
    [tripContext.activeDayItemTitles]
  );

  const currentHotelImpact: ItineraryImpact | null = useMemo(() => {
    if (tripContext.activeNodeType !== 'hotel') return null;
    return computeItineraryImpact(tripContext.activeNodeLatitude, tripContext.activeNodeLongitude, tripContext.activeCityItems);
  }, [tripContext.activeNodeType, tripContext.activeNodeLatitude, tripContext.activeNodeLongitude, tripContext.activeCityItems]);

  const impactsById = useMemo(() => {
    const map = new Map<number, ItineraryImpact | null>();
    results.forEach((h) => map.set(h.id, computeItineraryImpact(h.latitude, h.longitude, tripContext.activeCityItems)));
    return map;
  }, [results, tripContext.activeCityItems]);

  const fitsById = useMemo(() => {
    const allImpacts = results.map((h) => impactsById.get(h.id) ?? null);
    const map = new Map<number, ReturnType<typeof computeTripFit>>();
    results.forEach((h) => {
      map.set(h.id, computeTripFit(h, impactsById.get(h.id) ?? null, currentHotelImpact, allImpacts, results));
    });
    return map;
  }, [results, impactsById, currentHotelImpact]);

  const tagFiltered = useMemo(() => {
    if (selectedTags.length === 0 || selectedTags.includes('All')) return results;
    return results.filter(h => selectedTags.every(tag => {
      if (tag === '4+ Stars') return (h.rating ?? 0) >= 4;
      if (tag === 'Budget') return h.details.price_range === '$' || h.details.price_range === '$$';
      if (tag === 'Premium') return h.details.price_range === '$$$' || h.details.price_range === '$$$$';
      return true;
    }));
  }, [results, selectedTags]);

  const sheetFiltered = useMemo(() => {
    if (isFiltersDefault(filters)) return tagFiltered;
    return tagFiltered.filter((h) => {
      const tier = h.details?.price_range ? PRICE_TIER_RANK[h.details.price_range] : undefined;
      if (tier != null && tier > filters.maxPriceTier) return false;
      if (filters.minRating > 0 && (h.rating ?? 0) < filters.minRating) return false;
      if (filters.minTripFit > 0 && (fitsById.get(h.id)?.score ?? 0) < filters.minTripFit) return false;
      if (filters.familyFriendly && !h.details?.good_for_children) return false;
      if (filters.propertyTypes.length > 0 && !filters.propertyTypes.includes(h.subtitle)) return false;
      return true;
    });
  }, [tagFiltered, filters, fitsById]);

  const visibleResults = useMemo(
    () =>
      sheetFiltered
        .filter(h => !plannedTitles.has(h.name.trim().toLowerCase()))
        .slice()
        .sort((a, b) => (fitsById.get(b.id)?.score ?? 0) - (fitsById.get(a.id)?.score ?? 0)),
    [sheetFiltered, plannedTitles, fitsById]
  );

  useEffect(() => {
    if (selectedId != null && !visibleResults.some(h => h.id === selectedId)) {
      setSelectedId(null);
      setCanvasMode('compare');
    }
  }, [visibleResults, selectedId]);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    setDetailsLoading(true);
    (async () => {
      try {
        const resp = await queryClient.fetchQuery({
          queryKey: ['place-details', 'hotel', selectedId],
          queryFn: () => referenceService.getHotelDetails(selectedId),
          staleTime: 30 * 60_000,
        });
        if (!cancelled) setSelectedData(resp);
      } catch (err) {
        console.error('Error fetching hotel details:', err);
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, queryClient]);

  const togglePin = (id: number) => {
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev));
  };

  const handleSelectRecommendation = (id: number) => {
    const el = listScrollContainerRef.current;
    if (el) {
      setListScrollTop(el.scrollTop);
    }
    setSelectedId(id);
    setCanvasMode('decide');
  };

  // Restore scroll height on returning to recommendations list view
  useEffect(() => {
    if (canvasMode === 'compare') {
      const el = listScrollContainerRef.current;
      if (el && listScrollTop > 0) {
        requestAnimationFrame(() => {
          el.scrollTop = listScrollTop;
        });
      }
    }
  }, [canvasMode, listScrollTop]);

  const handleSelectHotel = (hotel: Suggestion) => {
    if (!onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `hotel-${hotel.id}-${Date.now()}`,
      type: 'hotel',
      startTime: '14:00',
      title: hotel.name,
      subtitle: hotel.address || '',
      details: hotel.subtitle,
      status: 'Pending',
      rating: hotel.rating != null ? Math.round(hotel.rating * 10) / 10 : undefined,
      geoTag: tripContext.activeNodeCityName || tripContext.destination || '',
      image: hotel.image_url || undefined,
      latitude: hotel.latitude ?? undefined,
      longitude: hotel.longitude ?? undefined,
      place_id: hotel.place_id ?? undefined,
      cost: hotel.cost,
      stayNights: stayContext.nights,
      checkIn: stayContext.checkIn,
      checkOut: stayContext.checkOut,
    };
    onAddToPlan(newItem);
    
    // Trigger commitment success reward
    setIsCommitSuccess(true);
    setTimeout(() => {
      setIsCommitSuccess(false);
      if (onClose) onClose();
    }, 1200);
  };

  const activeFilterCount = (filters.propertyTypes.length > 0 ? 1 : 0) + [filters.maxPriceTier < 4, filters.minRating > 0, filters.minTripFit > 0, filters.familyFriendly].filter(Boolean).length + (selectedTags.length === 1 && selectedTags[0] === 'All' ? 0 : 1);

  const addedMessage = tripContext.activeNodeDayLabel
    ? `Added to ${tripContext.activeNodeDayLabel}`
    : 'Added to your plan';


  const propertyTypes = Array.from(new Set(results.map((h) => h.subtitle).filter(Boolean))) as string[];
  const setFilter = <K extends keyof HotelFilters>(key: K, value: HotelFilters[K]) => setFilters({ ...filters, [key]: value });

  const selectedHotel = visibleResults.find((h) => h.id === selectedId) ?? null;
  const selectedHotelMerged = selectedHotel && selectedData?.id === selectedId
    ? { ...selectedHotel, details: { ...selectedHotel.details, ...selectedData.details } }
    : selectedHotel;

  return (
    <div className="helper-canvas-premium flex h-full flex-col bg-paper-0 relative overflow-hidden select-none">
      
      {/* Commitment Success Overlay */}
      <AnimatePresence>
        {isCommitSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-paper-1/95 p-6 text-center select-none"
          >
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
              <Check size={24} strokeWidth={3} />
            </div>
            <h3 className="text-lg font-bold text-ink-900">{addedMessage}</h3>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {canvasMode === 'compare' ? (
          <motion.div
            key="compare-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full"
          >
            <div className="relative shrink-0">
              <CanvasSearchToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isSearchFocused={isSearchFocused}
                onFocusChange={setIsSearchFocused}
                activeFilterCount={activeFilterCount}
                onOpenFilter={() => setFilterOpen(true)}
                onClose={onClose}
                accentClassName="focus:border-cat-stay focus:ring-cat-stay/15"
              />
              <SortFilterPopover
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                showReset={activeFilterCount > 0}
                onReset={() => { setFilters(DEFAULT_HOTEL_FILTERS); setSelectedTags(['All']); }}
              >
                <div className="mb-4">
                  <p className="text-micro mb-2">Quick filters</p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_FILTER_TAGS.map(tag => {
                      const isActive = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => setSelectedTags(prev => tag === 'All' ? ['All'] : prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev.filter(t => t !== 'All'), tag])}
                          className={`rounded-full border px-2.5 py-1 text-[10.5px] font-bold cursor-pointer ${
                            isActive ? 'border-cat-stay bg-cat-stay text-white' : 'border-line bg-paper-1 text-ink-600 hover:border-cat-stay/40'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-ink-600">
                      <span>Budget tier</span>
                      <span className="tabular-nums text-ink-900">up to {TIER_LABELS[filters.maxPriceTier - 1]}</span>
                    </div>
                    <input type="range" min={1} max={4} step={1} value={filters.maxPriceTier} onChange={(e) => setFilter('maxPriceTier', Number(e.target.value))} className="h-8 w-full accent-cat-stay" aria-label="Maximum budget tier" />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-ink-600">
                      <span>Minimum rating</span>
                      <span className="tabular-nums text-ink-900">{filters.minRating === 0 ? 'Any' : `${filters.minRating}★+`}</span>
                    </div>
                    <input type="range" min={0} max={4.5} step={0.5} value={filters.minRating} onChange={(e) => setFilter('minRating', Number(e.target.value))} className="h-8 w-full accent-cat-stay" aria-label="Minimum rating" />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-ink-600">
                      <span>Minimum Trip Fit</span>
                      <span className="tabular-nums text-ink-900">{filters.minTripFit === 0 ? 'Any' : `${filters.minTripFit}%+`}</span>
                    </div>
                    <input type="range" min={0} max={90} step={10} value={filters.minTripFit} onChange={(e) => setFilter('minTripFit', Number(e.target.value))} className="h-8 w-full accent-cat-stay" aria-label="Minimum Trip Fit score" />
                  </div>

                  <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-xs font-semibold text-ink-700">
                    <input type="checkbox" checked={filters.familyFriendly} onChange={(e) => setFilter('familyFriendly', e.target.checked)} className="h-4 w-4 accent-cat-stay" />
                    Family-friendly
                  </label>

                  {propertyTypes.length > 1 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-semibold text-ink-600">Property type</p>
                      <div className="flex flex-wrap gap-2">
                        {propertyTypes.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setFilter('propertyTypes', filters.propertyTypes.includes(t) ? filters.propertyTypes.filter((x) => x !== t) : [...filters.propertyTypes, t])}
                            className={`min-h-[32px] rounded-full border px-3 text-xs font-medium capitalize cursor-pointer ${
                              filters.propertyTypes.includes(t) ? 'border-cat-stay bg-cat-stay text-white' : 'border-line bg-paper-2 text-ink-600 hover:border-cat-stay/40'
                            }`}
                          >
                            {t.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </SortFilterPopover>
            </div>

            {/* Your Stay — a distinct section so check-in/check-out reads as
                a decision, not a caption. Nights defaults to how long the
                itinerary already spends in this city; the stepper lets the
                traveler book fewer/more nights than the plan currently has. */}
            <div className="border-b border-line bg-cat-stay/5 px-4 py-2.5 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-3">
                  {stayContext.checkIn && (
                    <div className="flex items-center gap-1.5 text-caption font-semibold text-ink-700">
                      <Calendar size={12} className="text-cat-stay shrink-0" />
                      <span>
                        <span className="text-ink-400">Check-in</span> {stayContext.checkIn}
                      </span>
                      {stayContext.checkOut && stayContext.checkOut !== stayContext.checkIn && (
                        <>
                          <span className="text-ink-300">→</span>
                          <span>
                            <span className="text-ink-400">Check-out</span> {stayContext.checkOut}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                  <span className="flex items-center gap-1.5 text-caption font-semibold text-ink-700">
                    <Users size={12} className="text-cat-stay shrink-0" />
                    {stayContext.guests} guest{stayContext.guests === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {stayContext.isOverridden && (
                    <button
                      type="button"
                      onClick={() => setNightsOverride(null)}
                      className="text-[10px] font-semibold text-cat-stay hover:underline cursor-pointer"
                    >
                      Reset to {stayContext.autoNights} night{stayContext.autoNights === 1 ? '' : 's'}
                    </button>
                  )}
                  <div className="flex items-center rounded-full border border-line bg-paper-1 shadow-xs">
                    <button
                      type="button"
                      aria-label="One fewer night"
                      disabled={(stayContext.nights ?? 1) <= 1}
                      onClick={() => setNightsOverride(Math.max(1, (stayContext.nights ?? stayContext.autoNights ?? 1) - 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-500 hover:bg-paper-2 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      −
                    </button>
                    <span className="min-w-[64px] text-center text-caption font-bold tabular-nums text-ink-900">
                      {stayContext.nights ?? '—'} night{stayContext.nights === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      aria-label="One more night"
                      onClick={() => setNightsOverride(Math.min(30, (stayContext.nights ?? stayContext.autoNights ?? 1) + 1))}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-500 hover:bg-paper-2 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-ink-400" title="HotelMaster listings don't carry a live nightly rate yet.">
                <Info size={10} /> No live rate yet
              </div>
            </div>

            {loading ? (
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <HotelCardSkeleton />
                <HotelCardSkeleton />
                <HotelCardSkeleton />
              </div>
            ) : fetchError ? (
              <CanvasErrorCard variant={fetchError} onRetry={() => fetchHotels(searchQuery)} />
            ) : visibleResults.length > 0 ? (
              <div ref={listScrollContainerRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-ink-500">
                  {visibleResults.length} hotel{visibleResults.length === 1 ? '' : 's'} — best fit for your trip first
                  {source && <TierBadge source={source} />}
                </p>
                <div role="list" aria-label="Hotel results" className="flex flex-col gap-3">
                  {visibleResults.map((hotel, i) => (
                    <div key={hotel.id} role="listitem" aria-setsize={visibleResults.length} aria-posinset={i + 1}>
                      <HotelCard
                        hotel={hotel}
                        fit={fitsById.get(hotel.id)!}
                        impact={impactsById.get(hotel.id) ?? null}
                        isPending={false}
                        onSelect={() => handleSelectRecommendation(hotel.id)}
                        onAdd={() => handleSelectHotel(hotel)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="m-4 rounded-xl border border-line bg-paper-1 p-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cat-stay/10"><BedDouble size={24} className="text-cat-stay" /></div>
                <p className="text-sm font-semibold text-ink-700">No hotels found{tripContext.destination ? ` near ${tripContext.destination}` : ''}</p>
                {!isFiltersDefault(filters) && (
                  <button type="button" onClick={() => setFilters(DEFAULT_HOTEL_FILTERS)} className="mt-2 text-xs font-semibold text-cat-stay hover:underline">
                    Clear filters
                  </button>
                )}
              </div>
            )}

          </motion.div>
        ) : (
          <motion.div
            key="decide-detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            {selectedHotelMerged && (
              <HotelDetailSections
                hotel={selectedHotelMerged}
                expandedDetails={selectedData?.id === selectedHotelMerged.id ? selectedData : null}
                detailsLoading={detailsLoading}
                fit={fitsById.get(selectedHotelMerged.id)!}
                isPending={false}
                isCompared={pinnedIds.includes(selectedHotelMerged.id)}
                onSelect={() => handleSelectHotel(selectedHotelMerged)}
                onCompareToggle={() => togglePin(selectedHotelMerged.id)}
                onBack={() => { setCanvasMode('compare'); setSelectedId(null); }}
                tripContext={tripContext}
                stayContext={stayContext}
                onNightsChange={setNightsOverride}
                onResetNights={() => setNightsOverride(null)}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
