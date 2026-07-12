'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Compass, Zap, Search } from 'lucide-react';
import { referenceService } from '@/services/reference.service';
import { TripContext } from '../../types';
import CanvasHeader from '../shared/CanvasHeader';
import SearchSummaryBar from '../shared/SearchSummaryBar';
import ReplaceConfirmBar from '../shared/ReplaceConfirmBar';
import { ItineraryItem, Suggestion } from '../../plan-canvas/types';

// ── New AI companion components ──────────────────────────────────────────
import ExperienceProgressCard from './ExperienceProgressCard';
import AttractionSpotlightCard from './AttractionSpotlightCard';
import AttractionSuggestionCard from './AttractionSuggestionCard';
import AttractionAIActionsRow from './AttractionAIActionsRow';
import AttractionCardSkeleton from './AttractionCardSkeleton';
import { ActivityBookingHeader } from './ActivitySpotlightCard';
import ActivitySpotlightCard from './ActivitySpotlightCard';
import ActivitySuggestionCard from './ActivitySuggestionCard';
import SightCompareTray from './SightCompareTray';

// ── Recommendation engines ───────────────────────────────────────────────
import { getAttractionRecommendations } from './services/sightRecommendationEngine';
import { getActivityRecommendations } from './services/activityRecommendationEngine';
import {
  applyAttractionQuickFilter,
  applyActivityQuickFilter,
  type AIAttractionActionId,
  type AIActivityActionId,
} from './services/sightPresentation';

interface AttractionsCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

type AnyActionId = AIAttractionActionId | AIActivityActionId;

