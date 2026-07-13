import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, BedDouble } from 'lucide-react';
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';
import type { ItineraryImpact } from './itineraryImpact';
import type { TripFitResult } from './tripFit';

interface HotelCardProps {
  hotel: Suggestion;
  fit: TripFitResult;
  impact: ItineraryImpact | null;
  isPending: boolean;
  onSelect: () => void;
  onAdd: () => void;
}

export default function HotelCard({ hotel, fit, impact, isPending, onSelect, onAdd }: HotelCardProps) {
  const tagline = fit.reasons[0]?.text || hotel.subtitle || 'Perfect alignment with itinerary stops.';

  const comparisonCheck = useMemo(() => {
    if (impact) {
      return `✓ ${impact.nearestStop.durationMins}m ${impact.nearestStop.mode === 'walk' ? 'walk' : 'cab'} to ${impact.nearestStop.title}`;
    }
    if (hotel.distance_km != null) {
      return `✓ ${hotel.distance_km} km from search`;
    }
    return `✓ Good route fit`;
  }, [impact, hotel.distance_km]);

  return (
    <div
      onClick={onSelect}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line-strong/40 bg-paper-2 shadow-surface hover:border-cat-stay/30 hover:shadow-hover hover:scale-[1.005] cursor-pointer transition-all duration-300"
      style={{ minHeight: '190px' }}
    >
      {/* Cinematic Wide Image */}
      <div className="relative h-36 w-full overflow-hidden bg-paper-1 shrink-0">
        {hotel.image_url ? (
          <motion.img
            layoutId={`place-photo-${hotel.id}`}
            src={hotel.image_url}
            alt={hotel.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-cat-stay/10">
            <BedDouble size={24} className="text-cat-stay/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>

      {/* Card Info Content */}
      <div className="flex flex-1 flex-col p-3.5 select-none justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-bold tracking-tight text-ink-900 leading-snug">
            {hotel.name}
          </h3>
          <p className="mt-0.5 text-[11.5px] font-medium text-ink-500 line-clamp-1">
            {tagline}
          </p>
        </div>

        {/* Visual Check and Button Row */}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="inline-flex items-center text-[10px] font-bold text-cat-stay bg-cat-stay/10 px-2 py-0.5 rounded-md border border-cat-stay/15">
            {comparisonCheck}
          </span>
          
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className={`flex h-7 w-7 items-center justify-center rounded-full shadow-xs transition-all duration-200 cursor-pointer ${
              isPending 
                ? 'bg-cat-stay text-white shadow-sm shadow-cat-stay/25' 
                : 'bg-paper-1 hover:bg-line/40 text-ink-700 border border-line hover:scale-105'
            }`}
            title={isPending ? 'Added' : 'Select hotel'}
          >
            {isPending ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={3} />}
          </button>
        </div>
      </div>
    </div>
  );
}
