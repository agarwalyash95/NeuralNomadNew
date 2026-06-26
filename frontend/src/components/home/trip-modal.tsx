'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { HomepageDestination } from '@/services/homepage.service';

interface TripModalProps {
  destination: HomepageDestination;
  onClose: () => void;
}

const ITINERARY_PREVIEWS: Record<string, string[]> = {
  Bali: ['Day 1: Arrive & explore Seminyak beach', 'Day 2: Ubud rice terraces & monkey forest', 'Day 3: Tanah Lot temple & sunset'],
  Tokyo: ['Day 1: Shinjuku & Shibuya crossing', 'Day 2: Asakusa temple & Ueno park', 'Day 3: Akihabara & teamLab digital art'],
  Dubai: ['Day 1: Burj Khalifa & Dubai Mall', 'Day 2: Dubai Marina & desert safari', 'Day 3: Gold souk & Jumeirah beach'],
  Singapore: ['Day 1: Gardens by the Bay & Marina Bay Sands', 'Day 2: Sentosa island & Universal Studios', 'Day 3: Hawker centres food tour'],
  Paris: ['Day 1: Eiffel Tower & Seine river cruise', 'Day 2: Louvre & Champs-Élysées', 'Day 3: Montmartre & local cafes'],
  Goa: ['Day 1: Calangute & Baga beaches', 'Day 2: Old Goa churches & spice plantation', 'Day 3: Anjuna flea market & water sports'],
  Maldives: ['Day 1: Arrive & snorkelling at reef', 'Day 2: Sandbank picnic & dolphin cruise', 'Day 3: Underwater restaurant & spa'],
  Manali: ['Day 1: Solang Valley snow activities', 'Day 2: Rohtang Pass & Beas River', 'Day 3: Hadimba temple & local markets'],
};

const BEST_SEASON: Record<string, string> = {
  Bali: 'May – Sep', Tokyo: 'Mar – May, Oct – Nov', Dubai: 'Nov – Mar', Singapore: 'Feb – Apr',
  Paris: 'Apr – Oct', Goa: 'Nov – Feb', Maldives: 'Nov – Apr', Manali: 'May – Oct',
};

export default function TripModal({ destination, onClose }: TripModalProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const router = useRouter();

  const itinerary = ITINERARY_PREVIEWS[destination.name] ?? [
    `Day 1: Arrive & explore ${destination.name}`,
    `Day 2: Local attractions & cultural sites`,
    `Day 3: Free day & departure`,
  ];

  const bestSeason = BEST_SEASON[destination.name] ?? 'Year-round';

  const handleBook = () => {
    router.push(`/bookings?destination=${encodeURIComponent(destination.name)}`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-xl" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white/90 backdrop-blur-2xl shadow-2xl border border-white/50 animate-fade-in">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 rounded-full bg-black/10 p-2 hover:bg-black/20 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Hero image */}
        <div className="relative h-52 overflow-hidden rounded-t-3xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={destination.image_url}
            alt={destination.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-5">
            <h2 className="text-2xl font-bold text-white">{destination.name}</h2>
            <p className="text-sm text-white/80">{destination.country}</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Starting from', value: `₹${destination.price_inr.toLocaleString('en-IN')}` },
              { label: 'Duration', value: `${destination.duration_days} days` },
              { label: 'Best Season', value: bestSeason },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-slate-50 p-3 text-center">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Itinerary preview */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">📅 Itinerary Preview</h3>
            <div className="space-y-2">
              {itinerary.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-sm text-slate-600">{item}</p>
                </div>
              ))}
              <p className="text-xs text-slate-400 ml-8">+ {destination.duration_days - itinerary.length} more days</p>
            </div>
          </div>

          {/* Mood tags */}
          <div className="flex flex-wrap gap-2">
            {destination.mood_tags.map((tag) => (
              <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 capitalize">
                {tag}
              </span>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Rating */}
          <div>
            <p className="text-sm font-semibold text-slate-900 mb-2">Rate this plan</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="text-2xl transition-transform hover:scale-110"
                >
                  {star <= (hovered || rating) ? '★' : '☆'}
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-xs text-slate-500 mt-1">Thanks for rating!</p>
            )}
          </div>

          {/* CTA */}
          <button
            onClick={handleBook}
            className="w-full rounded-2xl bg-slate-900 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-lg flex items-center justify-center gap-2"
          >
            ✈ Book this trip
          </button>
        </div>
      </div>
    </div>
  );
}
