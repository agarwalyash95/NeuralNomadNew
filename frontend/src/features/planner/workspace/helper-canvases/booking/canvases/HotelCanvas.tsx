'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { BedDouble } from 'lucide-react';
import { referenceService } from '@/services/reference.service';
import { useHotelStore } from '@/store/hotelStore';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';
import ReplaceConfirmBar from '../../shared/ReplaceConfirmBar';
import SuggestionCard from '../../shared/SuggestionCard';
import CurrentlyBookedCard from '../../shared/CurrentlyBookedCard';
import { ItineraryItem, Suggestion } from '../../../plan-canvas/types';

interface HotelCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const QUICK_FILTER_TAGS = ['All', '4+ Stars', 'Budget', 'Premium'];

export default function HotelCanvas({ onClose, tripContext, onAddToPlan }: HotelCanvasProps) {
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination || 'Manali';
  const [searchQuery, setSearchQuery] = useState(`${defaultLocation}, India`);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['All']);
  const [pendingItem, setPendingItem] = useState<Suggestion | null>(null);

  // Accordion state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<Suggestion | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [results, setResults] = useState<Suggestion[]>([]);

  const getHotelDetail = useHotelStore(state => state.getHotelDetail);
  const setHotelDetail = useHotelStore(state => state.setHotelDetail);

  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : 'Manali, India');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  const fetchHotels = async (query: string) => {
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

  // Don't recommend what's already planned for the day in view
  const plannedTitles = useMemo(
    () => new Set((tripContext.activeDayItemTitles || []).map(t => t.trim().toLowerCase())),
    [tripContext.activeDayItemTitles]
  );
  const tagFiltered = useMemo(() => {
    if (selectedTags.length === 0 || selectedTags.includes('All')) return results;
    return results.filter(h => selectedTags.every(tag => {
      if (tag === '4+ Stars') return (h.rating ?? 0) >= 4;
      if (tag === 'Budget') return h.details.price_range === '$' || h.details.price_range === '$$';
      if (tag === 'Premium') return h.details.price_range === '$$$' || h.details.price_range === '$$$$';
      return true;
    }));
  }, [results, selectedTags]);
  const visibleResults = useMemo(
    () => tagFiltered.filter(h => !plannedTitles.has(h.name.trim().toLowerCase())),
    [tagFiltered, plannedTitles]
  );

  const toggleExpand = async (suggestion: Suggestion) => {
    if (expandedId === suggestion.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(suggestion.id);

    const cachedItem = getHotelDetail(suggestion.id);
    if (cachedItem) {
      setExpandedData(cachedItem);
      return;
    }

    setExpandedData(null);
    setDetailsLoading(true);
    try {
      const resp = await referenceService.getHotelDetails(suggestion.id);
      setExpandedData(resp);
      setHotelDetail(suggestion.id, resp);
    } catch (err) {
      console.error('Error fetching hotel details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

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
      rating: pendingItem.rating != null ? Math.floor(pendingItem.rating) : undefined,
      geoTag: pendingItem.address || '',
      image: pendingItem.image_url || undefined,
      latitude: pendingItem.latitude ?? undefined,
      longitude: pendingItem.longitude ?? undefined,
      place_id: pendingItem.place_id ?? undefined,
      cost: pendingItem.cost,
    };
    onAddToPlan(newItem);
    setPendingItem(null);
    setExpandedId(null);
  };

  const searchSummary = `Hotels in ${tripContext.destination || 'Manali'}`;

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader
        icon={<BedDouble size={18} />}
        iconColor="bg-indigo-600"
        label="Hotels"
        title={searchSummary}
        tripContext={tripContext}
        onClose={onClose}
      />
      <CurrentlyBookedCard tripContext={tripContext} nodeType="hotel" />

      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary="Stays near your itinerary" accentColor="group-hover:text-indigo-600" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar
              tags={QUICK_FILTER_TAGS}
              selected={selectedTags}
              activeColor="border-indigo-600 bg-indigo-600 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
            />
          </SearchSummaryBar>
        )}

        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Search Hotels</h3>
              <button onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-slate-500">Cancel</button>
            </div>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. Manali, India"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
        )}

        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600" />
              <p className="text-sm font-semibold text-slate-600">Finding hotels...</p>
            </div>
          ) : visibleResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{visibleResults.length} hotels found</p>
              {visibleResults.map((hotel) => (
                <SuggestionCard
                  key={hotel.id}
                  suggestion={hotel}
                  isExpanded={expandedId === hotel.id}
                  isPending={pendingItem?.id === hotel.id}
                  detailsLoading={detailsLoading && expandedId === hotel.id && !expandedData}
                  onToggleExpand={() => toggleExpand(hotel)}
                  onSelect={() => setPendingItem(expandedId === hotel.id ? (expandedData || hotel) : hotel)}
                  selectLabel="Select Hotel"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200"><BedDouble size={24} className="text-slate-400" /></div>
              <p className="text-sm font-semibold text-slate-600">No hotels found near {tripContext.destination || 'this trip'}</p>
            </div>
          )}
        </div>
      </div>

      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar
          newItemTitle={pendingItem.name}
          newItemPrice={pendingItem.price_label || undefined}
          tripContext={tripContext}
          confirmColor="bg-indigo-600 hover:bg-indigo-700"
          onCancel={() => setPendingItem(null)}
          onConfirm={handleConfirmReplace}
        />
      )}
    </div>
  );
}
