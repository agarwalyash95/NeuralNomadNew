'use client';

import React, { useState } from 'react';
import { GitCompareArrows, X, ChevronUp, Sparkles } from 'lucide-react';
import { FOCUS_RING_CLASS } from '@/lib/utils';
import type { AttractionRecommendation } from './services/sightRecommendationEngine';
import type { ActivityRecommendation } from './services/activityRecommendationEngine';
import type { Suggestion } from '../../plan-canvas/types';

type Tab = 'attractions' | 'activities';

interface SightCompareTrayProps {
  activeTab: Tab;
  comparedAttractions: AttractionRecommendation[];
  comparedActivities: ActivityRecommendation[];
  onRemoveAttraction: (id: number) => void;
  onRemoveActivity: (id: number) => void;
  onSelectAttraction: (s: Suggestion) => void;
  onSelectActivity: (s: Suggestion) => void;
}

interface Row {
  label: string;
  values: (string | null)[];
}

function buildAttractionRows(compared: AttractionRecommendation[]): Row[] {
  return [
    { label: 'Rating', values: compared.map((r) => (r.suggestion.rating != null ? `${r.suggestion.rating}★` : null)) },
    { label: 'Walk time', values: compared.map((r) => (r.walkTimeMins != null ? `${r.walkTimeMins} min` : null)) },
    { label: 'Entry fee', values: compared.map((r) => r.entryFee) },
  ];
}

function buildActivityRows(compared: ActivityRecommendation[]): Row[] {
  return [
    { label: 'Difficulty', values: compared.map((r) => r.difficulty) },
    { label: 'Duration', values: compared.map((r) => r.durationLabel) },
    { label: 'Price', values: compared.map((r) => r.priceLabel) },
    { label: 'Booking', values: compared.map((r) => r.bookingRequired === true ? 'Advance booking' : r.bookingRequired === false ? 'Walk-in' : null) },
  ];
}

// ── AI verdict — the key differentiator from the restaurant compare tray ──
function buildAttractionVerdict(compared: AttractionRecommendation[]): string | null {
  if (compared.length < 2) return null;
  const score = (r: AttractionRecommendation) => (r.suggestion.rating ?? 4) - (r.walkTimeMins ?? 99) / 10;
  const winner = [...compared].sort((a, b) => score(b) - score(a))[0];
  if (!winner) return null;
  const context = winner.itineraryContext || "today's route";
  const walkNote = winner.walkTimeMins == null
    ? 'walk time unknown'
    : winner.walkTimeMins <= 10 ? `only ${winner.walkTimeMins} min walk` : `${winner.walkTimeMins} min walk`;
  const feeNote = winner.entryFeeIsReal && winner.entryFee.toLowerCase().includes('free') ? ', free entry' : '';
  return `For ${context}, ${winner.suggestion.name} is the better fit — ${walkNote}${feeNote}.`;
}

function buildActivityVerdict(compared: ActivityRecommendation[]): string | null {
  if (compared.length < 2) return null;
  const winner = [...compared].sort(
    (a, b) => (a.bookingRequired === true ? 1 : 0) - (b.bookingRequired === true ? 1 : 0) || (b.suggestion.rating ?? 4) - (a.suggestion.rating ?? 4),
  )[0];
  if (!winner) return null;
  const parts = [`${winner.suggestion.name} is our pick`];
  if (winner.durationLabel) parts.push(winner.difficulty ? `${winner.durationLabel} of ${winner.difficulty.toLowerCase()}-level fun` : winner.durationLabel);
  if (winner.priceLabel) parts.push(`at ${winner.priceLabel}`);
  if (winner.bookingRequired === true) parts.push('— book ahead');
  else if (winner.bookingRequired === false) parts.push('— walk-in friendly');
  return `${parts.join(' ')}.`;
}

