'use client';

import React, { useState, useEffect } from 'react';
import { Compass, X, Edit2, Star } from 'lucide-react';
import { attractionService } from '@/services/attraction.service';

interface AttractionsCanvasProps {
  onClose?: () => void;
}

export default function AttractionsCanvas({ onClose }: AttractionsCanvasProps) {
  const [searchQuery, setSearchQuery] = useState('Mumbai, India');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'sights' | 'food' | 'activities'>('all');

  const fetchAttractions = async (query: string) => {
    setLoading(true);
    try {
      const response = await attractionService.explore(query);
      const apiResults = response.results || [];
      const mapped = apiResults.map((place: any) => {
        const openHours = place.opening_hours ? Object.values(place.opening_hours)[0] : '9:00 AM - 6:00 PM';
        return {
          id: place.id,
          name: place.name,
          location: place.address || `${place.destination?.city || ''}, ${place.destination?.country || ''}`,
          rating: place.rating || 4.5,
          description: place.description,
          openHours: openHours,
          entryFee: place.ticket_price || 'Free Entry',
          timeNeeded: place.estimated_duration || '2-3 hours',
          image: '🎡',
          category: place.category,
        };
      });
      setResults(mapped);
    } catch (err) {
      console.error('Error fetching attractions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttractions(searchQuery);
  }, []);



  const filterResults = () => {
    if (activeFilter === 'all') return results;
    if (activeFilter === 'sights') {
      return results.filter(r => 
        r.category === 'temple' || 
        r.category === 'tourist_attraction' || 
        r.category === 'sightseeing' || 
        r.category === 'Sights'
      );
    }
    if (activeFilter === 'food') {
      return results.filter(r => 
        r.category === 'restaurant' || 
        r.category === 'cafe' || 
        r.category === 'Food'
      );
    }
    if (activeFilter === 'activities') {
      return results.filter(r => 
        r.category === 'amusement_park' || 
        r.category === 'activity' || 
        r.category === 'Activities'
      );
    }
    return results;
  };

  const handleUpdateLocation = async () => {
    setIsSearchExpanded(false);
    await fetchAttractions(searchQuery);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600 text-white">
              <Compass size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Explore</p>
              <h2 className="text-sm font-semibold text-slate-900">{searchQuery}</h2>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {/* Search Bar Summary */}
        {!isSearchExpanded && (
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-rose-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{searchQuery}</p>
                  <p className="mt-1 text-xs text-slate-500">Explore sights, dining and local activities</p>
                </div>
                <Edit2 size={16} className="text-slate-400 group-hover:text-rose-600" />
              </div>
            </button>

            {/* Tabs / Filters */}
            <div className="mt-4 flex gap-1 rounded-lg bg-slate-100 p-1">
              {(['all', 'sights', 'food', 'activities'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                    activeFilter === filter
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expanded Search Form */}
        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Change Location</h3>
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Where to explore?"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-rose-500 focus:outline-none"
                />
              </div>

              <button
                onClick={handleUpdateLocation}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white transition-all hover:bg-rose-700"
              >
                Search
              </button>
            </div>
          </div>
        )}

        {/* Results Section */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-rose-600" />
              <p className="text-sm font-semibold text-slate-600">Discovering places...</p>
            </div>
          ) : filterResults().length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{filterResults().length} places found</p>

              {/* Place Cards */}
              {filterResults().map((place) => (
                <div
                  key={place.id}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-rose-300 hover:shadow-md"
                >
                  <div className="flex gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-3xl">
                      {place.image}
                    </div>

                    <div className="flex-1">
                      <div className="mb-1 flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{place.name}</h3>
                          <p className="text-xs text-slate-500">{place.location}</p>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="font-semibold text-slate-900">{place.rating}</span>
                          <Star size={12} className="fill-amber-400 text-amber-400" />
                        </div>
                      </div>

                      <p className="mb-2 text-xs text-slate-600">{place.description}</p>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>{place.openHours}</span>
                        <span>•</span>
                        <span className="font-semibold text-green-600">{place.entryFee}</span>
                        <span>•</span>
                        <span>{place.timeNeeded}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <Compass size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No places found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
