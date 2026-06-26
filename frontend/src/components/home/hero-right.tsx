'use client';

import { Sparkles, MapPin, PlaneTakeoff } from 'lucide-react';
import { HomepageDestination } from '@/services/homepage.service';

interface HeroRightProps {
  destinations?: HomepageDestination[];
}

export default function HeroRight({ destinations = [] }: HeroRightProps) {
  // Use a mix of top destinations, or fallbacks if none are loaded yet
  const cards = destinations.slice(0, 3);
  
  const fallbackCards = [
    { name: 'Santorini', country: 'Greece', image_url: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?q=80&w=800' },
    { name: 'Kyoto', country: 'Japan', image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800' },
    { name: 'Swiss Alps', country: 'Switzerland', image_url: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?q=80&w=800' },
  ];

  const displayCards = cards.length === 3 ? cards : fallbackCards;
  const [c0, c1, c2] = displayCards;

  return (
    <div className="relative w-full max-w-lg h-[500px] flex items-center justify-center pointer-events-none hidden lg:flex">
      
      {/* Decorative Blob Glows behind the cards */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl" />
      <div className="absolute top-1/4 right-1/4 w-48 h-48 bg-purple-400/20 rounded-full blur-3xl" />

      {/* Card 1 - Left Tilted */}
      <div className="absolute left-0 top-16 w-48 rounded-2xl bg-white p-2 shadow-xl shadow-slate-200/50 -rotate-12 hover:rotate-0 hover:scale-105 transition-all duration-500 ease-out z-10 animate-blob pointer-events-auto" style={{ animationDelay: '0ms', animationDuration: '8s' }}>
        <div className="relative h-56 w-full overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c0?.image_url} alt={c0?.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3 text-white">
            <p className="font-bold text-sm">{c0?.name}</p>
            <p className="text-[10px] text-white/80 flex items-center gap-1">
              <MapPin size={10} /> {c0?.country}
            </p>
          </div>
        </div>
      </div>

      {/* Card 2 - Main Center */}
      <div className="absolute right-8 top-0 w-56 rounded-2xl bg-white p-2.5 shadow-2xl shadow-blue-900/10 rotate-6 hover:rotate-0 hover:scale-105 transition-all duration-500 ease-out z-20 animate-blob pointer-events-auto" style={{ animationDelay: '2000ms', animationDuration: '9s' }}>
        <div className="relative h-72 w-full overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c1?.image_url} alt={c1?.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md rounded-full px-2 py-1 text-[10px] font-bold text-white border border-white/20">
            🔥 Trending
          </div>
          <div className="absolute bottom-4 left-4 text-white">
            <p className="font-bold text-lg leading-tight">{c1?.name}</p>
            <p className="text-xs text-white/80 flex items-center gap-1 mt-1">
              <MapPin size={12} /> {c1?.country}
            </p>
          </div>
        </div>
      </div>

      {/* Card 3 - Bottom Right */}
      <div className="absolute -bottom-4 right-16 w-44 rounded-2xl bg-white p-2 shadow-xl shadow-slate-200/50 -rotate-6 hover:rotate-0 hover:scale-105 transition-all duration-500 ease-out z-10 animate-blob pointer-events-auto" style={{ animationDelay: '4000ms', animationDuration: '10s' }}>
        <div className="relative h-48 w-full overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c2?.image_url} alt={c2?.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-3 left-3 text-white">
            <p className="font-bold text-sm">{c2?.name}</p>
            <p className="text-[10px] text-white/80 flex items-center gap-1">
              <MapPin size={10} /> {c2?.country}
            </p>
          </div>
        </div>
      </div>

      {/* Floating AI Glassmorphism Badge */}
      <div className="absolute top-1/2 -left-12 -translate-y-1/2 z-30 animate-blob pointer-events-auto" style={{ animationDelay: '1500ms', animationDuration: '6s' }}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/40 bg-white/70 p-3 pr-5 shadow-xl shadow-blue-900/5 backdrop-blur-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-inner">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">AI is planning</p>
            <p className="text-sm font-semibold text-slate-800">7 Days in {c1?.name}</p>
          </div>
        </div>
      </div>

      {/* Floating Ticket Badge */}
      <div className="absolute bottom-16 -right-6 z-30 animate-blob pointer-events-auto" style={{ animationDelay: '3500ms', animationDuration: '7s' }}>
        <div className="flex items-center gap-3 rounded-xl border border-white/40 bg-white/70 p-2.5 shadow-xl shadow-slate-900/5 backdrop-blur-md">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <PlaneTakeoff size={14} />
          </div>
          <div className="pr-2">
            <p className="text-xs font-bold text-slate-800">Flight Found</p>
            <p className="text-[10px] font-medium text-slate-500">From ₹22,500</p>
          </div>
        </div>
      </div>

    </div>
  );
}
