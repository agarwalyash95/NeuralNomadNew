'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, MapPin, Sparkles, Clock, Globe, 
  ArrowRight, Loader2, Landmark
} from 'lucide-react';
import { useRecommendedTrips, useCopyRecommendedTrip } from '@/features/planner/hooks/usePlannerQueries';

export default function RecommendedTripsSection() {
  const router = useRouter();
  const { data: trips = [], isLoading, isError } = useRecommendedTrips();
  const copyMutation = useCopyRecommendedTrip();

  // Filter states
  const [search, setSearch] = useState('');
  const [activeStyle, setActiveStyle] = useState('all');
  const [activeRegion, setActiveRegion] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  // Available styles and regions for chips
  const stylesList = [
    { label: '✨ All Styles', value: 'all' },
    { label: '💍 Honeymoon', value: 'Honeymoon' },
    { label: '🎒 Backpacking', value: 'Backpacking' },
    { label: '👨‍👩‍👧 Family', value: 'Family' },
    { label: '⚡ Weekend', value: 'Weekend' }
  ];

  const regionsList = [
    { label: '🌎 All Regions', value: 'all' },
    { label: '📍 India', value: 'India' },
    { label: '🏝 Asia', value: 'Asia' },
    { label: '🏰 Europe', value: 'Europe' },
    { label: '🏙 Americas', value: 'Americas' },
    { label: '🦁 Africa', value: 'Africa' },
    { label: '🐨 Oceania', value: 'Oceania' }
  ];

  // Filtering logic
  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const matchesSearch = 
        trip.destination.toLowerCase().includes(search.toLowerCase()) ||
        trip.title.toLowerCase().includes(search.toLowerCase()) ||
        trip.short_description.toLowerCase().includes(search.toLowerCase());

      const matchesStyle = activeStyle === 'all' || trip.trip_style === activeStyle;

      let matchesRegion = true;
      if (activeRegion !== 'all') {
        if (activeRegion === 'India') {
          matchesRegion = trip.destination.toLowerCase() === 'goa' || 
                          trip.destination.toLowerCase() === 'jaipur' || 
                          trip.destination.toLowerCase() === 'munnar' || 
                          trip.destination.toLowerCase() === 'manali' || 
                          trip.destination.toLowerCase() === 'leh-ladakh';
        } else if (activeRegion === 'Asia') {
          // Exclude India destinations to keep filter distinct
          const isIndia = trip.destination.toLowerCase() === 'goa' || 
                          trip.destination.toLowerCase() === 'jaipur' || 
                          trip.destination.toLowerCase() === 'munnar' || 
                          trip.destination.toLowerCase() === 'manali' || 
                          trip.destination.toLowerCase() === 'leh-ladakh';
          matchesRegion = !isIndia && (
            trip.destination.toLowerCase() === 'bali' ||
            trip.destination.toLowerCase() === 'bangkok' ||
            trip.destination.toLowerCase() === 'singapore' ||
            trip.destination.toLowerCase() === 'tokyo' ||
            trip.destination.toLowerCase() === 'seoul'
          );
        } else if (activeRegion === 'Europe') {
          matchesRegion = trip.destination.toLowerCase() === 'paris' ||
                          trip.destination.toLowerCase() === 'rome' ||
                          trip.destination.toLowerCase() === 'swiss alps' ||
                          trip.destination.toLowerCase() === 'london';
        } else if (activeRegion === 'Americas') {
          matchesRegion = trip.destination.toLowerCase() === 'new york city' ||
                          trip.destination.toLowerCase() === 'california coast' ||
                          trip.destination.toLowerCase() === 'banff' ||
                          trip.destination.toLowerCase() === 'cusco' ||
                          trip.destination.toLowerCase() === 'rio de janeiro';
        } else if (activeRegion === 'Africa') {
          matchesRegion = trip.destination.toLowerCase() === 'masai mara' ||
                          trip.destination.toLowerCase() === 'cape town';
        } else if (activeRegion === 'Oceania') {
          matchesRegion = trip.destination.toLowerCase() === 'sydney' ||
                          trip.destination.toLowerCase() === 'queenstown';
        }
      }

      return matchesSearch && matchesStyle && matchesRegion;
    });
  }, [trips, search, activeStyle, activeRegion]);

  // Limit displayed trips initially
  const displayedTrips = showAll ? filteredTrips : filteredTrips.slice(0, 6);

  const handleCopy = (id: string) => {
    if (copyingId) return; // Prevent double click
    setCopyingId(id);
    copyMutation.mutate(id, {
      onSuccess: (data) => {
        router.push(`/planner/${data.workspace_id}`);
      },
      onError: (err) => {
        console.error('Failed to copy trip template:', err);
        setCopyingId(null);
      }
    });
  };

  if (isError) return null; // Gracefully hide section on error

  return (
    <section className="py-12 border-t border-line-strong/60 bg-paper-1/40 rounded-3xl p-8 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/80 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-2">
            <Sparkles size={11} className="animate-pulse" /> Premium Recommended Trips
          </div>
          <h2 className="text-2xl font-extrabold text-ink-900 tracking-tight">
            Curated Draft Workspaces
          </h2>
          <p className="text-sm text-ink-700 mt-1 max-w-xl">
            Select any research-backed recommended trip template. Instantly open it in your planner with routes, hotels, and timings fully populated and editable.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" size={16} />
          <input
            type="text"
            placeholder="Search recommended destinations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-line-strong rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all text-ink-900"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="space-y-4 mb-8">
        {/* Regions */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-bold text-ink-500 uppercase tracking-wide mr-2 flex-shrink-0">
            Region:
          </span>
          {regionsList.map((r) => (
            <button
              key={r.value}
              onClick={() => {
                setActiveRegion(r.value);
                setShowAll(false);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all flex-shrink-0 ${
                activeRegion === r.value
                  ? 'bg-ink-900 text-white shadow-sm'
                  : 'bg-white text-ink-700 border border-line-strong hover:bg-paper-0'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Styles */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <span className="text-xs font-bold text-ink-500 uppercase tracking-wide mr-2 flex-shrink-0">
            Travel Style:
          </span>
          {stylesList.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setActiveStyle(s.value);
                setShowAll(false);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all flex-shrink-0 ${
                activeStyle === s.value
                  ? 'bg-ink-900 text-white shadow-sm'
                  : 'bg-white text-ink-700 border border-line-strong hover:bg-paper-0'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 w-full animate-pulse rounded-3xl bg-paper-0 border border-line" />
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="py-16 text-center bg-white border border-line rounded-3xl shadow-sm">
          <Globe className="mx-auto text-ink-400 mb-3" size={32} />
          <p className="text-sm font-bold text-ink-900">No recommended trips match your search filters.</p>
          <p className="text-xs text-ink-500 mt-1">Try resetting the travel style or region filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            <AnimatePresence>
              {displayedTrips.map((trip) => {
                const isThisCopying = copyingId === trip.id;
                
                return (
                  <motion.div
                    key={trip.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                    className="group relative flex flex-col bg-white border border-line-strong/60 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    {/* Top image header */}
                    <div className="relative h-44 w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={trip.destination_image}
                        alt={trip.destination}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      
                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      
                      {/* Location badge */}
                      <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-white text-[10px] font-bold">
                        <MapPin size={10} /> {trip.destination}
                      </div>

                      {/* AI Recommendation Score */}
                      <div className="absolute top-3 right-3 bg-amber-500/90 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-sm">
                        🔥 Match {trip.ai_recommendation_score}%
                      </div>

                      {/* Content on Image */}
                      <div className="absolute bottom-3 left-4 right-4">
                        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                          {trip.trip_style} • {trip.budget_category}
                        </span>
                        <h3 className="text-base font-bold text-white leading-tight mt-0.5 line-clamp-1">
                          {trip.title}
                        </h3>
                      </div>
                    </div>

                    {/* Description body */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-xs text-ink-700 leading-relaxed line-clamp-2">
                          {trip.short_description}
                        </p>

                        {/* Quick highlights */}
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {trip.highlights.slice(0, 3).map((h, i) => (
                            <span 
                              key={i} 
                              className="text-[10px] bg-paper-0 text-ink-700 border border-line-strong px-2 py-0.5 rounded-md line-clamp-1"
                            >
                              ✓ {h}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Cost and CTA Footer */}
                      <div className="mt-5 border-t border-line/60 pt-4 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] text-ink-500 font-bold uppercase tracking-wider">Estimated Cost</p>
                          <p className="text-base font-extrabold text-ink-900 mt-0.5">
                            ₹{parseFloat(trip.estimated_total_cost).toLocaleString('en-IN')}
                          </p>
                        </div>

                        {/* Quick Stats: Duration / Cities */}
                        <div className="flex gap-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-ink-500 font-bold uppercase tracking-wider">Duration</span>
                            <span className="text-xs font-bold text-ink-700 mt-0.5 flex items-center gap-0.5">
                              <Clock size={11} /> {trip.duration_days} Days
                            </span>
                          </div>
                          <div className="flex flex-col items-end border-l border-line/60 pl-3">
                            <span className="text-[9px] text-ink-500 font-bold uppercase tracking-wider">Hubs</span>
                            <span className="text-xs font-bold text-ink-700 mt-0.5 flex items-center gap-0.5">
                              <Landmark size={11} /> {trip.number_of_cities} City
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => handleCopy(trip.id)}
                        disabled={copyingId !== null}
                        className="w-full mt-4 rounded-xl bg-ink-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:bg-paper-0 disabled:text-ink-500 border border-transparent disabled:border-line-strong transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isThisCopying ? (
                          <>
                            <Loader2 size={13} className="animate-spin text-ink-500" />
                            Initializing Workspace...
                          </>
                        ) : (
                          <>
                            Import to Planner <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {/* Show More toggle */}
          {filteredTrips.length > 6 && (
            <div className="text-center pt-2">
              <button
                onClick={() => setShowAll(!showAll)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white border border-line-strong px-6 py-2.5 text-xs font-bold text-ink-700 hover:bg-paper-0 transition-colors shadow-sm"
              >
                {showAll ? 'Show Fewer Trips' : `Explore all ${filteredTrips.length} Recommended Plans →`}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