export default function AttractionsCanvas({ onClose, tripContext, onAddToPlan }: AttractionsCanvasProps) {
  // ── All original state — preserved exactly ────────────────────────────
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination || 'Manali';
  const [searchQuery, setSearchQuery] = useState(`${defaultLocation}, India`);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveCategory] = useState<'attractions' | 'activities'>('attractions');

  const [pendingItem, setPendingItem] = useState<Suggestion | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<Suggestion | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [attractions, setAttractions] = useState<Suggestion[]>([]);
  const [activities, setActivities] = useState<Suggestion[]>([]);

  const queryClient = useQueryClient();

  // ── New state (additive only) ─────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [heroCompact, setHeroCompact] = useState(false);
  const [comparedAttractionIds, setComparedAttractionIds] = useState<number[]>([]);
  const [comparedActivityIds, setComparedActivityIds] = useState<number[]>([]);
  const [activeAIAction, setActiveAIAction] = useState<AnyActionId | null>(null);

  // ── Original effects — preserved exactly ─────────────────────────────
  useEffect(() => {
    if (tripContext.activeNodeType === 'activity') {
      setActiveCategory('activities');
    } else {
      setActiveCategory('attractions');
    }
  }, [tripContext.activeNodeType, tripContext.activeNodeId]);

  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : 'Manali, India');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  // Reset AI action when tab changes
  useEffect(() => {
    setActiveAIAction(null);
    setExpandedId(null);
    setExpandedData(null);
  }, [activeTab]);

  // ── Original fetch — preserved exactly ───────────────────────────────
  const fetchData = async (query: string) => {
    if (!query.trim()) {
      setAttractions([]);
      setActivities([]);
      return;
    }
    setLoading(true);
    try {
      const loc = tripContext.activeNodeCityName || tripContext.destination;
      const useCoords = loc && query.toLowerCase().includes(loc.toLowerCase());
      const lat = useCoords ? tripContext.activeNodeLatitude : undefined;
      const lng = useCoords ? tripContext.activeNodeLongitude : undefined;

      const [attractionsData, activitiesData] = await Promise.all([
        referenceService.exploreAttractions(query, lat, lng).catch(() => []),
        referenceService.exploreActivities(query, lat, lng).catch(() => []),
      ]);
      setAttractions(Array.isArray(attractionsData) ? attractionsData : []);
      setActivities(Array.isArray(activitiesData) ? activitiesData : []);
    } catch (err) {
      console.error('Error fetching data in AttractionsCanvas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(searchQuery);
  }, [searchQuery]);

  // ── Original filter — preserved exactly ──────────────────────────────
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

  // ── Original expand/details — preserved exactly ───────────────────────
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
        queryKey: ['place-details', activeTab === 'attractions' ? 'attraction' : 'activity', suggestion.id],
        queryFn: () =>
          activeTab === 'attractions'
            ? referenceService.getAttractionDetails(suggestion.id)
            : referenceService.getActivityDetails(suggestion.id),
        staleTime: 30 * 60_000,
      });
      setExpandedData(resp);
    } catch (err) {
      console.error('Error fetching attraction/activity details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  // ── Original add-to-plan — preserved exactly ─────────────────────────
  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `${activeTab === 'attractions' ? 'attraction' : 'activity'}-${pendingItem.id}-${Date.now()}`,
      type: activeTab === 'attractions' ? 'attraction' : 'activity',
      title: pendingItem.name,
      subtitle: pendingItem.address || '',
      details: [pendingItem.duration_label, pendingItem.price_label].filter(Boolean).join(' • ') || undefined,
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

  // ── New recommendation processing ─────────────────────────────────────
  const attractionRecommendations = useMemo(
    () => getAttractionRecommendations(visibleAttractions, tripContext),
    [visibleAttractions, tripContext],
  );
  const activityRecommendations = useMemo(
    () => getActivityRecommendations(visibleActivities, tripContext),
    [visibleActivities, tripContext],
  );

  // Apply AI quick filter on top of base scoring
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

  // Top pick + secondary list
  const topAttraction = refinedAttractions[0];
  const secondaryAttractions = refinedAttractions.slice(1);
  const topActivity = refinedActivities[0];
  const secondaryActivities = refinedActivities.slice(1);

  // Compared item sets
  const comparedAttractionRecs = useMemo(
    () => attractionRecommendations.filter((r) => comparedAttractionIds.includes(r.suggestion.id)),
    [attractionRecommendations, comparedAttractionIds],
  );
  const comparedActivityRecs = useMemo(
    () => activityRecommendations.filter((r) => comparedActivityIds.includes(r.suggestion.id)),
    [activityRecommendations, comparedActivityIds],
  );

  // Handlers
  const handleCompareAttractionToggle = (id: number) => {
    setComparedAttractionIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  };
  const handleCompareActivityToggle = (id: number) => {
    setComparedActivityIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  };

  const handleAIActionToggle = (action: AnyActionId) => {
    setActiveAIAction((prev) => (prev === action ? null : action));
  };

  const handleSelect = (s: Suggestion) => setPendingItem(s);

  // Derived
  const searchSummary =
    activeTab === 'attractions'
      ? `Sights in ${tripContext.destination || 'Manali'}`
      : `Activities in ${tripContext.destination || 'Manali'}`;

  const refinedRecs = activeTab === 'attractions' ? refinedAttractions : refinedActivities;

  return (
    <div className="flex h-full flex-col bg-paper-1 relative">
      {/* ── Canvas header — unchanged ── */}
      <CanvasHeader
        icon={activeTab === 'attractions' ? <Compass size={18} /> : <Zap size={18} />}
        iconColor={activeTab === 'attractions' ? 'bg-emerald-600' : 'bg-rose-500'}
        label={activeTab === 'attractions' ? 'Sightseeing' : 'Activities'}
        title={searchSummary}
        tripContext={tripContext}
        onClose={onClose}
      />

      {/* ── Tab switcher ── */}
      <div className="flex border-b border-slate-100 bg-[#faf9f5] p-2 shrink-0">
        <div className="flex w-full bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => { setActiveCategory('attractions'); setExpandedId(null); setExpandedData(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'attractions'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Compass size={13} />
            <span>Attractions</span>
            {visibleAttractions.length > 0 && (
              <span className={`text-[9px] font-bold px-1.5 rounded-full ${
                activeTab === 'attractions' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {visibleAttractions.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setActiveCategory('activities'); setExpandedId(null); setExpandedData(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'activities'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap size={13} />
            <span>Activities</span>
            {visibleActivities.length > 0 && (
              <span className={`text-[9px] font-bold px-1.5 rounded-full ${
                activeTab === 'activities' ? 'bg-rose-50 text-rose-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {visibleActivities.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Search bar (preserved — only shown when expanded) ── */}
      {isSearchExpanded && (
        <div className="border-b border-slate-200 bg-white p-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              {activeTab === 'attractions' ? 'Search Attractions' : 'Search Activities'}
            </h3>
            <button onClick={() => setIsSearchExpanded(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>
          </div>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Manali, India"
              className={`w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 ${
                activeTab === 'attractions'
                  ? 'focus:border-emerald-400 focus:ring-emerald-100'
                  : 'focus:border-rose-400 focus:ring-rose-100'
              }`}
            />
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          </div>
        </div>
      )}

      {/* ── AI Quick actions bar ── */}
      <div className={`shrink-0 px-4 py-2 border-b border-slate-100 bg-paper-1`}>
        <AttractionAIActionsRow
          activeTab={activeTab}
          active={activeAIAction}
          onToggle={handleAIActionToggle}
        />
      </div>

      {/* ── Scrollable feed ── */}
      <div
        ref={scrollRef}
        onScroll={(e) => setHeroCompact(e.currentTarget.scrollTop > 20)}
        className="custom-scrollbar flex-1 overflow-y-auto pb-6"
      >
        {/* Search summary bar — tap to expand search */}
        {!isSearchExpanded && (
          <div className="px-4 pt-3">
            <SearchSummaryBar
              primary={searchSummary}
              secondary={
                activeTab === 'attractions'
                  ? 'Ranked by scenic quality, timing & route efficiency'
                  : 'Ranked by availability, difficulty & booking ease'
              }
              accentColor={
                activeTab === 'attractions'
                  ? 'group-hover:text-emerald-600'
                  : 'group-hover:text-rose-500'
              }
              onClick={() => setIsSearchExpanded(true)}
            />
          </div>
        )}

        {loading ? (
          <div className="px-4 pt-3 space-y-3">
            <AttractionCardSkeleton variant="spotlight" />
            <AttractionCardSkeleton variant="list" />
            <AttractionCardSkeleton variant="list" />
            <AttractionCardSkeleton variant="list" />
          </div>
        ) : refinedRecs.length > 0 ? (
          <div className="space-y-4 px-4 pt-3">
            {/* ── ATTRACTIONS TAB ── */}
            {activeTab === 'attractions' && (
              <>
                {/* Day journey progress strip */}
                <ExperienceProgressCard tripContext={tripContext} compact={heroCompact} />

                {/* Hero spotlight */}
                {topAttraction && (
                  <div>
                    <p className="text-micro mb-2 text-slate-400">Best for your next stop</p>
                    <AttractionSpotlightCard
                      recommendation={topAttraction}
                      isPending={pendingItem?.id === topAttraction.suggestion.id}
                      compact={heroCompact}
                      onSelect={() => handleSelect(topAttraction.suggestion)}
                    />
                  </div>
                )}

                {/* Secondary list */}
                {secondaryAttractions.length > 0 && (
                  <div>
                    <p className="text-micro mb-2 text-slate-400">More nearby sights</p>
                    <div className="space-y-2.5">
                      {secondaryAttractions.map((rec) => (
                        <AttractionSuggestionCard
                          key={rec.suggestion.id}
                          recommendation={rec}
                          isExpanded={expandedId === rec.suggestion.id}
                          isPending={pendingItem?.id === rec.suggestion.id}
                          detailsLoading={detailsLoading && expandedId === rec.suggestion.id && !expandedData}
                          onToggleExpand={() => toggleExpand(rec.suggestion)}
                          onSelect={() => handleSelect(expandedId === rec.suggestion.id && expandedData ? { ...rec.suggestion, details: { ...rec.suggestion.details, ...expandedData.details } } : rec.suggestion)}
                          onCompareToggle={() => handleCompareAttractionToggle(rec.suggestion.id)}
                          isCompared={comparedAttractionIds.includes(rec.suggestion.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── ACTIVITIES TAB ── */}
            {activeTab === 'activities' && (
              <>
                {/* Booking context header */}
                {topActivity && (
                  <ActivityBookingHeader recommendation={topActivity} compact={heroCompact} />
                )}

                {/* Hero spotlight */}
                {topActivity && (
                  <div>
                    <p className="text-micro mb-2 text-slate-400">Top pick for today</p>
                    <ActivitySpotlightCard
                      recommendation={topActivity}
                      isPending={pendingItem?.id === topActivity.suggestion.id}
                      compact={heroCompact}
                      onSelect={() => handleSelect(topActivity.suggestion)}
                    />
                  </div>
                )}

                {/* Secondary list */}
                {secondaryActivities.length > 0 && (
                  <div>
                    <p className="text-micro mb-2 text-slate-400">More experiences nearby</p>
                    <div className="space-y-2.5">
                      {secondaryActivities.map((rec) => (
                        <ActivitySuggestionCard
                          key={rec.suggestion.id}
                          recommendation={rec}
                          isExpanded={expandedId === rec.suggestion.id}
                          isPending={pendingItem?.id === rec.suggestion.id}
                          detailsLoading={detailsLoading && expandedId === rec.suggestion.id && !expandedData}
                          onToggleExpand={() => toggleExpand(rec.suggestion)}
                          onSelect={() => handleSelect(expandedId === rec.suggestion.id && expandedData ? { ...rec.suggestion, details: { ...rec.suggestion.details, ...expandedData.details } } : rec.suggestion)}
                          onCompareToggle={() => handleCompareActivityToggle(rec.suggestion.id)}
                          isCompared={comparedActivityIds.includes(rec.suggestion.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="mx-4 mt-4 rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-surface">
            <div className="mx-auto mb-3 text-3xl">
              {activeTab === 'attractions' ? '🏔️' : '⚡'}
            </div>
            <p className="text-sm font-semibold text-slate-700">
              No {activeTab === 'attractions' ? 'attractions' : 'activities'} found
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Try tapping the search bar above to adjust the location
            </p>
          </div>
        )}
      </div>

      {/* ── Compare tray — shown when 2+ items are compared ── */}
      {!pendingItem && (comparedAttractionRecs.length > 0 || comparedActivityRecs.length > 0) && (
        <SightCompareTray
          activeTab={activeTab}
          comparedAttractions={comparedAttractionRecs}
          comparedActivities={comparedActivityRecs}
          onRemoveAttraction={handleCompareAttractionToggle}
          onRemoveActivity={handleCompareActivityToggle}
          onSelectAttraction={handleSelect}
          onSelectActivity={handleSelect}
        />
      )}

      {/* ── Add to plan confirmation — preserved exactly ── */}
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar
          newItemTitle={pendingItem.name}
          newItemPrice={pendingItem.price_label || undefined}
          tripContext={tripContext}
          confirmColor={
            activeTab === 'attractions'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-rose-500 hover:bg-rose-600'
          }
          onCancel={() => setPendingItem(null)}
          onConfirm={handleConfirmReplace}
        />
      )}
    </div>
  );
}
