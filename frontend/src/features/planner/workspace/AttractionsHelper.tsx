'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, Navigation, Map, Compass } from 'lucide-react';
import { useExplore } from '@/hooks/use-explore';
import { useExploreDetails } from '@/hooks/use-explore-details';
import { attractionService } from '@/services/attraction.service';
import { useDebounce } from '@/hooks/use-debounce';
import { PlaceCard } from '@/components/explore/place-card';
import { DetailsModal } from '@/components/explore/details-modal';

export default function AttractionsHelper() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchingDropdown, setSearchingDropdown] = useState(false);
  const [currentLocationStr, setCurrentLocationStr] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'sights' | 'food' | 'activities'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { exploreLocation, places, loading: exploring } = useExplore();
  const { fetchDetails, details, loading: loadingDetails } = useExploreDetails();

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedSearch.length < 2) {
        setSuggestions([]);
        return;
      }
      setSearchingDropdown(true);
      try {
        const data = await attractionService.autocomplete(debouncedSearch);
        setSuggestions(data.predictions || []);
        setShowDropdown(true);
      } catch (e) {
        console.error(e);
      } finally {
        setSearchingDropdown(false);
      }
    };
    fetchSuggestions();
  }, [debouncedSearch]);

  const handleSelectLocation = (prediction: any) => {
    const locationName = prediction.structured_formatting?.main_text || prediction.description;
    setSearchQuery(locationName);
    setShowDropdown(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length > 0) {
      setShowDropdown(false);
      setCurrentLocationStr(searchQuery);
      setIsSearchExpanded(false);
      exploreLocation(searchQuery);
    }
  };

  const handlePlaceClick = (placeId: string | number) => {
    setIsModalOpen(true);
    fetchDetails(placeId);
  };

  const sights = places.filter(
    (p) => p.category === 'tourist_attraction' || p.category === 'museum' || p.category === 'monument' || p.category === 'temple'
  );
  const restaurants = places.filter((p) => p.category === 'restaurant');
  const activities = places.filter(
    (p) => p.category === 'amusement_park' || p.category === 'park' || p.category === 'local_activities'
  );

  let filteredPlaces = places;
  if (activeFilter === 'sights') filteredPlaces = sights;
  if (activeFilter === 'food') filteredPlaces = restaurants;
  if (activeFilter === 'activities') filteredPlaces = activities;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f7f4ed]">
      <div className="sticky top-0 z-20 shrink-0 border-b border-[#e2ddd2] bg-white/90 p-4 backdrop-blur-sm">
        <div className="flex gap-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button onClick={() => setActiveFilter('all')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${activeFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}>
            All
          </button>
          <button onClick={() => setActiveFilter('sights')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${activeFilter === 'sights' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}>
            Sights
          </button>
          <button onClick={() => setActiveFilter('food')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${activeFilter === 'food' ? 'bg-rose-500 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}>
            Food
          </button>
          <button onClick={() => setActiveFilter('activities')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${activeFilter === 'activities' ? 'bg-violet-600 text-white' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}>
            Fun
          </button>
        </div>
      </div>

      <div className="flex-1 p-4">
        {!isSearchExpanded ? (
          <div
            onClick={() => setIsSearchExpanded(true)}
            className="flex w-full cursor-pointer items-center justify-between rounded-[24px] border border-[#ddd7ca] bg-white p-4 shadow-sm transition-colors hover:bg-[#faf8f2]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[#e9e3d8] bg-[#f6f4ef] p-2 text-blue-600">
                <Compass size={16} />
              </div>
              <div>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Explore</p>
                <p className="max-w-[220px] truncate text-sm font-semibold text-slate-800">
                  {currentLocationStr || 'Where to?'}
                </p>
              </div>
            </div>
            <Search size={16} className="text-slate-400" />
          </div>
        ) : (
          <form onSubmit={handleSearchSubmit} className="relative flex flex-col gap-3 rounded-[24px] border border-[#ddd7ca] bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Search destination</h3>
              {currentLocationStr ? (
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(false)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Cancel
                </button>
              ) : null}
            </div>

            <div ref={dropdownRef} className="group relative w-full rounded-2xl border border-[#ddd7ca] bg-white px-3 py-3 transition-colors focus-within:border-blue-500">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600">
                Location
              </label>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="shrink-0 text-slate-400 group-focus-within:text-blue-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  placeholder="Tokyo, Japan"
                  className="w-full truncate bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none"
                />
              </div>

              {showDropdown && searchQuery.length > 1 ? (
                <div className="custom-scrollbar absolute left-0 right-0 top-[110%] z-50 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {searchingDropdown ? (
                    <div className="flex justify-center p-4">
                      <Loader2 size={20} className="animate-spin text-blue-600" />
                    </div>
                  ) : suggestions.length > 0 ? (
                    <ul className="py-2">
                      {suggestions.map((pred) => (
                        <li
                          key={pred.place_id}
                          onClick={() => handleSelectLocation(pred)}
                          className="flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-slate-50"
                        >
                          <Navigation size={14} className="shrink-0 text-slate-400" />
                          <div className="truncate">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {pred.structured_formatting?.main_text || pred.description}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {pred.structured_formatting?.secondary_text}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-500">No places found.</div>
                  )}
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 disabled:opacity-50"
            >
              <Search size={16} />
              Explore
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-[#e7e1d5] pt-4">
          {exploring ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Finding the best spots...</p>
            </div>
          ) : currentLocationStr ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800">
                Top {activeFilter !== 'all' ? activeFilter : 'places'} in {currentLocationStr.split(',')[0]}
              </h3>
              {filteredPlaces.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {filteredPlaces.map((place) => (
                    <div key={place.id} onClick={() => handlePlaceClick(place.id)} className="cursor-pointer">
                      <PlaceCard place={place} compact />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center">
                  <Map size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600">No places found</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <DetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} details={details} loading={loadingDetails} />
    </div>
  );
}
