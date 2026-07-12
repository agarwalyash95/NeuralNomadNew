'use client';

import React, { useState } from 'react';
import { GitCompareArrows, X, ChevronUp } from 'lucide-react';
import type { Suggestion } from '@/features/planner/workspace/plan-canvas/types';
import { FOCUS_RING_CLASS } from '@/lib/utils';
import type { ItineraryImpact } from './itineraryImpact';
import type { TripFitResult } from './tripFit';
import { buildHotelFacts } from './hotelFacts';

interface PinnedHotel {
  hotel: Suggestion;
  impact: ItineraryImpact | null;
  fit: TripFitResult;
}

interface HotelCompareTrayProps {
  pinned: PinnedHotel[];
  onUnpin: (id: number) => void;
  onSelect: (hotel: Suggestion) => void;
}

interface Row {
  label: string;
  values: (string | null)[];
}

/**
 * Pin up to 3 results and see only what differs, led by itinerary impact —
 * not a generic amenity grid. Identical rows across every pinned hotel are
 * muted rather than repeated at full weight.
 */
export default function HotelCompareTray({ pinned, onUnpin, onSelect }: HotelCompareTrayProps) {
  const [open, setOpen] = useState(false);
  if (pinned.length === 0) return null;

  const rows: Row[] = [
    { label: 'Trip Fit', values: pinned.map((p) => `${p.fit.score}%`) },
    {
      label: 'Nearest planned stop',
      values: pinned.map((p) => (p.impact ? `${p.impact.nearestStop.durationMins} min` : null)),
    },
    {
      label: 'Avg. time to plan',
      values: pinned.map((p) => (p.impact ? `${p.impact.averageMinutes} min` : null)),
    },
    { label: 'Rating', values: pinned.map((p) => (p.hotel.rating != null ? `${p.hotel.rating}★ (${p.hotel.ratings_count})` : null)) },
    { label: 'Price tier', values: pinned.map((p) => p.hotel.details?.price_range || null) },
  ];

  const factRows: Row[] = (() => {
    const allLabels = new Set<string>();
    pinned.forEach((p) => buildHotelFacts(p.hotel).forEach((f) => allLabels.add(f.label)));
    return Array.from(allLabels).map((label) => ({
      label,
      values: pinned.map((p) => (buildHotelFacts(p.hotel).some((f) => f.label === label) ? 'Yes' : null)),
    }));
  })();

  const allRows = [...rows, ...factRows];

  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-paper-2 shadow-modal">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2.5 ${FOCUS_RING_CLASS}`}
      >
        <span className="flex items-center gap-2 text-xs font-bold text-ink-900">
          <GitCompareArrows size={14} className="text-cat-stay" />
          Comparing {pinned.length} hotel{pinned.length === 1 ? '' : 's'}
        </span>
        <ChevronUp size={16} className={`text-ink-400 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {open && (
        <div className="max-h-[60vh] overflow-y-auto border-t border-line px-4 py-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-28 text-left"> </th>
                  {pinned.map((p) => (
                    <th key={p.hotel.id} className="min-w-[110px] px-2 pb-2 text-left align-top">
                      <div className="flex items-start justify-between gap-1">
                        <span className="line-clamp-2 text-[11.5px] font-bold text-ink-900">{p.hotel.name}</span>
                        <button
                          type="button"
                          onClick={() => onUnpin(p.hotel.id)}
                          aria-label={`Remove ${p.hotel.name} from comparison`}
                          className="shrink-0 rounded p-0.5 text-ink-400 hover:bg-paper-1 hover:text-ink-700"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => {
                  const distinct = new Set(row.values.filter(Boolean)).size;
                  const differs = distinct > 1 || (distinct === 1 && row.values.some((v) => v == null));
                  return (
                    <tr key={row.label} className="border-t border-line">
                      <td className="py-1.5 pr-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">{row.label}</td>
                      {row.values.map((v, i) => (
                        <td key={i} className={`py-1.5 px-2 tabular-nums ${differs ? 'font-bold text-ink-900' : 'text-ink-400'}`}>
                          {v ?? '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex gap-2">
            {pinned.map((p) => (
              <button
                key={p.hotel.id}
                type="button"
                onClick={() => onSelect(p.hotel)}
                className="flex-1 rounded-lg bg-cat-stay py-2 text-[11px] font-bold text-white transition hover:brightness-110"
              >
                Select {p.hotel.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
