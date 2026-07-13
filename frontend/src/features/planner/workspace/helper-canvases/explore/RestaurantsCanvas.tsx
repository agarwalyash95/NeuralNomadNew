'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IndianRupee, Clock, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { referenceService, type ExploreSource } from '@/services/reference.service';
import type { TripContext } from '../../types';
import CanvasSearchToolbar from '../shared/CanvasSearchToolbar';
import SortFilterPopover from '../shared/SortFilterPopover';
import { TierBadge } from '../shared/ExploreStatusUI';
import { CanvasErrorCard, classifyFetchErrorVariant, type CanvasErrorVariant } from '../shared/CanvasErrorCard';
import { ItineraryItem, Suggestion } from '../../plan-canvas/types';

import RestaurantSuggestionCard from './RestaurantSuggestionCard';
import RestaurantDetailPanel from './RestaurantDetailPanel';
import RestaurantCardSkeleton from './RestaurantCardSkeleton';
import { getMealRecommendations } from './services/mealRecommendationEngine';
import { applyAIQuickFilter, AI_QUICK_ACTIONS, type AIQuickActionId } from './services/mealPresentation';

interface RestaurantsCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const INTENT_FILTER_TAGS = [
  'AI Picks',
  'Breakfast',
  'Lunch',
  'Dinner',
  'Cafés',
  'Desserts',
  'Breweries',
  'Street Food',
  'Local Food',
  'Vegetarian',
  'Family Friendly',
  'Budget',
  'Highly Rated',
];

const SORT_ICONS: Record<AIQuickActionId, React.ElementType> = {
  cheaper: IndianRupee,
  open_now: Clock,
};

