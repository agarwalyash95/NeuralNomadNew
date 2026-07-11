'use client';

import { PlaceCard } from '@/components/explore/place-card';
import { useExplore } from '@/hooks/use-explore';
import { useExploreDetails } from '@/hooks/use-explore-details';
import { Search, MapPin, Loader2, Sparkles, Navigation } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { attractionService } from '@/services/attraction.service';
import { useDebounce } from '@/hooks/use-debounce';
import { DetailsModal } from '@/components/explore/details-modal';
import Image from 'next/image';

export default function AttractionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchingDropdown, setSearchingDropdown] = useState(false);
  const [currentLocationStr, setCurrentLocationStr] = useState<string>('');
  
  const [activeFilter, setActiveFilter] = useState<'all' | 'sights' | 'food' | 'activities'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { exploreLocation, places, loading: exploring, resolvedLocation } = useExplore();
  const { fetchDetails, details, loading: loadingDetails } = useExploreDetails();

  // Sync resolved geocoded location name to input query and exploration title
  useEffect(() => {
    if (resolvedLocation) {
      setCurrentLocationStr(resolvedLocation);
      setSearchQuery(resolvedLocation);
    }
  }, [resolvedLocation]);

  // Geolocation on initial load
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentLocationStr('Your Location');
          exploreLocation(undefined, lat, lng);
        },
        (error) => {
          console.error("Error getting location: ", error);
          // Fallback if needed, maybe don't do anything
        }
      );
    }
  }, [exploreLocation]);

  // Autocomplete logic
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

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLocation = (prediction: any) => {
    const locationName = prediction.description;
    setSearchQuery(locationName);
    setShowDropdown(false);
    setCurrentLocationStr(locationName);
    exploreLocation(locationName);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery) {
      setShowDropdown(false);
      setCurrentLocationStr(searchQuery);
      exploreLocation(searchQuery);
    }
  };

  const handlePlaceClick = (place: any) => {
    setIsModalOpen(true);
    fetchDetails(place.id, place.category);
  };

  // Group places by category
  const sights = places.filter(p => p.category === 'attraction');
  const restaurants = places.filter(p => p.category === 'restaurant');
  const activities = places.filter(p => p.category === 'activity');
  
  let filteredPlaces = places;
  if (activeFilter === 'sights') filteredPlaces = sights;
  if (activeFilter === 'food') filteredPlaces = restaurants;
  if (activeFilter === 'activities') filteredPlaces = activities;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-955">
      {/* 1. Massive Hero Section */}
      <section className="relative h-[60vh] min-h-[500px] w-full flex flex-col items-center justify-center pt-20 px-4">
        {/* Beautiful Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://images.unsplash.com/photo-1501504905252-473c47e087f8?q=80&w=2574&auto=format&fit=crop"
            alt="Travel Background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
        </div>

        <div className={`relative w-full max-w-3xl text-center ${showDropdown && searchQuery.length > 1 ? 'z-40' : 'z-10'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-medium mb-6">
            <Sparkles size={16} className="text-amber-300" />
            Discover extraordinary places
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 drop-shadow-lg tracking-tight">
            Where to next?
          </h1>
          <p className="text-lg md:text-xl text-white/95 mb-10 drop-shadow-md">
            Search any city, neighborhood, or landmark to instantly unlock its hidden gems.
          </p>

          {/* Search Bar */}
          <div className="relative" ref={dropdownRef}>
            <form onSubmit={handleSearchSubmit}>
              <div className="flex items-center bg-white/10 backdrop-blur-xl rounded-full p-2 border border-white/30 shadow-2xl transition-all hover:bg-white/20 focus-within:bg-white/20">
                <div className="flex-1 flex items-center pl-4">
                  <MapPin className="text-white/70 mr-3" size={24} />
                  <input
                    type="text"
                    placeholder="E.g., Tokyo, Japan or Times Square"
                    className="w-full bg-transparent border-none text-white placeholder:text-white/70 focus:outline-none focus:ring-0 text-xl py-3"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowDropdown(true);
                    }}
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg"
                >
                  <Search size={20} />
                  Explore
                </button>
              </div>
            </form>

            {/* Autocomplete Dropdown */}
            {showDropdown && (searchQuery.length > 1) && (
              <div className="absolute top-full left-0 right-0 mt-4 rounded-3xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl z-50 shadow-2xl border border-white/20 text-left">
                {searchingDropdown ? (
                  <div className="p-8 flex justify-center text-muted-foreground">
                    <Loader2 size={32} className="animate-spin text-primary" />
                  </div>
                ) : suggestions.length > 0 ? (
                  <ul className="max-h-[400px] overflow-y-auto p-2">
                    {suggestions.map((pred) => (
                      <li
                        key={pred.place_id}
                        onClick={() => handleSelectLocation(pred)}
                        className="p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-4 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Navigation size={18} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{pred.structured_formatting?.main_text || pred.description}</p>
                          <p className="text-sm text-slate-500">{pred.structured_formatting?.secondary_text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-8 text-center text-muted-foreground font-medium">
                    No places found. Press enter to search anyway.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Lower Side Navigation Bar */}
      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center sm:justify-start gap-2 sm:gap-4 overflow-x-auto hide-scrollbar py-4">
            <button onClick={() => setActiveFilter('all')} className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeFilter === 'all' ? 'bg-slate-900 text-white shadow-md scale-105' : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              All Places
            </button>
            <button onClick={() => setActiveFilter('sights')} className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeFilter === 'sights' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-105' : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              🏛️ Sights & Landmarks
            </button>
            <button onClick={() => setActiveFilter('food')} className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeFilter === 'food' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 scale-105' : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              🍽️ Food & Dining
            </button>
            <button onClick={() => setActiveFilter('activities')} className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeFilter === 'activities' ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 scale-105' : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
              🎭 Activities & Fun
            </button>
          </div>
        </div>
      </div>

      {/* 3. The Immersive Grid */}
      <section className="container mx-auto px-4 py-12 min-h-[50vh]">
        {exploring ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 size={64} className="animate-spin text-primary mb-6" />
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
              Scouting {currentLocationStr}...
            </p>
            <p className="text-slate-500 mt-2">Finding the most breathtaking spots</p>
          </div>
        ) : currentLocationStr ? (
          filteredPlaces.length > 0 ? (
            <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000">
              <h2 className="text-3xl font-black mb-8 text-slate-900 dark:text-white">
                Exploring {activeFilter !== 'all' ? activeFilter : 'everything'} in <span className="text-primary">{currentLocationStr}</span>
              </h2>
              
              {/* Masonry-like Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredPlaces.map((place) => (
                  <div 
                    key={`${place.category}-${place.id}`} 
                    onClick={() => handlePlaceClick(place)}
                    className="cursor-pointer"
                  >
                    <PlaceCard place={place} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-32 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm mt-8">
              <MapPin size={64} className="mx-auto text-slate-300 mb-6" />
              <h3 className="text-2xl font-bold mb-3">No places found</h3>
              <p className="text-slate-500 text-lg">Try searching for a broader region or changing your filter.</p>
            </div>
          )
        ) : null}
      </section>

      {/* 4. The Details Popup/Modal */}
      <DetailsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        details={details} 
        loading={loadingDetails} 
      />
    </div>
  );
}
