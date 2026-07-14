'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Compass, Zap, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { referenceService, type ExploreSource } from '@/services/reference.service';
import { TripContext } from '../../types';
import CanvasSearchToolbar from '../shared/CanvasSearchToolbar';
import SortFilterPopover from '../shared/SortFilterPopover';
import { TierBadge } from '../shared/ExploreStatusUI';
import { CanvasErrorCard, classifyFetchErrorVariant, type CanvasErrorVariant } from '../shared/CanvasErrorCard';
import { LiveSearchProgress, useLiveSearchPhases, useTierEscalation } from '../shared/LiveSearchProgress';
import { ItineraryItem, Suggestion } from '../../plan-canvas/types';

import AttractionSuggestionCard from './AttractionSuggestionCard';
import AttractionDetailPanel from './AttractionDetailPanel';
import ActivitySuggestionCard from './ActivitySuggestionCard';
import ActivityDetailPanel from './ActivityDetailPanel';
import AttractionCardSkeleton from './AttractionCardSkeleton';

import { getAttractionRecommendations } from './services/sightRecommendationEngine';
import { getActivityRecommendations } from './services/activityRecommendationEngine';
import {
  applyAttractionQuickFilter,
  applyActivityQuickFilter,
  AI_ATTRACTION_QUICK_ACTIONS,
  AI_ACTIVITY_QUICK_ACTIONS,
  type AIAttractionActionId,
  type AIActivityActionId,
} from './services/sightPresentation';

interface AttractionsCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

type Tab = 'attractions' | 'activities';
type AnyActionId = AIAttractionActionId | AIActivityActionId;

const EXPLORE_PHASES = [
  { key: 'search', label: 'Searching nearby places' },
  { key: 'rank', label: 'Ranking results' },
  { key: 'finalize', label: 'Finalizing' },
];

