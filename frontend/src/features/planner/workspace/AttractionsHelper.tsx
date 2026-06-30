'use client';

import React, { useState, useEffect } from 'react';
import { Search, Compass } from 'lucide-react';
import { useExplore } from '@/hooks/use-explore';
import { useExploreDetails } from '@/hooks/use-explore-details';
import { attractionService } from '@/services/attraction.service';
import { useDebounce } from '@/hooks/use-debounce';
import { DetailsModal } from '@/components/explore/details-modal';
import AttractionsSearchForm from './helpers/attractions/AttractionsSearchForm';
import AttractionsResults from './helpers/attractions/AttractionsResults';

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
          <AttractionsSearchForm
            searchQuery={searchQuery}
            showDropdown={showDropdown}
            suggestions={suggestions}
            searchingDropdown={searchingDropdown}
            currentLocationStr={currentLocationStr}
            onSearchQueryChange={setSearchQuery}
            onShowDropdownChange={setShowDropdown}
            onSelectLocation={handleSelectLocation}
            onSubmit={handleSearchSubmit}
          />
        )}

        <div className="mt-6 border-t border-[#e7e1d5] pt-4">
          <AttractionsResults
            exploring={exploring}
            currentLocationStr={currentLocationStr}
            activeFilter={activeFilter}
            filteredPlaces={filteredPlaces}
            onPlaceClick={handlePlaceClick}
          />
        </div>
      </div>

      <DetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} details={details} loading={loadingDetails} />
    </div>
  );
}
