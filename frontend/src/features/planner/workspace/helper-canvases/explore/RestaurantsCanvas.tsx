'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Utensils, Search } from 'lucide-react';
import { referenceService } from '@/services/reference.service';
import type { TripContext } from '../../types';
import CanvasHeader from '../shared/CanvasHeader';
import SearchSummaryBar from '../shared/SearchSummaryBar';
import ReplaceConfirmBar from '../shared/ReplaceConfirmBar';
import { ItineraryItem, Suggestion } from '../../plan-canvas/types';

// Core dependencies of the new assistant design
import MealDecisionCard from './MealDecisionCard';
import RestaurantSuggestionCard from './RestaurantSuggestionCard';
import RestaurantCardSkeleton from './RestaurantCardSkeleton';
import RestaurantCompareTray from './RestaurantCompareTray';
import AIQuickActionsRow from './AIQuickActionsRow';
import { getMealRecommendations } from './services/mealRecommendationEngine';
import { applyAIQuickFilter, type AIQuickActionId } from './services/mealPresentation';

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
  'Highly Rated'
];

export default function RestaurantsCanvas({ onClose, tripContext, onAddToPlan }: RestaurantsCanvasProps) {
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination || 'Manali';
  const [searchQuery, setSearchQuery] = useState(`${defaultLocation}, India`);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['AI Picks']);

  // Selected item pending plan confirmation
  const [pendingItem, setPendingItem] = useState<Suggestion | null>(null);

  // Accordion details lazy-loading state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<Suggestion | null>(null);


  // Raw places fetched from backend
  const [results, setResults] = useState<Suggestion[]>([]);

  // Compared items state
  const [comparedIds, setComparedIds] = useState<number[]>([]);

  // Contextual AI quick-refine action (re-sorts/filters the already-scored list)
  const [activeAIAction, setActiveAIAction] = useState<AIQuickActionId | null>(null);

  // Hero card shrinks once the feed has scrolled a little
  const scrollRef = useRef<HTMLDivElement>(null);
  const [heroCompact, setHeroCompact] = useState(false);

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

  useEffect(() => { 
    fetchRestaurants(searchQuery); 
  }, [searchQuery]);

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
    try {
      const resp = await queryClient.fetchQuery({
        queryKey: ['place-details', 'restaurant', suggestion.id],
        queryFn: () => referenceService.getRestaurantDetails(suggestion.id),
        staleTime: 30 * 60_000,
      });
      setExpandedData(resp);
    } catch (err) {
      console.error('Error fetching details:', err);
    }
  };

  const handleSelect = (place: Suggestion) => {
    // Merge expanded detail fields if available
    const mergedPlace = place.id === expandedId && expandedData ? {
      ...place,
      details: { ...place.details, ...expandedData.details }
    } : place;
    setPendingItem(mergedPlace);
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
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (prev.length >= 3) return prev; // Capped at max 3 items
      return [...prev, id];
    });
  };

  // Process data using the recommendation engine
  const recommendations = useMemo(() => {
    // Merge current expanded data inside visibleResults for the active item
    const mergedResults = visibleResults.map(place => {
      if (place.id === expandedId && expandedData) {
        return {
          ...place,
          details: {
            ...place.details,
            ...expandedData.details
          }
        };
      }
      return place;
    });
    return getMealRecommendations(mergedResults, tripContext, selectedTags);
  }, [visibleResults, expandedId, expandedData, tripContext, selectedTags]);

  // Apply the active AI quick-refine action, if any, on top of the base scoring
  const refinedRecommendations = useMemo(
    () => (activeAIAction ? applyAIQuickFilter(recommendations, activeAIAction) : recommendations),
    [recommendations, activeAIAction]
  );

  // Separate top recommendation (for the Decision card) from secondary recommendations
  const topRecommendation = refinedRecommendations[0];
  const secondaryRecommendations = refinedRecommendations.slice(1);

  const comparedRecommendations = useMemo(() => {
    return recommendations.filter(r => comparedIds.includes(r.suggestion.id));
  }, [comparedIds, recommendations]);

  const handleAIActionToggle = (action: AIQuickActionId) => {
    setActiveAIAction(prev => (prev === action ? null : action));
  };

  const searchSummary = `Dining in ${tripContext.destination || 'Manali'}`;

  return (
    <div className="flex h-full flex-col bg-paper-0 relative">
      <CanvasHeader
        icon={<Utensils size={18} />}
        iconColor="bg-violet-600"
        label="Meal Companion"
        title={searchSummary}
        tripContext={tripContext}
        onClose={onClose}
      />

      {!isSearchExpanded ? (
        <div className="shrink-0 bg-paper-1 px-4 pt-2.5 pb-2">
          <SearchSummaryBar
            primary={searchSummary}
            secondary="AI-curated meals near your stops"
            accentColor="group-hover:text-cat-food"
            onClick={() => setIsSearchExpanded(true)}
          />
        </div>
      ) : (
        <div className="shrink-0 border-b border-line bg-paper-2 p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold text-ink-700 uppercase tracking-wider">Search Dining Spots</h3>
            <button onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-ink-500 hover:text-ink-700">Cancel</button>
          </div>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. Manali, India"
              className="w-full rounded-xl border border-line pl-9 pr-3 py-2 text-xs text-ink-900 outline-none focus:border-cat-food focus:ring-2 focus:ring-cat-food/15"
            />
            <Search size={14} className="absolute left-3 top-2.5 text-ink-400" />
          </div>
        </div>
      )}

      {/* Horizontal scrolling Intent Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1.5 px-4 border-b border-line bg-paper-1 shrink-0">
        {INTENT_FILTER_TAGS.map(tag => {
          const isActive = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => handleToggleTag(tag)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-cat-food border-transparent text-white shadow-sm'
                  : 'border-line bg-paper-2 text-ink-600 hover:border-cat-food/40 hover:bg-cat-food/5'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Contextual AI quick-refine actions */}
      <div className="px-4 py-2 border-b border-line bg-paper-1 shrink-0">
        <AIQuickActionsRow active={activeAIAction} onToggle={handleAIActionToggle} />
      </div>

      {/* Scrollable Feed Container */}
      <div
        ref={scrollRef}
        onScroll={(e) => setHeroCompact(e.currentTarget.scrollTop > 24)}
        className="custom-scrollbar flex-1 overflow-y-auto p-4 pb-6"
      >
        {loading ? (
          <div className="space-y-3">
            <RestaurantCardSkeleton variant="hero" />
            <RestaurantCardSkeleton />
            <RestaurantCardSkeleton />
          </div>
        ) : refinedRecommendations.length > 0 ? (
          <div className="space-y-4">

            {/* AI Top Decision Recommendation */}
            {topRecommendation && (
              <div>
                <p className="text-micro mb-2">Top meal decision pick</p>
                <MealDecisionCard
                  recommendation={topRecommendation}
                  isPending={pendingItem?.id === topRecommendation.suggestion.id}
                  compact={heroCompact}
                  onSelect={() => handleSelect(topRecommendation.suggestion)}
                />
              </div>
            )}

            {/* Other suggestions in list (Compact Cards) */}
            {secondaryRecommendations.length > 0 && (
              <div>
                <p className="text-micro mb-2">Alternative matches</p>
                <div className="space-y-3">
                  {secondaryRecommendations.map((rec) => (
                    <RestaurantSuggestionCard
                      key={rec.suggestion.id}
                      recommendation={rec}
                      isExpanded={expandedId === rec.suggestion.id}
                      isPending={pendingItem?.id === rec.suggestion.id}
                      onToggleExpand={() => toggleExpand(rec.suggestion)}
                      onSelect={() => handleSelect(rec.suggestion)}
                      onCompareToggle={() => handleCompareToggle(rec.suggestion.id)}
                      isCompared={comparedIds.includes(rec.suggestion.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-paper-2 p-8 text-center border border-line shadow-surface">
            <div className="mx-auto mb-3 text-3xl">🍲</div>
            <p className="text-sm font-semibold text-ink-700">No meal matches found</p>
            <p className="mt-1 text-xs text-ink-400">Try adjusting your filters or active location</p>
          </div>
        )}
      </div>

      {!pendingItem && (
        <RestaurantCompareTray
          compared={comparedRecommendations}
          onRemove={handleCompareToggle}
          onSelect={handleSelect}
        />
      )}

      {/* Add node replacement confirmation bar */}
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar
          newItemTitle={pendingItem.name}
          newItemPrice={pendingItem.price_label || undefined}
          tripContext={tripContext}
          confirmColor="bg-cat-food hover:brightness-110"
          onCancel={() => setPendingItem(null)}
          onConfirm={handleConfirmReplace}
        />
      )}
    </div>
  );
}
