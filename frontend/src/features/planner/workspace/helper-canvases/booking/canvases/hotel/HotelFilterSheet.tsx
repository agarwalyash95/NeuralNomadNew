'use client';

import React from 'react';
import { X } from 'lucide-react';
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';
import { FOCUS_RING_CLASS } from '@/lib/utils';

export interface HotelFilters {
  maxPriceTier: number; // 1-4 ($ .. $$$$)
  minRating: number; // 0-4.5
  minTripFit: number; // 0-90
  familyFriendly: boolean;
  propertyTypes: string[];
}

export const DEFAULT_HOTEL_FILTERS: HotelFilters = {
  maxPriceTier: 4,
  minRating: 0,
  minTripFit: 0,
  familyFriendly: false,
  propertyTypes: [],
};

export function isFiltersDefault(f: HotelFilters): boolean {
  return f.maxPriceTier === 4 && f.minRating === 0 && f.minTripFit === 0 && !f.familyFriendly && f.propertyTypes.length === 0;
}

const TIER_LABELS = ['$', '$$', '$$$', '$$$$'];

interface HotelFilterSheetProps {
  results: Suggestion[];
  filters: HotelFilters;
  onChange: (filters: HotelFilters) => void;
  onClose: () => void;
}

/**
 * Budget, rating, and Trip Fit are real sliders over real fields. Property
 * type options are derived from whatever `subtitle` (the real Places
 * category) values actually appear in this result set, not a fixed
 * Luxury/Boutique/Resort list that may not exist in the data. Breakfast,
 * free cancellation, refundable, and "work-friendly" are deliberately not
 * here — `SuggestionDetails` has no field backing any of them, and a filter
 * that can't actually filter anything is worse than no filter.
 */
export default function HotelFilterSheet({ results, filters, onChange, onClose }: HotelFilterSheetProps) {
  const propertyTypes = Array.from(new Set(results.map((h) => h.subtitle).filter(Boolean))) as string[];

  const set = <K extends keyof HotelFilters>(key: K, value: HotelFilters[K]) => onChange({ ...filters, [key]: value });

  const toggleType = (t: string) => {
    set('propertyTypes', filters.propertyTypes.includes(t) ? filters.propertyTypes.filter((x) => x !== t) : [...filters.propertyTypes, t]);
  };

  return (
    <div className="border-b border-line bg-paper-1 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink-700">More filters</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className={`rounded-lg p-1.5 text-ink-400 hover:bg-paper-2 hover:text-ink-700 ${FOCUS_RING_CLASS}`}
        >
          <X size={15} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-ink-600">
            <span>Budget tier</span>
            <span className="tabular-nums text-ink-900">up to {TIER_LABELS[filters.maxPriceTier - 1]}</span>
          </div>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={filters.maxPriceTier}
            onChange={(e) => set('maxPriceTier', Number(e.target.value))}
            className="h-11 w-full accent-cat-stay"
            aria-label="Maximum budget tier"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-ink-600">
            <span>Minimum rating</span>
            <span className="tabular-nums text-ink-900">{filters.minRating === 0 ? 'Any' : `${filters.minRating}★+`}</span>
          </div>
          <input
            type="range"
            min={0}
            max={4.5}
            step={0.5}
            value={filters.minRating}
            onChange={(e) => set('minRating', Number(e.target.value))}
            className="h-11 w-full accent-cat-stay"
            aria-label="Minimum rating"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-ink-600">
            <span>Minimum Trip Fit</span>
            <span className="tabular-nums text-ink-900">{filters.minTripFit === 0 ? 'Any' : `${filters.minTripFit}%+`}</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={10}
            value={filters.minTripFit}
            onChange={(e) => set('minTripFit', Number(e.target.value))}
            className="h-11 w-full accent-cat-stay"
            aria-label="Minimum Trip Fit score"
          />
        </div>

        <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-xs font-semibold text-ink-700">
          <input
            type="checkbox"
            checked={filters.familyFriendly}
            onChange={(e) => set('familyFriendly', e.target.checked)}
            className="h-4 w-4 accent-cat-stay"
          />
          Family-friendly
        </label>

        {propertyTypes.length > 1 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold text-ink-600">Property type</p>
            <div className="flex flex-wrap gap-2">
              {propertyTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`min-h-[36px] rounded-full border px-3 text-xs font-medium capitalize transition-colors ${
                    filters.propertyTypes.includes(t)
                      ? 'border-cat-stay bg-cat-stay text-white'
                      : 'border-line bg-paper-2 text-ink-600 hover:border-cat-stay/40'
                  }`}
                >
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isFiltersDefault(filters) && (
        <button type="button" onClick={() => onChange(DEFAULT_HOTEL_FILTERS)} className="mt-3 text-[11px] font-semibold text-cat-stay hover:underline">
          Reset filters
        </button>
      )}
    </div>
  );
}