export default function AttractionsCanvas({ onClose, tripContext, onAddToPlan }: AttractionsCanvasProps) {
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination || 'Manali';
  const [searchQuery, setSearchQuery] = useState(`${defaultLocation}, India`);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('attractions');
  const [filterOpen, setFilterOpen] = useState(false);

  const [canvasMode, setCanvasMode] = useState<'compare' | 'decide'>('compare');
  const [listScrollTop, setListScrollTop] = useState(0);
  const listScrollContainerRef = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedData, setSelectedData] = useState<Suggestion | null>(null);
  const [selectedDataKey, setSelectedDataKey] = useState<string | null>(null);

  const [attractions, setAttractions] = useState<Suggestion[]>([]);
  const [activities, setActivities] = useState<Suggestion[]>([]);
  const [attractionsSource, setAttractionsSource] = useState<ExploreSource | null>(null);
  const [activitiesSource, setActivitiesSource] = useState<ExploreSource | null>(null);
  const [attractionsError, setAttractionsError] = useState<CanvasErrorVariant | null>(null);
  const [activitiesError, setActivitiesError] = useState<CanvasErrorVariant | null>(null);

  const queryClient = useQueryClient();

  const [comparedAttractionIds, setComparedAttractionIds] = useState<number[]>([]);
  const [comparedActivityIds, setComparedActivityIds] = useState<number[]>([]);
  const [activeAIAction, setActiveAIAction] = useState<AnyActionId | null>(null);
  const [isCommitSuccess, setIsCommitSuccess] = useState(false);

  useEffect(() => {
    setActiveTab(tripContext.activeNodeType === 'activity' ? 'activities' : 'attractions');
  }, [tripContext.activeNodeType, tripContext.activeNodeId]);

  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : 'Manali, India');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  useEffect(() => {
    setActiveAIAction(null);
  }, [activeTab]);

  const fetchData = async (query: string) => {
    if (!query.trim()) {
      setAttractions([]);
      setActivities([]);
      setAttractionsSource(null);
      setActivitiesSource(null);
      setAttractionsError(null);
      setActivitiesError(null);
      return;
    }
    setLoading(true);
    setAttractionsError(null);
    setActivitiesError(null);
    try {
      const loc = tripContext.activeNodeCityName || tripContext.destination;
      const useCoords = loc && query.toLowerCase().includes(loc.toLowerCase());
      const lat = useCoords ? tripContext.activeNodeLatitude : undefined;
      const lng = useCoords ? tripContext.activeNodeLongitude : undefined;

      // Independent try/catch per category — one failing must not blank the
      // other tab, but each tab needs to know honestly whether IT failed,
      // and whether it was a real error or the live tier timing out.
      const [attractionsResult, activitiesResult] = await Promise.all([
        referenceService.exploreAttractions(query, lat, lng).catch((err) => {
          console.error('Error fetching attractions:', err?.message || err);
          setAttractionsError(classifyFetchErrorVariant(err));
          return null;
        }),
        referenceService.exploreActivities(query, lat, lng).catch((err) => {
          console.error('Error fetching activities:', err?.message || err);
          setActivitiesError(classifyFetchErrorVariant(err));
          return null;
        }),
      ]);
      setAttractions(attractionsResult?.results ?? []);
      setAttractionsSource(attractionsResult?.source ?? null);
      setActivities(activitiesResult?.results ?? []);
      setActivitiesSource(activitiesResult?.source ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(searchQuery);
  }, [searchQuery]);

  const plannedTitles = useMemo(
    () => new Set((tripContext.activeDayItemTitles || []).map((t) => t.trim().toLowerCase())),
    [tripContext.activeDayItemTitles],
  );
  const visibleAttractions = useMemo(
    () => attractions.filter((a) => !plannedTitles.has(a.name.trim().toLowerCase())),
    [attractions, plannedTitles],
  );
  const visibleActivities = useMemo(
    () => activities.filter((a) => !plannedTitles.has(a.name.trim().toLowerCase())),
    [activities, plannedTitles],
  );

  const attractionRecommendations = useMemo(
    () => getAttractionRecommendations(visibleAttractions, tripContext),
    [visibleAttractions, tripContext],
  );
  const activityRecommendations = useMemo(
    () => getActivityRecommendations(visibleActivities, tripContext),
    [visibleActivities, tripContext],
  );

  const refinedAttractions = useMemo(
    () =>
      activeAIAction && activeTab === 'attractions'
        ? applyAttractionQuickFilter(attractionRecommendations, activeAIAction as AIAttractionActionId)
        : attractionRecommendations,
    [attractionRecommendations, activeAIAction, activeTab],
  );
  const refinedActivities = useMemo(
    () =>
      activeAIAction && activeTab === 'activities'
        ? applyActivityQuickFilter(activityRecommendations, activeAIAction as AIActivityActionId)
        : activityRecommendations,
    [activityRecommendations, activeAIAction, activeTab],
  );

  const refinedRecs = activeTab === 'attractions' ? refinedAttractions : refinedActivities;

  useEffect(() => {
    if (selectedId != null && !refinedRecs.some((r) => r.suggestion.id === selectedId)) {
      setSelectedId(null);
      setCanvasMode('compare');
    }
  }, [refinedRecs, selectedId]);

  useEffect(() => {
    if (selectedId == null) return;
    const key = `${activeTab}:${selectedId}`;
    let cancelled = false;
    (async () => {
      try {
        const resp = await queryClient.fetchQuery({
          queryKey: ['place-details', activeTab === 'attractions' ? 'attraction' : 'activity', selectedId],
          queryFn: () =>
            activeTab === 'attractions'
              ? referenceService.getAttractionDetails(selectedId)
              : referenceService.getActivityDetails(selectedId),
          staleTime: 30 * 60_000,
        });
        if (!cancelled) {
          setSelectedData(resp);
          setSelectedDataKey(key);
        }
      } catch (err) {
        console.error('Error fetching attraction/activity details:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, activeTab, queryClient]);

  const selectedAttraction = useMemo(() => {
    if (activeTab !== 'attractions') return null;
    const base = refinedAttractions.find((r) => r.suggestion.id === selectedId);
    if (!base) return null;
    if (selectedData && selectedDataKey === `attractions:${selectedId}`) {
      return { ...base, suggestion: { ...base.suggestion, details: { ...base.suggestion.details, ...selectedData.details } } };
    }
    return base;
  }, [activeTab, refinedAttractions, selectedId, selectedData, selectedDataKey]);

  const selectedActivity = useMemo(() => {
    if (activeTab !== 'activities') return null;
    const base = refinedActivities.find((r) => r.suggestion.id === selectedId);
    if (!base) return null;
    if (selectedData && selectedDataKey === `activities:${selectedId}`) {
      return { ...base, suggestion: { ...base.suggestion, details: { ...base.suggestion.details, ...selectedData.details } } };
    }
    return base;
  }, [activeTab, refinedActivities, selectedId, selectedData, selectedDataKey]);


  const handleCompareAttractionToggle = (id: number) => {
    setComparedAttractionIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : prev.length >= 3 ? prev : [...prev, id]));
  };
  const handleCompareActivityToggle = (id: number) => {
    setComparedActivityIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : prev.length >= 3 ? prev : [...prev, id]));
  };

  const handleAIActionToggle = (action: AnyActionId) => {
    setActiveAIAction((prev) => (prev === action ? null : action));
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

  const handleSelect = (place: Suggestion) => {
    if (!onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `${activeTab === 'attractions' ? 'attraction' : 'activity'}-${place.id}-${Date.now()}`,
      type: activeTab === 'attractions' ? 'attraction' : 'activity',
      title: place.name,
      subtitle: place.address || '',
      details: [place.duration_label, place.price_label].filter(Boolean).join(' • ') || undefined,
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

  const handleSwitchTab = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedId(null);
    setCanvasMode('compare');
  };

  const escalated = useTierEscalation(loading);
  const { elapsedMs } = useLiveSearchPhases(loading && escalated);

  const activeFilterCount = activeAIAction ? 1 : 0;

  const addedMessage = tripContext.activeNodeDayLabel
    ? `Added to ${tripContext.activeNodeDayLabel}`
    : 'Added to your plan';

  return (
    <div className="helper-canvas-premium flex h-full flex-col bg-paper-1 relative overflow-hidden select-none">
      
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
                accentClassName={activeTab === 'attractions' ? 'focus:border-cat-attraction focus:ring-cat-attraction/15' : 'focus:border-cat-activity focus:ring-cat-activity/15'}
              />
              <SortFilterPopover
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                showReset={activeFilterCount > 0}
                onReset={() => setActiveAIAction(null)}
              >
                <p className="text-micro mb-2">Sort by</p>
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setActiveAIAction(null)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12px] font-semibold cursor-pointer ${
                      activeAIAction === null ? 'bg-paper-0 text-ink-900' : 'text-ink-600 hover:bg-paper-0'
                    }`}
                  >
                    Default order
                    {activeAIAction === null && <Check size={13} />}
                  </button>
                  {(activeTab === 'attractions' ? AI_ATTRACTION_QUICK_ACTIONS : AI_ACTIVITY_QUICK_ACTIONS).map(({ id, label, emoji }) => {
                    const isActive = activeAIAction === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleAIActionToggle(id as AnyActionId)}
                        className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-semibold cursor-pointer ${
                          isActive ? 'bg-paper-0 text-ink-900' : 'text-ink-600 hover:bg-paper-0'
                        }`}
                      >
                        <span className="flex items-center gap-2"><span>{emoji}</span> {label}</span>
                        {isActive && <Check size={13} />}
                      </button>
                    );
                  })}
                </div>
              </SortFilterPopover>
            </div>

            <div className="shrink-0 border-b border-line bg-paper-1 p-2">
              <div className="relative flex w-full rounded-xl bg-paper-0 p-1">
                {(['attractions', 'activities'] as Tab[]).map((tab) => {
                  const isActive = activeTab === tab;
                  const count = tab === 'attractions' ? visibleAttractions.length : visibleActivities.length;
                  const Icon = tab === 'attractions' ? Compass : Zap;
                  const accent = tab === 'attractions' ? 'text-cat-attraction' : 'text-cat-activity';
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => handleSwitchTab(tab)}
                      className={`relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold ${
                        isActive ? accent : 'text-ink-500 hover:text-ink-800'
                      }`}
                      style={{ transition: `color var(--motion-card) var(--ease-out)` }}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="attractions-tab-indicator"
                          className="absolute inset-0 -z-10 rounded-lg bg-white shadow-xs"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <Icon size={13} />
                      <span className="capitalize">{tab}</span>
                      {count > 0 && (
                        <span className={`rounded-full px-1.5 text-[9px] font-bold ${isActive ? `${accent} bg-current/10` : 'bg-line text-ink-600'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {loading && !escalated ? (
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {Array.from({ length: Math.min((activeTab === 'attractions' ? visibleAttractions.length : visibleActivities.length) || 3, 6) }).map((_, i) => (
                  <AttractionCardSkeleton key={i} />
                ))}
              </div>
            ) : loading && escalated ? (
              <div className="flex-1 overflow-y-auto p-4">
                <LiveSearchProgress phases={EXPLORE_PHASES} elapsedMs={elapsedMs} />
              </div>
            ) : (activeTab === 'attractions' ? attractionsError : activitiesError) ? (
              <CanvasErrorCard
                variant={(activeTab === 'attractions' ? attractionsError : activitiesError)!}
                onRetry={() => fetchData(searchQuery)}
              />
            ) : refinedRecs.length > 0 ? (
              <div ref={listScrollContainerRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4">
                <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-ink-500">
                  {refinedRecs.length}{' '}
                  {activeTab === 'attractions'
                    ? (refinedRecs.length === 1 ? 'attraction' : 'attractions')
                    : (refinedRecs.length === 1 ? 'activity' : 'activities')}
                  <span className="font-medium text-ink-400">{' '}near your search area</span>
                  {(activeTab === 'attractions' ? attractionsSource : activitiesSource) && (
                    <TierBadge source={(activeTab === 'attractions' ? attractionsSource : activitiesSource)!} />
                  )}
                </p>

                <div className="flex flex-col gap-3">
                  {activeTab === 'attractions' && refinedAttractions.map((rec) => (
                    <AttractionSuggestionCard
                      key={rec.suggestion.id}
                      recommendation={rec}
                      isPending={false}
                      onSelect={() => handleSelectRecommendation(rec.suggestion.id)}
                      onAdd={() => handleSelect(rec.suggestion)}
                      tripContext={tripContext}
                    />
                  ))}
                  {activeTab === 'activities' && refinedActivities.map((rec) => (
                    <ActivitySuggestionCard
                      key={rec.suggestion.id}
                      recommendation={rec}
                      isPending={false}
                      onSelect={() => handleSelectRecommendation(rec.suggestion.id)}
                      onAdd={() => handleSelect(rec.suggestion)}
                      tripContext={tripContext}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-4 mt-4 flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-6 py-5 text-center shadow-surface">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${activeTab === 'attractions' ? 'bg-cat-attraction/10 text-cat-attraction' : 'bg-cat-activity/10 text-cat-activity'}`}>
                  {activeTab === 'attractions' ? <Compass size={16} /> : <Zap size={16} />}
                </div>
                <p className="text-[12.5px] font-semibold text-ink-700">
                  No {activeTab === 'attractions' ? 'attractions' : 'activities'} found here yet — try adjusting the location above
                </p>
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
            {activeTab === 'attractions' && selectedAttraction && (
              <AttractionDetailPanel
                recommendation={selectedAttraction}
                isPending={false}
                onSelect={() => handleSelect(selectedAttraction.suggestion)}
                onCompareToggle={() => handleCompareAttractionToggle(selectedAttraction.suggestion.id)}
                isCompared={comparedAttractionIds.includes(selectedAttraction.suggestion.id)}
                onBack={() => { setCanvasMode('compare'); setSelectedId(null); }}
                tripContext={tripContext}
              />
            )}
            {activeTab === 'activities' && selectedActivity && (
              <ActivityDetailPanel
                recommendation={selectedActivity}
                isPending={false}
                onSelect={() => handleSelect(selectedActivity.suggestion)}
                onCompareToggle={() => handleCompareActivityToggle(selectedActivity.suggestion.id)}
                isCompared={comparedActivityIds.includes(selectedActivity.suggestion.id)}
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
