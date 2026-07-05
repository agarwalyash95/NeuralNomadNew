'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Star, MapPin, Phone, Map, Globe, Check, Clock, Users, Shield, Award, IndianRupee } from 'lucide-react';
import { referenceService } from '@/services/reference.service';
import { useActivityStore } from '@/store/activityStore';
import { TripContext } from '../../types';
import CanvasHeader from '../shared/CanvasHeader';
import SearchSummaryBar from '../shared/SearchSummaryBar';
import QuickFilterBar from '../shared/QuickFilterBar';
import ReplaceConfirmBar from '../shared/ReplaceConfirmBar';
import { ItineraryItem } from '../../plan-canvas/mockData';

interface ActivitiesCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const ACTIVITY_FILTER_TAGS = ['All', 'Trekking', 'Paragliding', 'River Rafting', 'Skiing', 'Cultural', 'Camping'];

export default function ActivitiesCanvas({ onClose, tripContext, onAddToPlan }: ActivitiesCanvasProps) {
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination || 'Manali';
  const [searchQuery, setSearchQuery] = useState(`${defaultLocation}, India`);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['All']);
  const [pendingItem, setPendingItem] = useState<any | null>(null);

  // Accordion state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [results, setResults] = useState<any[]>([]);

  // Zustand Store for details caching
  const getActivityDetail = useActivityStore(state => state.getActivityDetail);
  const setActivityDetail = useActivityStore(state => state.setActivityDetail);

  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : 'Manali, India');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  const fetchActivities = async (query: string) => {
    setLoading(true);
    try {
      const data = await referenceService.exploreActivities(query);
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching activities:', err?.message || err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchActivities(searchQuery); }, [searchQuery]);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    // Check if deep details already in Zustand store
    const cachedItem = getActivityDetail(id);
    if (cachedItem) {
      setExpandedData(cachedItem);
      return;
    }

    setExpandedData(null);
    setDetailsLoading(true);
    try {
      const resp = await referenceService.getActivityDetails(id);
      setExpandedData(resp);
      setActivityDetail(id, resp);
    } catch (err) {
      console.error('Error fetching activity details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const priceText = pendingItem.price_estimate ? `₹${pendingItem.price_estimate}` : '₹1,200';
    const newItem: ItineraryItem = {
      id: `activity-${pendingItem.id}-${Date.now()}`,
      type: 'activity',
      title: pendingItem.name,
      subtitle: pendingItem.address || '',
      details: `${pendingItem.suggested_duration || '3-4 hrs'} • ${priceText} per person`,
      status: 'Pending',
      rating: Math.floor(pendingItem.user_rating || 0),
      geoTag: pendingItem.address || '',
      image: pendingItem.image_url,
    };
    onAddToPlan(newItem);
    setPendingItem(null);
    setExpandedId(null);
  };

  const searchSummary = `Activities in ${tripContext.destination || 'Manali'}`;

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader icon={<Zap size={18} />} iconColor="bg-rose-500" label="Activities" title={searchSummary} tripContext={tripContext} onClose={onClose} />
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary="Trekking, paragliding, adventure sports"
            accentColor="group-hover:text-rose-500" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar tags={ACTIVITY_FILTER_TAGS} selected={selectedTags}
              activeColor="border-rose-500 bg-rose-500 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} />
          </SearchSummaryBar>
        )}
        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Search Activities</h3>
              <button onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-slate-500">Cancel</button>
            </div>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. Manali, India"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
          </div>
        )}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-rose-500" />
              <p className="text-sm font-semibold text-slate-600">Finding thrilling activities...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{results.length} activities found</p>
              {results.map((place) => {
                const isExpanded = expandedId === place.id;
                const data = isExpanded ? (expandedData || place) : place;

                return (
                  <div key={place.id} className={`rounded-xl border bg-white transition-all overflow-hidden ${isExpanded ? 'border-rose-400 ring-2 ring-rose-100 shadow-md' : 'border-slate-200 hover:border-rose-300 hover:shadow-sm'}`}>

                    {/* Clickable Header/Card */}
                    <div
                      className="flex items-stretch gap-3 p-3 cursor-pointer"
                      onClick={() => toggleExpand(place.id)}
                    >
                      {/* Image - left 25% area */}
                      <div className="w-1/4 shrink-0 relative bg-slate-100 rounded-lg overflow-hidden min-h-[95px]">
                        {place.image_url ? (
                          <img src={place.image_url} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full text-slate-300 bg-rose-50">
                            <Zap size={24} className="text-rose-400" />
                          </div>
                        )}
                      </div>

                      {/* Info - right 75% */}
                      <div className="flex-1 py-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900 truncate leading-tight">{place.name}</h3>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wide">
                            {(place.primary_type || place.category || 'Adventure').replace(/_/g, ' ')}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            {place.difficulty_level || 'Moderate'}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">{place.address}</span>
                        </div>

                        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                          <div className="flex items-center gap-0.5">
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            <span className="font-semibold text-slate-800 ml-0.5">{place.user_rating || 4.6}</span>
                            <span className="text-slate-400">({place.user_ratings_total || 95})</span>
                          </div>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-0.5">
                            <IndianRupee size={10} /> {place.price_estimate ? `${place.price_estimate} / person` : '1,200 / person'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 font-medium flex items-center gap-0.5">
                            <Clock size={10} /> {place.suggested_duration || '3-4 hrs'}
                          </span>
                        </div>

                        {/* Quick Feature Highlights */}
                        <div className="mt-2 flex items-center gap-2.5">
                          {place.guided_tour && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600">
                              <Award size={10} className="text-rose-500" /> Guided Tour
                            </span>
                          )}
                          {place.equipment_included && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600">
                              <Shield size={10} className="text-rose-500" /> Gear Included
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Accordion Dropdown Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-rose-50/20 p-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        {detailsLoading && !expandedData ? (
                          <div className="flex justify-center p-4">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-rose-500" />
                          </div>
                        ) : data ? (
                          <div className="space-y-4">
                            {/* Secondary Images Gallery */}
                            {data.secondary_images && data.secondary_images.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pb-2 snap-x custom-scrollbar">
                                {data.secondary_images.map((img: string, i: number) => (
                                  <img key={i} src={img} alt="" className="h-24 w-32 shrink-0 object-cover rounded-lg snap-start border border-slate-200" />
                                ))}
                              </div>
                            )}

                            {/* Summary / Description */}
                            {data.editorial_summary && (
                              <div className="bg-white p-3 rounded-lg border border-slate-100 text-xs text-slate-700 italic">
                                "{data.editorial_summary}"
                              </div>
                            )}

                            {/* Activity Features & Logistics */}
                            <div className="grid grid-cols-2 gap-3 text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                              <div>
                                <h4 className="font-semibold text-slate-900 mb-2 border-b pb-1">Activity Info</h4>
                                <ul className="space-y-1.5">
                                  <li className="flex items-center gap-2">
                                    <Clock size={12} className="text-rose-500" /> {data.suggested_duration || '3-4 hours'}
                                  </li>
                                  <li className="flex items-center gap-2">
                                    <Award size={12} className="text-slate-400" /> Difficulty: {data.difficulty_level || 'Moderate'}
                                  </li>
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-900 mb-2 border-b pb-1">Inclusions & Perks</h4>
                                <ul className="space-y-1.5">
                                  {data.guided_tour && (
                                    <li className="flex items-center gap-2"><Check size={12} className="text-rose-500" /> Professional Guide</li>
                                  )}
                                  {data.equipment_included && (
                                    <li className="flex items-center gap-2"><Shield size={12} className="text-rose-500" /> Safety Gear Provided</li>
                                  )}
                                  {data.good_for_children && (
                                    <li className="flex items-center gap-2"><Check size={12} className="text-emerald-600" /> Suitable for Kids</li>
                                  )}
                                  {data.good_for_groups && (
                                    <li className="flex items-center gap-2"><Users size={12} className="text-slate-400" /> Group Discounts Available</li>
                                  )}
                                </ul>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                              {data.national_phone_number && (
                                <a href={`tel:${data.national_phone_number}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition">
                                  <Phone size={14} /> Call
                                </a>
                              )}
                              {data.latitude && data.longitude && (
                                <a href={`https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition">
                                  <Map size={14} /> Directions
                                </a>
                              )}
                              {data.website_uri && (
                                <a href={data.website_uri} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-xs font-semibold text-rose-800 transition">
                                  <Globe size={14} /> Book / Info
                                </a>
                              )}
                            </div>

                            {/* User Reviews Slider */}
                            {data.reviews && data.reviews.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Traveler Reviews</h4>
                                  <span className="text-[10px] font-medium text-slate-400">Scroll for more ({Math.min(data.reviews.length, 5)})</span>
                                </div>
                                <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory custom-scrollbar">
                                  {data.reviews.slice(0, 5).map((rev: any, i: number) => (
                                    <div key={i} className="w-[82%] shrink-0 snap-start bg-white p-3 rounded-xl border border-slate-100 text-xs shadow-xs flex flex-col justify-between">
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-semibold text-slate-900 truncate max-w-[140px]">{rev.authorAttribution?.displayName || 'Adventurer'}</span>
                                          <div className="flex text-amber-400 shrink-0">
                                            {[...Array(5)].map((_, idx) => (
                                              <Star key={idx} size={10} fill={idx < (rev.rating || 5) ? 'currentColor' : 'none'} className={idx < (rev.rating || 5) ? '' : 'text-slate-200'} />
                                            ))}
                                          </div>
                                        </div>
                                        <p className="text-slate-600 text-[11px] leading-relaxed whitespace-normal mt-1 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">{rev.text?.text || rev.text}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Select / Add Button */}
                            <button
                              onClick={(e) => { e.stopPropagation(); setPendingItem(place); }}
                              className={`w-full rounded-xl py-2.5 text-sm font-bold shadow transition-colors mt-2 ${pendingItem?.id === place.id ? 'bg-rose-600 text-white ring-2 ring-rose-200' : 'bg-rose-500 text-white hover:bg-rose-600'}`}
                            >
                              {pendingItem?.id === place.id ? 'Selected' : 'Select Activity'}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 text-center">Failed to load activity details.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 text-4xl">⚡</div>
              <p className="text-sm font-semibold text-slate-600">No activities found</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting the search query</p>
            </div>
          )}
        </div>
      </div>
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar newItemTitle={pendingItem.name} tripContext={tripContext}
          confirmColor="bg-rose-500 hover:bg-rose-600"
          onCancel={() => setPendingItem(null)} onConfirm={handleConfirmReplace} />
      )}
    </div>
  );
}
