'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Utensils } from 'lucide-react';
import { referenceService } from '@/services/reference.service';
import { TripContext } from '../../types';
import CanvasHeader from '../shared/CanvasHeader';
import SearchSummaryBar from '../shared/SearchSummaryBar';
import QuickFilterBar from '../shared/QuickFilterBar';
import ReplaceConfirmBar from '../shared/ReplaceConfirmBar';
import SuggestionCard from '../shared/SuggestionCard';
import { ItineraryItem, Suggestion } from '../../plan-canvas/types';

interface RestaurantsCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const CUISINE_FILTER_TAGS = ['All', 'Indian', 'Cafe', 'Dine-in', 'Takeout', 'Delivery'];

export default function RestaurantsCanvas({ onClose, tripContext, onAddToPlan }: RestaurantsCanvasProps) {
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

  const queryClient = useQueryClient();

  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : 'Manali, India');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  const fetchRestaurants = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const loc = tripContext.activeNodeCityName || tripContext.destination;
      const useCoords = loc && query.toLowerCase().includes(loc.toLowerCase());
      const data = await referenceService.exploreRestaurants(
        query,
        useCoords ? tripContext.activeNodeLatitude : undefined,
        useCoords ? tripContext.activeNodeLongitude : undefined
      );
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching restaurants:', err?.message || err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(searchQuery); }, [searchQuery]);

  // Don't recommend what's already planned for the day in view
  const plannedTitles = useMemo(
    () => new Set((tripContext.activeDayItemTitles || []).map(t => t.trim().toLowerCase())),
    [tripContext.activeDayItemTitles]
  );
  const visibleResults = useMemo(
    () => results.filter(r => !plannedTitles.has(r.name.trim().toLowerCase())),
    [results, plannedTitles]
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
        queryKey: ['place-details', 'restaurant', suggestion.id],
        queryFn: () => referenceService.getRestaurantDetails(suggestion.id),
        staleTime: 30 * 60_000,
      });
      setExpandedData(resp);
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `food-${pendingItem.id}-${Date.now()}`,
      type: 'food',
      title: pendingItem.name,
      subtitle: pendingItem.address || '',
      details: pendingItem.price_label || undefined,
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
    };
    onAddToPlan(newItem);
    setPendingItem(null);
    setExpandedId(null);
  };

  const searchSummary = `Restaurants in ${tripContext.destination || 'Manali'}`;

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader icon={<Utensils size={18} />} iconColor="bg-orange-500" label="Restaurants" title={searchSummary} tripContext={tripContext} onClose={onClose} />
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary="Cafes, dhabas, local food"
            accentColor="group-hover:text-orange-500" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar tags={CUISINE_FILTER_TAGS} selected={selectedTags}
              activeColor="border-orange-500 bg-orange-500 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} />
          </SearchSummaryBar>
        )}
        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Search Restaurants</h3>
              <button onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-slate-500">Cancel</button>
            </div>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. Manali, India"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
          </div>
        )}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-orange-500" />
              <p className="text-sm font-semibold text-slate-600">Finding restaurants...</p>
            </div>
          ) : visibleResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{visibleResults.length} places found</p>
              {visibleResults.map((place) => (
                <SuggestionCard
                  key={place.id}
                  suggestion={place}
                  isExpanded={expandedId === place.id}
                  isPending={pendingItem?.id === place.id}
                  detailsLoading={detailsLoading && expandedId === place.id && !expandedData}
                  onToggleExpand={() => toggleExpand(place)}
                  onSelect={() => setPendingItem(expandedId === place.id ? (expandedData || place) : place)}
                  selectLabel="Select Restaurant"
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 text-4xl">🍜</div>
              <p className="text-sm font-semibold text-slate-600">No restaurants found</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting the search</p>
            </div>
          )}
        </div>
      </div>
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar newItemTitle={pendingItem.name} newItemPrice={pendingItem.price_label || undefined} tripContext={tripContext}
          confirmColor="bg-orange-500 hover:bg-orange-600"
          onCancel={() => setPendingItem(null)} onConfirm={handleConfirmReplace} />
      )}
    </div>
  );
}
