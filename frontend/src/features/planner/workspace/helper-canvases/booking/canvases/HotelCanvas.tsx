'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BedDouble, Calendar, Users, Info, SlidersHorizontal } from 'lucide-react';
import { referenceService } from '@/services/reference.service';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';
import { ItineraryItem, Suggestion } from '../../../plan-canvas/types';
import HotelCard from './hotel/HotelCard';
import HotelCardSkeleton from './hotel/HotelCardSkeleton';
import HotelCompareTray from './hotel/HotelCompareTray';
import HotelConfirmBar from './hotel/HotelConfirmBar';
import HotelFilterSheet, { DEFAULT_HOTEL_FILTERS, isFiltersDefault, type HotelFilters } from './hotel/HotelFilterSheet';
import { computeItineraryImpact, minutesSavedVsCurrent, type ItineraryImpact } from './hotel/itineraryImpact';
import { computeTripFit } from './hotel/tripFit';

interface HotelCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem, options?: { thenBook?: boolean }) => void;
}

const QUICK_FILTER_TAGS = ['All', '4+ Stars', 'Budget', 'Premium'];
const PRICE_TIER_RANK: Record<string, number> = { $: 1, $$: 2, $$$: 3, $$$$: 4 };

export default function HotelCanvas({ onClose, tripContext, onAddToPlan }: HotelCanvasProps) {
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination;
  const [searchQuery, setSearchQuery] = useState(defaultLocation ? `${defaultLocation}, India` : '');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filters, setFilters] = useState<HotelFilters>(DEFAULT_HOTEL_FILTERS);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['All']);
  const [pendingItem, setPendingItem] = useState<Suggestion | null>(null);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);

  // Accordion state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<Suggestion | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [results, setResults] = useState<Suggestion[]>([]);

  const queryClient = useQueryClient();

  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : '');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  const fetchHotels = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const loc = tripContext.activeNodeCityName || tripContext.destination;
      const useCoords = loc && query.toLowerCase().includes(loc.toLowerCase());
      const data = await referenceService.exploreHotels(
        query,
        useCoords ? tripContext.activeNodeLatitude : undefined,
        useCoords ? tripContext.activeNodeLongitude : undefined
      );
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching hotels:', err?.message || err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHotels(searchQuery); }, [searchQuery]);

  // Stay-context: the decision facts a hotel card alone can't carry — real
  // dates/nights/guests derived from the trip's own city segment, never a
  // guess. HotelMaster has no live nightly rate yet (see suggestions.py
  // _hotel_fields) — that's stated honestly below rather than simulating a
  // "checking rates..." step with a foregone unavailable result.
  const stayContext = useMemo(() => {
    const range = tripContext.activeNodeCityDateRange;
    const [checkIn, checkOut] = range ? range.split(' to ') : [tripContext.activeNodeDateStr || tripContext.startDate, undefined];
    return {
      checkIn: checkIn || undefined,
      checkOut: checkOut || checkIn || undefined,
      nights: tripContext.activeNodeCityNights,
      guests: tripContext.travellers || 1,
    };
  }, [tripContext.activeNodeCityDateRange, tripContext.activeNodeDateStr, tripContext.startDate, tripContext.activeNodeCityNights, tripContext.travellers]);

  // Don't recommend what's already planned for the day in view
  const plannedTitles = useMemo(
    () => new Set((tripContext.activeDayItemTitles || []).map(t => t.trim().toLowerCase())),
    [tripContext.activeDayItemTitles]
  );

  const hasItineraryData = (tripContext.activeCityItems?.length ?? 0) > 0;

  // Real coordinates only — the currently-booked hotel's impact, used both
  // for the comparison anchor and every card's "saves N min vs. current".
  const currentHotelImpact: ItineraryImpact | null = useMemo(() => {
    if (tripContext.activeNodeType !== 'hotel') return null;
    return computeItineraryImpact(tripContext.activeNodeLatitude, tripContext.activeNodeLongitude, tripContext.activeCityItems);
  }, [tripContext.activeNodeType, tripContext.activeNodeLatitude, tripContext.activeNodeLongitude, tripContext.activeCityItems]);

  // Per-hotel itinerary impact, computed once against the full raw result
  // set so Trip Fit percentiles stay stable regardless of active filters.
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

  // Best-for-your-trip is the default sort — Trip Fit leads, not rating or price.
  const visibleResults = useMemo(
    () =>
      sheetFiltered
        .filter(h => !plannedTitles.has(h.name.trim().toLowerCase()))
        .slice()
        .sort((a, b) => (fitsById.get(b.id)?.score ?? 0) - (fitsById.get(a.id)?.score ?? 0)),
    [sheetFiltered, plannedTitles, fitsById]
  );

  const toggleExpand = async (suggestion: Suggestion) => {
    if (expandedId === suggestion.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(suggestion.id);
    setExpandedData(null);
    setDetailsLoading(true);
    try {
      const resp = await queryClient.fetchQuery({
        queryKey: ['place-details', 'hotel', suggestion.id],
        queryFn: () => referenceService.getHotelDetails(suggestion.id),
        staleTime: 30 * 60_000,
      });
      setExpandedData(resp);
    } catch (err) {
      console.error('Error fetching hotel details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const togglePin = (id: number) => {
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev));
  };

  const isReplacing = tripContext.activeNodeType === 'hotel' && !!tripContext.activeNodeTitle;

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `hotel-${pendingItem.id}-${Date.now()}`,
      type: 'hotel',
      startTime: '14:00',
      title: pendingItem.name,
      subtitle: pendingItem.address || '',
      details: pendingItem.subtitle,
      status: 'Pending',
      rating: pendingItem.rating != null ? Math.round(pendingItem.rating * 10) / 10 : undefined,
      // A short location tag, not a repeat of `subtitle` (the full address) —
      // GenericNode renders both side by side, so duplicating the address
      // here showed the same string twice.
      geoTag: tripContext.activeNodeCityName || tripContext.destination || '',
      image: pendingItem.image_url || undefined,
      latitude: pendingItem.latitude ?? undefined,
      longitude: pendingItem.longitude ?? undefined,
      place_id: pendingItem.place_id ?? undefined,
      cost: pendingItem.cost,
      // Stay-span: how many of the city segment's days this booking covers,
      // from the real city nights count — not a guess. A single night or
      // unknown span (stayNights <= 1) renders no continuation ribbon.
      stayNights: stayContext.nights,
      checkIn: stayContext.checkIn,
      checkOut: stayContext.checkOut,
    };
    onAddToPlan(newItem);
    setPendingItem(null);
    setExpandedId(null);
  };

  const searchSummary = tripContext.destination ? `Hotels in ${tripContext.destination}` : 'Hotels';
  const activeFilterCount = (filters.propertyTypes.length > 0 ? 1 : 0) + [filters.maxPriceTier < 4, filters.minRating > 0, filters.minTripFit > 0, filters.familyFriendly].filter(Boolean).length;

  const pinnedHotels = pinnedIds
    .map((id) => results.find((h) => h.id === id))
    .filter((h): h is Suggestion => !!h)
    .map((hotel) => ({ hotel, impact: impactsById.get(hotel.id) ?? null, fit: fitsById.get(hotel.id)! }));

  return (
    <div className="flex h-full flex-col bg-paper-0">
      <CanvasHeader
        icon={<BedDouble size={18} />}
        iconColor="bg-cat-stay"
        label="Hotels"
        title={searchSummary}
        tripContext={tripContext}
        onClose={onClose}
      />
      {/* Stay-context bar — real dates/nights/guests from the trip itself,
          so a hotel card doesn't have to guess what it's being booked for. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line bg-cat-stay/5 px-4 py-2.5 text-caption font-semibold">
        {stayContext.checkIn && (
          <span className="flex items-center gap-1.5 text-ink-700">
            <Calendar size={12} className="text-cat-stay" />
            {stayContext.checkIn}{stayContext.checkOut && stayContext.checkOut !== stayContext.checkIn ? ` → ${stayContext.checkOut}` : ''}
            {stayContext.nights ? ` · ${stayContext.nights} night${stayContext.nights === 1 ? '' : 's'}` : ''}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-ink-700">
          <Users size={12} className="text-cat-stay" />
          {stayContext.guests} guest{stayContext.guests === 1 ? '' : 's'}
        </span>
        <span className="ml-auto flex items-center gap-1 text-ink-400" title="HotelMaster listings don't carry a live nightly rate yet — prices need checking with the property directly.">
          <Info size={11} />
          No live rate yet
        </span>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary="Stays near your itinerary" accentColor="group-hover:text-cat-stay" onClick={() => setIsSearchExpanded(true)}>
            <div className="flex items-center justify-between gap-2">
              <QuickFilterBar
                tags={QUICK_FILTER_TAGS}
                selected={selectedTags}
                activeColor="border-cat-stay bg-cat-stay text-white shadow-sm"
                hoverColor="border-line bg-paper-2 text-ink-600 hover:border-cat-stay/40 hover:bg-cat-stay/5"
                onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
              />
              <button
                type="button"
                onClick={() => setFilterSheetOpen((o) => !o)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filterSheetOpen || activeFilterCount > 0 ? 'border-cat-stay bg-cat-stay text-white' : 'border-line bg-paper-2 text-ink-600 hover:border-cat-stay/40'
                }`}
              >
                <SlidersHorizontal size={12} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </div>
          </SearchSummaryBar>
        )}

        {isSearchExpanded && (
          <div className="border-b border-line bg-paper-2 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900">Search Hotels</h3>
              <button onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-ink-500">Cancel</button>
            </div>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. Manali, India"
              className="w-full rounded-xl border border-line p-3 text-sm text-ink-900 outline-none focus:border-cat-stay focus:ring-2 focus:ring-cat-stay/15" />
          </div>
        )}

        {filterSheetOpen && (
          <HotelFilterSheet results={results} filters={filters} onChange={setFilters} onClose={() => setFilterSheetOpen(false)} />
        )}

        <div className="space-y-3 p-4">
          {loading ? (
            <>
              <HotelCardSkeleton />
              <HotelCardSkeleton />
              <HotelCardSkeleton />
            </>
          ) : visibleResults.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-ink-500">{visibleResults.length} hotel{visibleResults.length === 1 ? '' : 's'} · best fit for your trip first</p>
              <div role="list" aria-label="Hotel results" className="space-y-3">
                {visibleResults.map((hotel, i) => (
                  <div key={hotel.id} role="listitem" aria-setsize={visibleResults.length} aria-posinset={i + 1}>
                    <HotelCard
                      hotel={hotel}
                      fit={fitsById.get(hotel.id)!}
                      impact={impactsById.get(hotel.id) ?? null}
                      hasItineraryData={hasItineraryData}
                      minutesSaved={minutesSavedVsCurrent(impactsById.get(hotel.id) ?? null, currentHotelImpact)}
                      isExpanded={expandedId === hotel.id}
                      isPending={pendingItem?.id === hotel.id}
                      isPinned={pinnedIds.includes(hotel.id)}
                      canPin={pinnedIds.length < 3}
                      detailsLoading={detailsLoading && expandedId === hotel.id && !expandedData}
                      expandedDetails={expandedId === hotel.id ? expandedData : null}
                      onToggleExpand={() => toggleExpand(hotel)}
                      onSelect={() => setPendingItem(expandedId === hotel.id ? (expandedData || hotel) : hotel)}
                      onTogglePin={() => togglePin(hotel.id)}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-line bg-paper-1 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cat-stay/10"><BedDouble size={24} className="text-cat-stay" /></div>
              <p className="text-sm font-semibold text-ink-700">No hotels found{tripContext.destination ? ` near ${tripContext.destination}` : ''}</p>
              {!isFiltersDefault(filters) && (
                <button type="button" onClick={() => setFilters(DEFAULT_HOTEL_FILTERS)} className="mt-2 text-xs font-semibold text-cat-stay hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {pendingItem && onAddToPlan ? (
        <HotelConfirmBar
          newItemTitle={pendingItem.name}
          newItemPrice={pendingItem.price_label || undefined}
          tripContext={tripContext}
          isReplacing={isReplacing}
          onCancel={() => setPendingItem(null)}
          onConfirm={handleConfirmReplace}
        />
      ) : (
        <HotelCompareTray pinned={pinnedHotels} onUnpin={togglePin} onSelect={setPendingItem} />
      )}
    </div>
  );
}
