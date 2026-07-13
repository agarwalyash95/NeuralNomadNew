'use client';

import React, { useState } from 'react';
import { GitCompareArrows, X, ChevronUp, Sparkles } from 'lucide-react';
import type { Suggestion } from '../../plan-canvas/types';
import { FOCUS_RING_CLASS } from '@/lib/utils';
import type { MealRecommendation } from './services/mealRecommendationEngine';

interface RestaurantCompareTrayProps {
  compared: MealRecommendation[];
  onRemove: (id: number) => void;
  onSelect: (suggestion: Suggestion) => void;
}

interface Row {
  label: string;
  values: (string | null)[];
}

// Verdict — ranks by real rating and real (or estimated) cost only.
// Parity with the Attractions canvas's SightCompareTray, so both compare
// trays give the same "which should I pick" closing argument instead of
// leaving the traveler to read the raw table themselves.
function buildMealVerdict(compared: MealRecommendation[]): string | null {
  if (compared.length < 2) return null;
  const score = (r: MealRecommendation) => (r.suggestion.rating ?? 4) - (r.estimatedCostForTwo ?? 1000) / 500;
  const winner = [...compared].sort((a, b) => score(b) - score(a))[0];
  if (!winner) return null;
  const context = winner.itineraryContext || "today's plan";
  const costNote = winner.estimatedCostForTwo !== null
    ? ` — ${winner.costIsEstimate ? 'est. ' : ''}₹${winner.estimatedCostForTwo} for two`
    : '';
  return `For ${context}, ${winner.suggestion.name} is the better fit${costNote}.`;
}

/**
 * Persistent sticky bottom comparison bar — appears once 2+ restaurants are
 * marked for comparison and stays out of the way (collapsed pill) until
 * opened. Replaces the old full-panel overlay that covered the whole canvas
 * as soon as a single item was compared.
 */
export default function RestaurantCompareTray({ compared, onRemove, onSelect }: RestaurantCompareTrayProps) {
  const [open, setOpen] = useState(false);
  if (compared.length === 0) return null;

  const verdict = buildMealVerdict(compared);

  const rows: Row[] = [
    { label: 'Cuisine', values: compared.map((r) => r.suggestion.subtitle || null) },
    { label: 'Rating', values: compared.map((r) => (r.suggestion.rating != null ? `${r.suggestion.rating}★` : null)) },
    { label: 'Walk time', values: compared.map((r) => (r.walkTimeMins != null ? `${r.walkTimeMins} min` : null)) },
    { label: 'Cost for two', values: compared.map((r) => r.estimatedCostForTwo !== null ? `${r.costIsEstimate ? 'est. ' : ''}₹${r.estimatedCostForTwo}` : null) },
  ];

  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-paper-2 shadow-modal">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2.5 ${FOCUS_RING_CLASS}`}
      >
        <span className="flex items-center gap-2 text-xs font-bold text-ink-900">
          <GitCompareArrows size={14} className="text-cat-food" />
          Comparing {compared.length} restaurant{compared.length === 1 ? '' : 's'}
        </span>
        <ChevronUp size={16} className={`text-ink-400 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {open && (
        <div className="max-h-[60vh] overflow-y-auto border-t border-line px-4 py-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-24 text-left"> </th>
                  {compared.map((r) => (
                    <th key={r.suggestion.id} className="min-w-[110px] px-2 pb-2 text-left align-top">
                      <div className="flex items-start justify-between gap-1">
                        <span className="line-clamp-2 text-[11.5px] font-bold text-ink-900">{r.suggestion.name}</span>
                        <button
                          type="button"
                          onClick={() => onRemove(r.suggestion.id)}
                          aria-label={`Remove ${r.suggestion.name} from comparison`}
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
                {rows.map((row) => {
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

          {/* AI verdict — violet (AI semantic), matching SightCompareTray */}
          {verdict && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'rgb(var(--color-ai) / 0.18)', background: 'rgb(var(--color-ai) / 0.05)' }}>
              <div className="mb-1.5 flex items-center gap-1.5" style={{ color: 'rgb(var(--color-ai))' }}>
                <Sparkles size={12} className="fill-current" />
                <span className="text-[11px] font-bold uppercase tracking-wide">AI Recommendation</span>
              </div>
              <p className="text-[11.5px] leading-snug text-ink-700">{verdict}</p>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            {compared.map((r) => (
              <button
                key={r.suggestion.id}
                type="button"
                onClick={() => onSelect(r.suggestion)}
                className="flex-1 rounded-lg bg-cat-food py-2 text-[11px] font-bold text-white transition hover:brightness-110"
              >
                Select {r.suggestion.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