export default function SightCompareTray({
  activeTab,
  comparedAttractions,
  comparedActivities,
  onRemoveAttraction,
  onRemoveActivity,
  onSelectAttraction,
  onSelectActivity,
}: SightCompareTrayProps) {
  const [open, setOpen] = useState(false);

  const compared = activeTab === 'attractions' ? comparedAttractions : comparedActivities;
  if (compared.length === 0) return null;

  const rows =
    activeTab === 'attractions'
      ? buildAttractionRows(comparedAttractions)
      : buildActivityRows(comparedActivities);

  const verdict =
    activeTab === 'attractions'
      ? buildAttractionVerdict(comparedAttractions)
      : buildActivityVerdict(comparedActivities);

  const accentColor =
    activeTab === 'attractions'
      ? { pill: 'bg-cat-attraction', select: 'bg-cat-attraction hover:opacity-90' }
      : { pill: 'bg-cat-activity', select: 'bg-cat-activity hover:opacity-90' };

  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-paper-2 shadow-modal">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2.5 ${FOCUS_RING_CLASS}`}
      >
        <span className="flex items-center gap-2 text-xs font-bold text-ink-900">
          <GitCompareArrows size={14} className={activeTab === 'attractions' ? 'text-cat-attraction' : 'text-cat-activity'} />
          Comparing {compared.length} {activeTab === 'attractions' ? 'attraction' : 'activit'}{compared.length === 1 ? (activeTab === 'activities' ? 'y' : '') : activeTab === 'activities' ? 'ies' : 's'}
        </span>
        <ChevronUp size={16} className={`text-ink-400 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {open && (
        <div className="max-h-[65vh] overflow-y-auto border-t border-line px-4 py-3 space-y-3">
          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="w-20 text-left" />
                  {compared.map((r) => {
                    const id = r.suggestion.id;
                    const name = r.suggestion.name;
                    const onRemove = activeTab === 'attractions'
                      ? () => onRemoveAttraction(id)
                      : () => onRemoveActivity(id);
                    return (
                      <th key={id} className="min-w-[110px] px-2 pb-2 text-left align-top">
                        <div className="flex items-start justify-between gap-1">
                          <span className="line-clamp-2 text-[11.5px] font-bold text-ink-900">{name}</span>
                          <button
                            type="button"
                            onClick={onRemove}
                            className="shrink-0 rounded p-0.5 text-ink-400 hover:bg-paper-1 hover:text-ink-700"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const distinct = new Set(row.values.filter(Boolean)).size;
                  const differs = distinct > 1 || (distinct === 1 && row.values.some((v) => v == null));
                  return (
                    <tr key={row.label} className="border-t border-line">
                      <td className="py-1.5 pr-2 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                        {row.label}
                      </td>
                      {row.values.map((v, i) => (
                        <td
                          key={i}
                          className={`py-1.5 px-2 tabular-nums font-mono ${differs ? 'font-bold text-ink-900' : 'text-ink-400'}`}
                        >
                          {v ?? '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* AI verdict — unique to sight compare tray. Violet (AI semantic),
              not amber (caution) — this is a recommendation, not a warning. */}
          {verdict && (
            <div className="rounded-xl border p-3" style={{ borderColor: 'rgb(var(--color-ai) / 0.18)', background: 'rgb(var(--color-ai) / 0.05)' }}>
              <div className="mb-1.5 flex items-center gap-1.5" style={{ color: 'rgb(var(--color-ai))' }}>
                <Sparkles size={12} className="fill-current" />
                <span className="text-[11px] font-bold uppercase tracking-wide">AI Recommendation</span>
              </div>
              <p className="text-[11.5px] leading-snug text-ink-700">{verdict}</p>
            </div>
          )}

          {/* Select buttons */}
          <div className="flex gap-2">
            {compared.map((r) => {
              const onSelect = activeTab === 'attractions'
                ? () => onSelectAttraction(r.suggestion)
                : () => onSelectActivity(r.suggestion);
              return (
                <button
                  key={r.suggestion.id}
                  type="button"
                  onClick={onSelect}
                  className={`flex-1 rounded-lg py-2 text-[11px] font-bold text-white transition ${accentColor.select}`}
                >
                  Go with {r.suggestion.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
