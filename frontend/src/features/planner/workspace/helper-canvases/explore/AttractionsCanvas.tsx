'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Compass, Zap } from 'lucide-react';
import { referenceService } from '@/services/reference.service';
import { useAttractionStore } from '@/store/attractionStore';
import { useActivityStore } from '@/store/activityStore';
import { TripContext } from '../../types';
import CanvasHeader from '../shared/CanvasHeader';
import SearchSummaryBar from '../shared/SearchSummaryBar';
import QuickFilterBar from '../shared/QuickFilterBar';
import ReplaceConfirmBar from '../shared/ReplaceConfirmBar';
import SuggestionCard from '../shared/SuggestionCard';
import { ItineraryItem, Suggestion } from '../../plan-canvas/types';

interface AttractionsCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const SIGHT_FILTER_TAGS = ['All Sights', 'Temples', 'Viewpoints', 'Waterfalls', 'Heritage', 'Parks'];
const ACTIVITY_FILTER_TAGS = ['All Activities', 'Trekking', 'Paragliding', 'River Rafting', 'Skiing', 'Cultural', 'Camping'];

export default function AttractionsCanvas({ onClose, tripContext, onAddToPlan }: AttractionsCanvasProps) {
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination || 'Manali';
  const [searchQuery, setSearchQuery] = useState(`${defaultLocation}, India`);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveCategory] = useState<'attractions' | 'activities'>('attractions');

  const [selectedSights, setSelectedSights] = useState<string[]>(['All Sights']);
  const [selectedActivities, setSelectedActivities] = useState<string[]>(['All Activities']);
  const [pendingItem, setPendingItem] = useState<Suggestion | null>(null);

  // Accordion state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<Suggestion | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [attractions, setAttractions] = useState<Suggestion[]>([]);
  const [activities, setActivities] = useState<Suggestion[]>([]);

  // Zustand Stores for details caching
  const getAttractionDetail = useAttractionStore(state => state.getAttractionDetail);
  const setAttractionDetail = useAttractionStore(state => state.setAttractionDetail);
  const getActivityDetail = useActivityStore(state => state.getActivityDetail);
  const setActivityDetail = useActivityStore(state => state.setActivityDetail);

  // Set active tab based on active triggering node context
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

  const fetchData = async (query: string) => {
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

  // Don't recommend what's already planned for the day in view
  const plannedTitles = useMemo(
    () => new Set((tripContext.activeDayItemTitles || []).map(t => t.trim().toLowerCase())),
    [tripContext.activeDayItemTitles]
  );
  const visibleAttractions = useMemo(
    () => attractions.filter(a => !plannedTitles.has(a.name.trim().toLowerCase())),
    [attractions, plannedTitles]
  );
  const visibleActivities = useMemo(
    () => activities.filter(a => !plannedTitles.has(a.name.trim().toLowerCase())),
    [activities, plannedTitles]
  );
  const visibleResults = activeTab === 'attractions' ? visibleAttractions : visibleActivities;

  const toggleExpand = async (suggestion: Suggestion) => {
    if (expandedId === suggestion.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(suggestion.id);

    const cachedItem = activeTab === 'attractions' ? getAttractionDetail(suggestion.id) : getActivityDetail(suggestion.id);
    if (cachedItem) {
      setExpandedData(cachedItem);
      return;
    }

    setExpandedData(null);
    setDetailsLoading(true);
    try {
      const resp = activeTab === 'attractions'
        ? await referenceService.getAttractionDetails(suggestion.id)
        : await referenceService.getActivityDetails(suggestion.id);
      setExpandedData(resp);
      if (activeTab === 'attractions') {
        setAttractionDetail(suggestion.id, resp);
      } else {
        setActivityDetail(suggestion.id, resp);
      }
    } catch (err) {
      console.error('Error fetching attraction/activity details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;

    const newItem: ItineraryItem = {
      id: `${activeTab === 'attractions' ? 'attraction' : 'activity'}-${pendingItem.id}-${Date.now()}`,
      type: activeTab === 'attractions' ? 'attraction' : 'activity',
      title: pendingItem.name,
      subtitle: pendingItem.address || '',
      details: [pendingItem.duration_label, pendingItem.price_label].filter(Boolean).join(' • ') || undefined,
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

  const searchSummary = activeTab === 'attractions'
    ? `Sights in ${tripContext.destination || 'Manali'}`
    : `Activities in ${tripContext.destination || 'Manali'}`;

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader
        icon={activeTab === 'attractions' ? <Compass size={18} /> : <Zap size={18} />}
        iconColor={activeTab === 'attractions' ? "bg-emerald-600" : "bg-rose-500"}
        label={activeTab === 'attractions' ? "Attractions" : "Activities"}
        title={searchSummary}
        tripContext={tripContext}
        onClose={onClose}
      />

      {/* Category Selection Tabs */}
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
            <span>🏛️ Attractions</span>
            {visibleAttractions.length > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
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
                ? 'bg-white text-rose-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap size={13} />
            <span>⚡ Activities</span>
            {visibleActivities.length > 0 && (
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                activeTab === 'activities' ? 'bg-rose-50 text-rose-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {visibleActivities.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar
            primary={searchSummary}
            secondary={activeTab === 'attractions' ? "Temples, viewpoints, heritage sites" : "Trekking, paragliding, adventure sports"}
            accentColor={activeTab === 'attractions' ? "group-hover:text-emerald-600" : "group-hover:text-rose-500"}
            onClick={() => setIsSearchExpanded(true)}
          >
            {activeTab === 'attractions' ? (
              <QuickFilterBar
                tags={SIGHT_FILTER_TAGS}
                selected={selectedSights}
                activeColor="border-emerald-600 bg-emerald-600 text-white shadow-sm"
                hoverColor="border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                onToggle={tag => setSelectedSights(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
              />
            ) : (
              <QuickFilterBar
                tags={ACTIVITY_FILTER_TAGS}
                selected={selectedActivities}
                activeColor="border-rose-500 bg-rose-500 text-white shadow-sm"
                hoverColor="border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50"
                onToggle={tag => setSelectedActivities(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
              />
            )}
          </SearchSummaryBar>
        )}

        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                {activeTab === 'attractions' ? 'Search Attractions' : 'Search Activities'}
              </h3>
              <button onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-slate-500">Cancel</button>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. Manali, India"
              className={`w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:ring-2 ${
                activeTab === 'attractions'
                  ? 'focus:border-emerald-400 focus:ring-emerald-100'
                  : 'focus:border-rose-400 focus:ring-rose-100'
              }`}
            />
          </div>
        )}

        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className={`mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 ${
                activeTab === 'attractions' ? 'border-t-emerald-600' : 'border-t-rose-500'
              }`} />
              <p className="text-sm font-semibold text-slate-600">
                {activeTab === 'attractions' ? 'Discovering attractions...' : 'Finding thrilling activities...'}
              </p>
            </div>
          ) : visibleResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">
                {visibleResults.length} {activeTab === 'attractions' ? 'attractions' : 'activities'} found
              </p>
              {visibleResults.map((place) => (
                <SuggestionCard
                  key={place.id}
                  suggestion={place}
                  isExpanded={expandedId === place.id}
                  isPending={pendingItem?.id === place.id}
                  detailsLoading={detailsLoading && expandedId === place.id && !expandedData}
                  onToggleExpand={() => toggleExpand(place)}
                  onSelect={() => setPendingItem(expandedId === place.id ? (expandedData || place) : place)}
                  selectLabel={activeTab === 'attractions' ? 'Select Attraction' : 'Select Activity'}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 text-4xl">🏛️</div>
              <p className="text-sm font-semibold text-slate-600">No {activeTab === 'attractions' ? 'attractions' : 'activities'} found</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting the search query</p>
            </div>
          )}
        </div>
      </div>

      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar
          newItemTitle={pendingItem.name}
          newItemPrice={pendingItem.price_label || undefined}
          tripContext={tripContext}
          confirmColor={activeTab === 'attractions' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-500 hover:bg-rose-600"}
          onCancel={() => setPendingItem(null)}
          onConfirm={handleConfirmReplace}
        />
      )}
    </div>
  );
}
