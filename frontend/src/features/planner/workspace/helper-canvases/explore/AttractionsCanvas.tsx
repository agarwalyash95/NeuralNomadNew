'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Star, MapPin, Phone, Map, Globe, Check, Clock, Users, Accessibility, Ticket } from 'lucide-react';
import { referenceService } from '@/services/reference.service';
import { useAttractionStore } from '@/store/attractionStore';
import { TripContext } from '../../types';
import CanvasHeader from '../shared/CanvasHeader';
import SearchSummaryBar from '../shared/SearchSummaryBar';
import QuickFilterBar from '../shared/QuickFilterBar';
import ReplaceConfirmBar from '../shared/ReplaceConfirmBar';
import { ItineraryItem } from '../../plan-canvas/mockData';

interface AttractionsCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const SIGHT_FILTER_TAGS = ['All Sights', 'Temples', 'Viewpoints', 'Waterfalls', 'Heritage', 'Parks'];

export default function AttractionsCanvas({ onClose, tripContext, onAddToPlan }: AttractionsCanvasProps) {
  const defaultLocation = tripContext.activeNodeCityName || tripContext.destination || 'Manali';
  const [searchQuery, setSearchQuery] = useState(`${defaultLocation}, India`);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['All Sights']);
  const [pendingItem, setPendingItem] = useState<any | null>(null);

  // Accordion state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [results, setResults] = useState<any[]>([]);

  // Zustand Store for details caching
  const getAttractionDetail = useAttractionStore(state => state.getAttractionDetail);
  const setAttractionDetail = useAttractionStore(state => state.setAttractionDetail);

  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : 'Manali, India');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  const fetchAttractions = async (query: string) => {
    setLoading(true);
    try {
      const data = await referenceService.exploreAttractions(query);
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching attractions:', err?.message || err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAttractions(searchQuery); }, [searchQuery]);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    // Check if deep details already in Zustand store
    const cachedItem = getAttractionDetail(id);
    if (cachedItem) {
      setExpandedData(cachedItem);
      return;
    }

    setExpandedData(null);
    setDetailsLoading(true);
    try {
      const resp = await referenceService.getAttractionDetails(id);
      setExpandedData(resp);
      setAttractionDetail(id, resp);
    } catch (err) {
      console.error('Error fetching attraction details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `attraction-${pendingItem.id}-${Date.now()}`,
      type: 'attraction',
      title: pendingItem.name,
      subtitle: pendingItem.address || '',
      details: `${pendingItem.suggested_duration_mins ? `${Math.round(pendingItem.suggested_duration_mins / 60)} hrs` : '2 hrs'} • ${pendingItem.ticket_price_estimate || 'Free Entry'}`,
      status: 'Pending',
      rating: Math.floor(pendingItem.user_rating || 0),
      geoTag: pendingItem.address || '',
      image: pendingItem.image_url,
    };
    onAddToPlan(newItem);
    setPendingItem(null);
    setExpandedId(null);
  };

  const searchSummary = `Sights in ${tripContext.destination || 'Manali'}`;

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader icon={<Compass size={18} />} iconColor="bg-emerald-600" label="Attractions" title={searchSummary} tripContext={tripContext} onClose={onClose} />
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary="Temples, viewpoints, heritage sites"
            accentColor="group-hover:text-emerald-600" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar tags={SIGHT_FILTER_TAGS} selected={selectedTags}
              activeColor="border-emerald-600 bg-emerald-600 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} />
          </SearchSummaryBar>
        )}
        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Search Attractions</h3>
              <button onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-slate-500">Cancel</button>
            </div>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="e.g. Manali, India"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </div>
        )}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-emerald-600" />
              <p className="text-sm font-semibold text-slate-600">Discovering attractions...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{results.length} attractions found</p>
              {results.map((place) => {
                const isExpanded = expandedId === place.id;
                const data = isExpanded ? (expandedData || place) : place;

                return (
                  <div key={place.id} className={`rounded-xl border bg-white transition-all overflow-hidden ${isExpanded ? 'border-emerald-500 ring-2 ring-emerald-100 shadow-md' : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm'}`}>

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
                          <div className="flex items-center justify-center h-full w-full text-slate-300 bg-emerald-50">
                            <Compass size={24} className="text-emerald-400" />
                          </div>
                        )}
                      </div>

                      {/* Info - right 75% */}
                      <div className="flex-1 py-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900 truncate leading-tight">{place.name}</h3>

                        {place.primary_type && (
                          <p className="text-[11px] font-semibold text-emerald-700 mt-0.5 uppercase tracking-wide">
                            {place.primary_type.replace(/_/g, ' ')}
                          </p>
                        )}

                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">{place.address}</span>
                        </div>

                        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                          <div className="flex items-center gap-0.5">
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            <span className="font-semibold text-slate-800 ml-0.5">{place.user_rating || 4.5}</span>
                            <span className="text-slate-400">({place.user_ratings_total || 120})</span>
                          </div>
                          <span className="text-slate-300">•</span>
                          <span className="font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                            {place.ticket_price_estimate || 'Free Entry'}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 font-medium flex items-center gap-0.5">
                            <Clock size={10} /> 2 hrs
                          </span>
                        </div>

                        {/* Quick Feature Highlights */}
                        <div className="mt-2 flex items-center gap-2.5">
                          {place.good_for_children && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600">
                              <Check size={10} className="text-emerald-600" /> Kid Friendly
                            </span>
                          )}
                          {place.wheelchair_accessible && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600">
                              <Accessibility size={10} className="text-emerald-600" /> Accessible
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Accordion Dropdown Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-emerald-50/20 p-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        {detailsLoading && !expandedData ? (
                          <div className="flex justify-center p-4">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
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

                            {/* Visitor Info & Logistics */}
                            <div className="grid grid-cols-2 gap-3 text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                              <div>
                                <h4 className="font-semibold text-slate-900 mb-2 border-b pb-1">Visiting Details</h4>
                                <ul className="space-y-1.5">
                                  <li className="flex items-center gap-2">
                                    <Ticket size={12} className="text-emerald-600" /> {data.ticket_price_estimate || 'Free Entry'}
                                  </li>
                                  <li className="flex items-center gap-2">
                                    <Clock size={12} className="text-slate-400" /> {data.opening_hours?.[0] || 'Open Daily 9:00 AM - 6:00 PM'}
                                  </li>
                                </ul>
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-900 mb-2 border-b pb-1">Accessibility & Amenities</h4>
                                <ul className="space-y-1.5">
                                  {data.good_for_children && (
                                    <li className="flex items-center gap-2"><Check size={12} className="text-emerald-600" /> Kid Friendly</li>
                                  )}
                                  {data.wheelchair_accessible && (
                                    <li className="flex items-center gap-2"><Accessibility size={12} className="text-emerald-600" /> Wheelchair Accessible</li>
                                  )}
                                  {data.good_for_groups && (
                                    <li className="flex items-center gap-2"><Users size={12} className="text-slate-400" /> Good for Groups</li>
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
                                <a href={data.website_uri} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-xs font-semibold text-emerald-800 transition">
                                  <Globe size={14} /> Website
                                </a>
                              )}
                            </div>

                            {/* User Reviews Slider */}
                            {data.reviews && data.reviews.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Top Reviews</h4>
                                  <span className="text-[10px] font-medium text-slate-400">Scroll for more ({Math.min(data.reviews.length, 5)})</span>
                                </div>
                                <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory custom-scrollbar">
                                  {data.reviews.slice(0, 5).map((rev: any, i: number) => (
                                    <div key={i} className="w-[82%] shrink-0 snap-start bg-white p-3 rounded-xl border border-slate-100 text-xs shadow-xs flex flex-col justify-between">
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-semibold text-slate-900 truncate max-w-[140px]">{rev.authorAttribution?.displayName || 'Traveler'}</span>
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
                              className={`w-full rounded-xl py-2.5 text-sm font-bold shadow transition-colors mt-2 ${pendingItem?.id === place.id ? 'bg-emerald-700 text-white ring-2 ring-emerald-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                            >
                              {pendingItem?.id === place.id ? 'Selected' : 'Select Attraction'}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 text-center">Failed to load attraction details.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 text-4xl">🏛️</div>
              <p className="text-sm font-semibold text-slate-600">No attractions found</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting the search query</p>
            </div>
          )}
        </div>
      </div>
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar newItemTitle={pendingItem.name} tripContext={tripContext}
          confirmColor="bg-emerald-600 hover:bg-emerald-700"
          onCancel={() => setPendingItem(null)} onConfirm={handleConfirmReplace} />
      )}
    </div>
  );
}