export default function RestaurantsCanvas({ onClose, tripContext, onAddToPlan }: RestaurantsCanvasProps) {
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination || 'Manali';
  const [searchQuery, setSearchQuery] = useState(`${defaultLocation}, India`);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['AI Picks']);
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeAIAction, setActiveAIAction] = useState<AIQuickActionId | null>(null);

  const [canvasMode, setCanvasMode] = useState<'compare' | 'decide'>('compare');
  const [listScrollTop, setListScrollTop] = useState(0);
  const listScrollContainerRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedData, setSelectedData] = useState<Suggestion | null>(null);

  const [results, setResults] = useState<Suggestion[]>([]);
  const [source, setSource] = useState<ExploreSource | null>(null);
  const [fetchError, setFetchError] = useState<CanvasErrorVariant | null>(null);
  const [comparedIds, setComparedIds] = useState<number[]>([]);
  const [isCommitSuccess, setIsCommitSuccess] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : 'Manali, India');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  const fetchRestaurants = async (query: string) => {
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
      const { results: data, source: src } = await referenceService.exploreRestaurants(
        query,
        useCoords ? tripContext.activeNodeLatitude : undefined,
        useCoords ? tripContext.activeNodeLongitude : undefined
      );
      setResults(data);
      setSource(src);
    } catch (err: any) {
      console.error('Error fetching restaurants:', err?.message || err);
      setResults([]);
      setSource(null);
      setFetchError(classifyFetchErrorVariant(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants(searchQuery);
  }, [searchQuery]);

  const plannedTitles = useMemo(
    () => new Set((tripContext.activeDayItemTitles || []).map(t => t.trim().toLowerCase())),
    [tripContext.activeDayItemTitles]
  );

  const visibleResults = useMemo(
    () => results.filter(r => !plannedTitles.has(r.name.trim().toLowerCase())),
    [results, plannedTitles]
  );

  const recommendations = useMemo(
    () => getMealRecommendations(visibleResults, tripContext, selectedTags),
    [visibleResults, tripContext, selectedTags]
  );

  const refinedRecommendations = useMemo(
    () => (activeAIAction ? applyAIQuickFilter(recommendations, activeAIAction) : recommendations),
    [recommendations, activeAIAction]
  );

  useEffect(() => {
    if (selectedId != null && !refinedRecommendations.some(r => r.suggestion.id === selectedId)) {
      setSelectedId(null);
      setCanvasMode('compare');
    }
  }, [refinedRecommendations, selectedId]);

  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await queryClient.fetchQuery({
          queryKey: ['place-details', 'restaurant', selectedId],
          queryFn: () => referenceService.getRestaurantDetails(selectedId),
          staleTime: 30 * 60_000,
        });
        if (!cancelled) setSelectedData(resp);
      } catch (err) {
        console.error('Error fetching details:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, queryClient]);

  const selectedRecommendation = useMemo(() => {
    const base = refinedRecommendations.find(r => r.suggestion.id === selectedId);
    if (!base) return null;
    if (selectedData && selectedData.id === selectedId) {
      return { ...base, suggestion: { ...base.suggestion, details: { ...base.suggestion.details, ...selectedData.details } } };
    }
    return base;
  }, [refinedRecommendations, selectedId, selectedData]);

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

  const handleSelectRecommendation = (id: number) => {
    const el = listScrollContainerRef.current;
    if (el) {
      setListScrollTop(el.scrollTop);
    }
    setSelectedId(id);
    setCanvasMode('decide');
  };

  const handleAddSuggestion = (place: Suggestion) => {
    if (!onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `food-${place.id}-${Date.now()}`,
      type: 'food',
      title: place.name,
      subtitle: place.address || '',
      details: place.price_label || undefined,
      status: 'Pending',
      rating: place.rating != null ? Math.round(place.rating * 10) / 10 : undefined,
      geoTag: tripContext.activeNodeCityName || tripContext.destination || '',
      image: place.image_url || undefined,
      latitude: place.latitude ?? undefined,
      longitude: place.longitude ?? undefined,
      place_id: place.place_id ?? undefined,
      cost: place.cost,
    };
    onAddToPlan(newItem);
    
    // Trigger commitment success reward
    setIsCommitSuccess(true);
    setTimeout(() => {
      setIsCommitSuccess(false);
      if (onClose) onClose();
    }, 1200);
  };

  const handleToggleTag = (tag: string) => {
    if (tag === 'AI Picks') {
      setSelectedTags(['AI Picks']);
      return;
    }
    setSelectedTags(prev => {
      const hasTag = prev.includes(tag);
      const filteredTags = prev.filter(t => t !== tag && t !== 'AI Picks');
      const nextTags = hasTag ? filteredTags : [...filteredTags, tag];
      return nextTags.length === 0 ? ['AI Picks'] : nextTags;
    });
  };

  const handleCompareToggle = (id: number) => {
    setComparedIds(prev => {
      if (prev.includes(id)) return prev.filter(item => item !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const activeFilterCount = (activeAIAction ? 1 : 0) + (selectedTags.length === 1 && selectedTags[0] === 'AI Picks' ? 0 : selectedTags.length);

  const addedMessage = tripContext.activeNodeDayLabel
    ? `Added to ${tripContext.activeNodeDayLabel}`
    : 'Added to your plan';

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
                accentClassName="focus:border-cat-food focus:ring-cat-food/15"
              />
              <SortFilterPopover
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                showReset={activeFilterCount > 0}
                onReset={() => { setActiveAIAction(null); setSelectedTags(['AI Picks']); }}
              >
                <div className="mb-4">
                  <p className="text-micro mb-2">Sort by</p>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setActiveAIAction(null)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] font-semibold cursor-pointer ${
                        activeAIAction === null ? 'bg-cat-food/10 text-cat-food' : 'text-ink-600 hover:bg-paper-0'
                      }`}
                    >
                      Default order
                      {activeAIAction === null && <Check size={13} />}
                    </button>
                    {AI_QUICK_ACTIONS.map(({ id, label }) => {
                      const Icon = SORT_ICONS[id];
                      const isActive = activeAIAction === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveAIAction(id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-semibold cursor-pointer ${
                            isActive ? 'bg-cat-food/10 text-cat-food' : 'text-ink-600 hover:bg-paper-0'
                          }`}
                        >
                          <span className="flex items-center gap-2"><Icon size={13} /> {label}</span>
                          {isActive && <Check size={13} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-micro mb-2">Filter</p>
                  <div className="flex flex-wrap gap-1.5">
                    {INTENT_FILTER_TAGS.map(tag => {
                      const isActive = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => handleToggleTag(tag)}
                          className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold border transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-cat-food border-transparent text-white shadow-sm'
                              : 'border-line bg-paper-1 text-ink-600 hover:border-cat-food/40 hover:bg-cat-food/5'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SortFilterPopover>
            </div>

            {loading ? (
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <RestaurantCardSkeleton />
                <RestaurantCardSkeleton />
                <RestaurantCardSkeleton />
              </div>
            ) : fetchError ? (
              <CanvasErrorCard variant={fetchError} onRetry={() => fetchRestaurants(searchQuery)} />
            ) : refinedRecommendations.length > 0 ? (
              <div ref={listScrollContainerRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
                <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-ink-500">
                  {refinedRecommendations.length} restaurant{refinedRecommendations.length === 1 ? '' : 's'}
                  <span className="font-medium text-ink-400"> — ranked for walking distance · budget · cuisine preference</span>
                  {source && <TierBadge source={source} />}
                </p>
                <div className="flex flex-col gap-3">
                  {refinedRecommendations.map((rec) => (
                    <RestaurantSuggestionCard
                      key={rec.suggestion.id}
                      recommendation={rec}
                      isPending={false}
                      onSelect={() => handleSelectRecommendation(rec.suggestion.id)}
                      onAdd={() => handleAddSuggestion(rec.suggestion)}
                      tripContext={tripContext}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="m-4 rounded-2xl border border-line bg-paper-2 p-8 text-center shadow-surface">
                <div className="mx-auto mb-3 text-3xl">🍲</div>
                <p className="text-sm font-semibold text-ink-700">No meal matches found</p>
                <p className="mt-1 text-xs text-ink-400">Try adjusting your filters or active location</p>
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
            {selectedRecommendation && (
              <RestaurantDetailPanel
                recommendation={selectedRecommendation}
                isPending={false}
                onSelect={() => handleAddSuggestion(selectedRecommendation.suggestion)}
                onCompareToggle={() => handleCompareToggle(selectedRecommendation.suggestion.id)}
                isCompared={comparedIds.includes(selectedRecommendation.suggestion.id)}
                onBack={() => { setCanvasMode('compare'); setSelectedId(null); }}
                tripContext={tripContext}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
