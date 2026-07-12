'use client';

import React, { useId, useState } from 'react';
import { Sparkles, ChevronDown, Check, ArrowRightLeft } from 'lucide-react';
import { FOCUS_RING_CLASS } from '@/lib/utils';
import type { TripFitResult } from './tripFit';

interface HotelTripFitBadgeProps {
  fit: TripFitResult;
  /** True once the trip has any geo-tagged planned stops to reason about. */
  hasItineraryData: boolean;
  /** compact: score only, for the collapsed card row. full: adds a "Trip Fit" label. */
  variant?: 'compact' | 'full';
}

/**
 * Replaces the old passive "AI suggested" badge with a score plus the real
 * reasons behind it, disclosed on click (not hover-only, so it's reachable
 * by keyboard and touch). Styled with the app's `estimated` trust tier —
 * this is a stated formula over real data, not a verified fact or a raw
 * model guess.
 */
export default function HotelTripFitBadge({ fit, hasItineraryData, variant = 'compact' }: HotelTripFitBadgeProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-dashed border-trust-estimated/40 bg-trust-estimated/10 px-2.5 py-1 text-trust-estimated transition-colors hover:bg-trust-estimated/15 ${FOCUS_RING_CLASS}`}
      >
        <Sparkles size={12} strokeWidth={2.5} />
        <span className="text-xs font-bold tabular-nums">{fit.score}%</span>
        {variant === 'full' && <span className="text-[10px] font-semibold uppercase tracking-wide">Trip Fit</span>}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          id={panelId}
          className="shadow-surface mt-1.5 w-64 max-w-[80vw] rounded-lg border border-line bg-paper-2 p-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          {fit.reasons.length > 0 ? (
            <ul className="space-y-1.5">
              {fit.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11.5px] leading-snug text-ink-700">
                  {r.tone === 'positive' ? (
                    <Check size={12} className="mt-0.5 shrink-0 text-trust-estimated" strokeWidth={3} />
                  ) : (
                    <ArrowRightLeft size={11} className="mt-0.5 shrink-0 text-ink-400" />
                  )}
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-ink-500">
              {hasItineraryData
                ? 'Not enough data yet to explain this score.'
                : 'Add stops to your itinerary to see how this hotel fits your plan.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
