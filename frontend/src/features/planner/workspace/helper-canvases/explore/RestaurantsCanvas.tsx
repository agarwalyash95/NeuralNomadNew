'use client';

import React, { useState, useEffect } from 'react';
import { Utensils, Star, MapPin, Phone, Map, Globe, Check, Coffee, Dog, Users, Car, CreditCard } from 'lucide-react';
import { referenceService } from '@/services/reference.service';
import { useRestaurantStore } from '@/store/restaurantStore';
import { TripContext } from '../../types';
import CanvasHeader from '../shared/CanvasHeader';
import SearchSummaryBar from '../shared/SearchSummaryBar';
import QuickFilterBar from '../shared/QuickFilterBar';
import ReplaceConfirmBar from '../shared/ReplaceConfirmBar';
import { ItineraryItem } from '../../plan-canvas/mockData';

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
  
  const [pendingItem, setPendingItem] = useState<any | null>(null);

  // Accordion state
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [results, setResults] = useState<any[]>([]);

  // Zustand Store
  const getRestaurantDetail = useRestaurantStore(state => state.getRestaurantDetail);
  const setRestaurantDetail = useRestaurantStore(state => state.setRestaurantDetail);
  
  useEffect(() => {
    const loc = tripContext.activeNodeCityName || tripContext.destination;
    setSearchQuery(loc ? `${loc}, India` : 'Manali, India');
  }, [tripContext.tripId, tripContext.activeNodeCityName, tripContext.destination]);

  const fetchRestaurants = async (query: string) => {
    setLoading(true);
    try {
      const data = await referenceService.exploreRestaurants(query);
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching restaurants:', err?.message || err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(searchQuery); }, [searchQuery]);

  const toggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    
    // Check if deep details already in store
    const cachedItem = getRestaurantDetail(id);
    if (cachedItem) {
        setExpandedData(cachedItem);
        return;
    }
    
    setExpandedData(null);
    setDetailsLoading(true);
    try {
      const resp = await referenceService.getRestaurantDetails(id);
      setExpandedData(resp);
      
      // Update store ONLY for clicked restaurant
      setRestaurantDetail(id, resp);
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const priceStr = pendingItem.price_level != null ? '₹'.repeat(pendingItem.price_level + 1) : '₹₹';
    const newItem: ItineraryItem = {
      id: `food-${pendingItem.id}-${Date.now()}`,
      type: 'food',
      title: pendingItem.name,
      subtitle: pendingItem.address || '',
      details: `${priceStr} • ${pendingItem.primary_type || 'Restaurant'}`,
      status: 'Pending',
      rating: Math.floor(pendingItem.user_rating || 0),
      geoTag: pendingItem.address || '',
      image: pendingItem.image_url,
    };
    onAddToPlan(newItem);
    setPendingItem(null);
    setExpandedId(null);
  };

  const searchSummary = `Restaurants in ${tripContext.destination || 'Manali'}`;

  // Helper to render price text explicitly
  const renderPriceText = (level?: number) => {
    if (level === undefined || level === null) return '₹400 for two';
    const prices = [
      '₹200 for two',
      '₹500 for two',
      '₹1000 for two',
      '₹2000 for two',
      '₹4000+ for two'
    ];
    return prices[Math.min(level, 4)];
  };

  const renderPrice = (level?: number) => {
    if (level === undefined || level === null) return '₹₹';
    return '₹'.repeat(level + 1) || '₹';
  };

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
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{results.length} places found</p>
              {results.map((place) => {
                const isExpanded = expandedId === place.id;
                // data to show in expanded view (prefer deeply loaded data if available, otherwise just use what we have in the list)
                const data = isExpanded ? (expandedData || place) : place;

                return (
                  <div key={place.id} className={`rounded-xl border bg-white transition-all overflow-hidden ${isExpanded ? 'border-orange-400 ring-2 ring-orange-100 shadow-md' : 'border-slate-200 hover:border-orange-300 hover:shadow-sm'}`}>
                    
                    {/* Clickable Header/Card */}
                    <div 
                      className="flex items-stretch gap-3 p-3 cursor-pointer" 
                      onClick={() => toggleExpand(place.id)}
                    >
                      {/* Image - left 25% area */}
                      <div className="w-1/4 shrink-0 relative bg-slate-100 rounded-lg overflow-hidden min-h-[90px]">
                        {place.image_url ? (
                          <img src={place.image_url} alt={place.name} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full text-slate-300">
                            <Utensils size={24} />
                          </div>
                        )}
                      </div>
                      
                      {/* Info - right 75% */}
                      <div className="flex-1 py-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900 truncate leading-tight">{place.name}</h3>
                        
                        {place.primary_type && (
                          <p className="text-[11px] font-medium text-orange-600 mt-0.5 uppercase tracking-wide">
                            {place.primary_type.replace(/_/g, ' ')}
                          </p>
                        )}

                        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">{place.address}</span>
                        </div>
                        
                        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                          <div className="flex items-center gap-0.5">
                            <Star size={12} className="text-orange-400 fill-orange-400" />
                            <span className="font-semibold text-slate-800 ml-0.5">{place.user_rating}</span>
                            <span className="text-slate-400">({place.user_ratings_total})</span>
                          </div>
                          <span className="text-slate-300">•</span>
                          <span className="font-bold text-slate-700">{renderPrice(place.price_level)}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 font-medium">{renderPriceText(place.price_level)}</span>
                        </div>
                        
                        {/* Quick Fulfillment Icons */}
                        {(place.dine_in || place.takeout || place.delivery) && (
                           <div className="mt-2 flex items-center gap-3">
                             {place.dine_in && <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600"><Utensils size={10}/> Dine-in</span>}
                             {place.takeout && <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600"><Check size={10}/> Takeout</span>}
                             {place.delivery && <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600"><Check size={10}/> Delivery</span>}
                           </div>
                        )}
                      </div>
                    </div>

                    {/* Accordion Dropdown Details */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-orange-50/20 p-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        {detailsLoading && !expandedData ? (
                          <div className="flex justify-center p-4">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-orange-500" />
                          </div>
                        ) : data ? (
                          <div className="space-y-4">
                            {/* Secondary Images Preview */}
                            {data.secondary_images && data.secondary_images.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pb-2 snap-x custom-scrollbar">
                                {data.secondary_images.map((img: string, i: number) => (
                                  <img key={i} src={img} alt="" className="h-24 w-32 shrink-0 object-cover rounded-lg snap-start border border-slate-200" />
                                ))}
                              </div>
                            )}

                            {/* Atmosphere & Family Details */}
                            <div className="grid grid-cols-2 gap-3 text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-2 border-b pb-1">Atmosphere</h4>
                                    <ul className="space-y-1.5">
                                        <li className="flex items-center gap-2"><Coffee size={12} className="text-slate-400"/> {data.outdoor_seating ? 'Outdoor Seating' : 'Indoor Only'}</li>
                                        {data.good_for_groups && <li className="flex items-center gap-2"><Users size={12} className="text-slate-400"/> Good for Groups</li>}
                                        {data.allows_dogs && <li className="flex items-center gap-2"><Dog size={12} className="text-slate-400"/> Allows Dogs</li>}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900 mb-2 border-b pb-1">Family & Logistics</h4>
                                    <ul className="space-y-1.5">
                                        {data.good_for_children && <li className="flex items-center gap-2"><Check size={12} className="text-green-500"/> Good for Kids</li>}
                                        {data.menu_for_children && <li className="flex items-center gap-2"><Utensils size={12} className="text-green-500"/> Kids Menu</li>}
                                        <li className="flex items-center gap-2"><Car size={12} className="text-slate-400"/> {data.parking_options?.freeParkingLot ? 'Free Parking' : 'Paid/No Parking'}</li>
                                        <li className="flex items-center gap-2"><CreditCard size={12} className="text-slate-400"/> {data.payment_options?.acceptsCreditCards ? 'Accepts Cards' : 'Cash Options'}</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2">
                                {data.national_phone_number && (
                                    <a href={`tel:${data.national_phone_number}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition">
                                        <Phone size={14}/> Call
                                    </a>
                                )}
                                {data.latitude && data.longitude && (
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition">
                                        <Map size={14}/> Directions
                                    </a>
                                )}
                                {data.website_uri && (
                                    <a href={data.website_uri} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-orange-100 hover:bg-orange-200 text-xs font-semibold text-orange-700 transition">
                                        <Globe size={14}/> Menu
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
                                          <span className="font-semibold text-slate-900 truncate max-w-[140px]">{rev.authorAttribution?.displayName || 'User'}</span>
                                          <div className="flex text-orange-400 shrink-0">
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

                            {/* Add Button */}
                            <button 
                              onClick={(e) => { e.stopPropagation(); setPendingItem(place); }}
                              className={`w-full rounded-xl py-2.5 text-sm font-bold shadow transition-colors mt-2 ${pendingItem?.id === place.id ? 'bg-orange-600 text-white ring-2 ring-orange-200' : 'bg-orange-500 text-white hover:bg-orange-600'}`}
                            >
                              {pendingItem?.id === place.id ? 'Selected' : 'Select Restaurant'}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 text-center">Failed to load details.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
        <ReplaceConfirmBar newItemTitle={pendingItem.name} tripContext={tripContext}
          confirmColor="bg-orange-500 hover:bg-orange-600"
          onCancel={() => setPendingItem(null)} onConfirm={handleConfirmReplace} />
      )}
    </div>
  );
}
