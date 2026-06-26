'use client';

import { useState } from 'react';
import { HomepageDestination, MoodCategory } from '@/services/homepage.service';
import TripCard from './trip-card';
import TripModal from './trip-modal';

interface MoodDestinationSectionProps {
  moods: MoodCategory[];
  destinations: HomepageDestination[];
  activeMood: string;
  loading: boolean;
  onMoodChange: (slug: string) => void;
  onView: (id: string) => void;
}

export default function MoodDestinationSection({
  moods,
  destinations,
  activeMood,
  loading,
  onMoodChange,
  onView,
}: MoodDestinationSectionProps) {
  const [selectedDestination, setSelectedDestination] = useState<HomepageDestination | null>(null);

  const handleCardClick = (dest: HomepageDestination) => {
    onView(dest.id);
    setSelectedDestination(dest);
  };

  return (
    <section className="py-10">
      {/* Section header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Recommended for You
          </h2>
          <p className="text-slate-500 text-sm mt-1">Sorted by popularity & your location</p>
        </div>
      </div>

      {/* Mood pill nav — sticky top of section */}
      <div className="sticky top-16 z-30 -mx-1 mb-6 bg-white/80 backdrop-blur-md pb-3 pt-1">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-1">
          {moods.map((mood) => {
            const isActive = activeMood === mood.slug;
            const count = mood.slug === 'all'
              ? destinations.length
              : destinations.filter((d) => d.mood_tags.includes(mood.slug)).length;

            return (
              <button
                key={mood.slug}
                onClick={() => onMoodChange(mood.slug)}
                className={`
                  flex-shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium
                  transition-all duration-200 border
                  ${isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                  }
                `}
              >
                <span>{mood.emoji}</span>
                <span>{mood.name}</span>
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Horizontal scroll card row */}
      {loading ? (
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-56 h-72 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : destinations.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No destinations found for this mood.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4 -mx-1 px-1">
          {destinations.map((dest) => (
            <TripCard key={dest.id} destination={dest} onClick={() => handleCardClick(dest)} />
          ))}

          {/* "See All" end card */}
          <div className="flex-shrink-0 w-40 h-72 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
            <span className="text-3xl">→</span>
            <span className="text-sm font-medium text-center px-4">See all trips</span>
          </div>
        </div>
      )}

      {/* Trip Modal */}
      {selectedDestination && (
        <TripModal
          destination={selectedDestination}
          onClose={() => setSelectedDestination(null)}
        />
      )}
    </section>
  );
}
