'use client';

import React from 'react';
import { Map } from 'lucide-react';
import { PlaceCard } from '@/components/explore/place-card';

interface AttractionsResultsProps {
  exploring: boolean;
  currentLocationStr: string;
  activeFilter: 'all' | 'sights' | 'food' | 'activities';
  filteredPlaces: any[];
  onPlaceClick: (placeId: string | number) => void;
}

export default function AttractionsResults({
  exploring,
  currentLocationStr,
  activeFilter,
  filteredPlaces,
  onPlaceClick,
}: AttractionsResultsProps) {
  if (exploring) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Finding the best spots...</p>
      </div>
    );
  }

  if (!currentLocationStr) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-800">
        Top {activeFilter !== 'all' ? activeFilter : 'places'} in {currentLocationStr.split(',')[0]}
      </h3>
      {filteredPlaces.length > 0 ? (
        <div className="flex flex-col gap-4">
          {filteredPlaces.map((place) => (
            <div key={place.id} onClick={() => onPlaceClick(place.id)} className="cursor-pointer">
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
  );
}
