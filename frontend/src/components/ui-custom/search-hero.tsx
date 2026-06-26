'use client';

import { Sparkles, MapPin, Calendar, Wallet } from 'lucide-react';
import GradientButton from './gradient-button';
import GlassCard from './glass-card';

export default function SearchHero() {
  return (
    <GlassCard className="p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-blue-600" />
        <span className="font-medium text-blue-600">Travel Planner</span>
      </div>

      <h2 className="text-4xl font-bold text-slate-900">Where would you like to go?</h2>

      <p className="mt-3 text-slate-500">
        Plan your perfect itinerary, visa guidance, forex estimates and bookings.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <MapPin className="mb-2 h-4 w-4 text-slate-500" />
          <input placeholder="Destination" className="w-full outline-none" />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <Calendar className="mb-2 h-4 w-4 text-slate-500" />
          <input placeholder="Travel Dates" className="w-full outline-none" />
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <Wallet className="mb-2 h-4 w-4 text-slate-500" />
          <input placeholder="Budget" className="w-full outline-none" />
        </div>

        <GradientButton className="h-full min-h-[72px]">Plan Trip</GradientButton>
      </div>
    </GlassCard>
  );
}
