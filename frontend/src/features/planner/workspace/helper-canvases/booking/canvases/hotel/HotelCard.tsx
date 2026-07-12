'use client';

import React from 'react';
import { Star, MapPinned, Footprints, Car, ChevronDown, BedDouble, GitCompareArrows, Check } from 'lucide-react';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';
import type { ItineraryImpact } from './itineraryImpact';
import type { TripFitResult } from './tripFit';
import HotelTripFitBadge from './HotelTripFitBadge';
import { buildHotelFacts } from './hotelFacts';
import HotelDetailSections from './HotelDetailSections';

interface HotelCardProps {
  hotel: Suggestion;
  fit: TripFitResult;
  impact: ItineraryImpact | null;
  hasItineraryData: boolean;
  minutesSaved: number | null;
  isExpanded: boolean;
  isPending: boolean;
  isPinned: boolean;
  canPin: boolean;
  detailsLoading?: boolean;
  expandedDetails: Suggestion | null;
  onToggleExpand: () => void;
  onSelect: () => void;
  onTogglePin: () => void;
}

/**
 * Itinerary-first hotel card. The collapsed row leads with what a stay here
 * does to the trip (Trip Fit + the nearest planned stop), not a generic
 * distance-to-search-box figure. Select is reachable without expanding —
 * expansion is for research, not the primary action.
 */
export default function HotelCard({
  hotel,
  fit,
  impact,
  hasItineraryData,
  minutesSaved,
  isExpanded,
  isPending,
  isPinned,
  canPin,
  detailsLoading,
  expandedDetails,
  onToggleExpand,
  onSelect,
  onTogglePin,
}: HotelCardProps) {
  const facts = buildHotelFacts(hotel);
  const headline = impact
    ? `${impact.nearestStop.durationMins} min ${impact.nearestStop.mode === 'walk' ? 'walk' : 'cab ride'} to ${impact.nearestStop.title}`
    : hotel.distance_km != null
      ? `${hotel.distance_km} km from search area`
      : null;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-paper-2 transition-all ${
        isExpanded ? 'border-cat-stay ring-2 ring-cat-stay/15 shadow-hover' : 'border-line hover:border-cat-stay/40 shadow-surface hover:shadow-hover'
      }`}
    >
      <div
        className={`flex cursor-pointer items-stretch gap-3 p-3 ${FOCUS_RING_CLASS}`}
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        {...clickableDivProps(onToggleExpand)}
      >
        <div className="relative w-24 shrink-0 overflow-hidden rounded-xl bg-paper-1 sm:w-28">
          {hotel.image_url ? (
            <img src={hotel.image_url} alt={hotel.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-cat-stay/10">
              <BedDouble size={22} className="text-cat-stay" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-title leading-tight text-ink-900">{hotel.name}</h3>
            <HotelTripFitBadge fit={fit} hasItineraryData={hasItineraryData} />
          </div>

          {headline && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-ink-700">
              {impact ? (
                impact.nearestStop.mode === 'walk' ? (
                  <Footprints size={12} className="text-cat-stay" />
                ) : (
                  <Car size={12} className="text-cat-stay" />
                )
              ) : (
                <MapPinned size={12} className="text-ink-400" />
              )}
              {headline}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-caption">
            {hotel.rating != null && (
              <span className="flex items-center gap-0.5 font-semibold text-ink-700">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                {hotel.rating} <span className="font-normal text-ink-400">({hotel.ratings_count})</span>
              </span>
            )}
            {hotel.details?.price_range && (
              <span className="rounded bg-cat-stay/10 px-1.5 py-0.5 text-[10px] font-bold text-cat-stay">{hotel.details.price_range}</span>
            )}
            {minutesSaved != null && minutesSaved > 1 && (
              <span className="font-semibold text-emerald-700">Saves {Math.round(minutesSaved)} min/stop vs. current</span>
            )}
          </div>

          {facts.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {facts.slice(0, 3).map((f, i) => (
                <span key={i} className="rounded-full bg-paper-1 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                  {f.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Always-visible action row — Select needs no expansion. */}
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          className={`min-h-[36px] flex-1 rounded-lg text-xs font-bold transition-colors ${
            isPending ? 'bg-cat-stay/15 text-cat-stay' : 'bg-cat-stay text-white hover:brightness-110'
          }`}
        >
          {isPending ? (
            <span className="inline-flex items-center justify-center gap-1">
              <Check size={13} /> Selected
            </span>
          ) : (
            'Select Hotel'
          )}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          disabled={!isPinned && !canPin}
          aria-pressed={isPinned}
          title={!isPinned && !canPin ? 'Compare up to 3 hotels at a time' : undefined}
          className={`flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            isPinned ? 'border-cat-stay bg-cat-stay/10 text-cat-stay' : 'border-line text-ink-500 hover:border-cat-stay/40 hover:text-cat-stay'
          }`}
        >
          <GitCompareArrows size={13} /> {isPinned ? 'Pinned' : 'Compare'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-label={isExpanded ? 'Hide details' : 'Show details'}
          className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-paper-1 hover:text-ink-700"
        >
          <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isExpanded && (
        <div className="animate-fade-up border-t border-line bg-paper-1/60 p-3.5">
          <HotelDetailSections
            hotel={hotel}
            expandedDetails={expandedDetails}
            detailsLoading={!!detailsLoading}
            fit={fit}
          />
        </div>
      )}
    </div>
  );
}
