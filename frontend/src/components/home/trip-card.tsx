'use client';

import { HomepageDestination } from '@/services/homepage.service';

interface TripCardProps {
  destination: HomepageDestination;
  onClick: () => void;
}

function getMoodLabel(destination: HomepageDestination): string {
  const score = destination.popularity_score;
  if (destination.mood_tags.includes('budget')) return '💰 Budget Pick';
  if (score > 800) return '🔥 Trending';
  if (destination.continent === 'Asia') return '📍 Popular in Asia';
  return '⭐ Top Rated';
}

export default function TripCard({ destination, onClick }: TripCardProps) {
  const label = getMoodLabel(destination);

  return (
    <button
      onClick={onClick}
      className="group relative flex-shrink-0 w-56 h-72 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {/* Background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={destination.image_url}
        alt={destination.name}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Mood label badge */}
      <div className="absolute top-3 left-3">
        <span className="rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-sm">
          {label}
        </span>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
        <h3 className="text-lg font-bold text-white leading-tight">{destination.name}</h3>
        <p className="text-xs text-white/70 mt-0.5">{destination.country}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-bold text-white">
            ₹{destination.price_inr.toLocaleString('en-IN')}
          </span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs text-white/90">
            {destination.duration_days}d
          </span>
        </div>
      </div>
    </button>
  );
}
