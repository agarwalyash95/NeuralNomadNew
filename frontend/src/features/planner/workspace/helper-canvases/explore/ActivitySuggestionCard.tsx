'use client';

import React from 'react';
import {
  Sparkles, Check, Plus, Clock, DollarSign, Users, Globe, Zap,
} from 'lucide-react';
import type { ActivityRecommendation } from './services/activityRecommendationEngine';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface ActivitySuggestionCardProps {
  recommendation: ActivityRecommendation;
  isExpanded: boolean;
  isPending: boolean;
  detailsLoading: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onCompareToggle: () => void;
  isCompared: boolean;
}

function DifficultyDots({ score }: { score: number }) {
  const colors = ['bg-emerald-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-400', 'bg-red-600'];
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full ${i < score ? colors[Math.min(score - 1, 4)] : 'bg-slate-200'}`}
        />
      ))}
    </span>
  );
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  Advanced: 'bg-orange-50 text-orange-700 border-orange-200',
  Expert: 'bg-red-50 text-red-700 border-red-200',
};

const SLOTS_COLOR = (label: string) =>
  label.toLowerCase().includes('left') || label.toLowerCase().includes('slot')
    ? 'bg-rose-50 text-rose-700 border-rose-200'
    : label.toLowerCase().includes('walk-in')
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-slate-50 text-slate-600 border-slate-200';

export default function ActivitySuggestionCard({
  recommendation,
  isExpanded,
  isPending,
  detailsLoading,
  onToggleExpand,
  onSelect,
  onCompareToggle,
  isCompared,
}: ActivitySuggestionCardProps) {
  const {
    suggestion,
    strengths,
    tradeOffs,
    difficulty,
    difficultyScore,
    durationLabel,
    priceLabel,
    bookingRequired: _br,
    slotsAvailableLabel,
    whatIncluded,
    whatToBring,
    ageRequirement,
    groupSizeLabel,
    cancellationPolicy,
  } = recommendation;

  const allPhotos = [suggestion.image_url, ...suggestion.secondary_images].filter(Boolean) as string[];

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all bg-white ${
        isExpanded
          ? 'border-rose-200 shadow-hover'
          : 'border-slate-100 hover:border-rose-200 shadow-surface hover:shadow-hover'
      }`}
    >
      {/* ── Collapsed row ── */}
      <div
        className={`flex items-center gap-2.5 p-2.5 select-none cursor-pointer ${FOCUS_RING_CLASS}`}
        {...clickableDivProps(onToggleExpand)}
        aria-expanded={isExpanded}
      >
        {/* Thumbnail with difficulty pill */}
        <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {allPhotos[0] ? (
            <img
              src={allPhotos[0]}
              alt={suggestion.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Zap size={24} className="text-slate-300" />
            </div>
          )}
          {/* Difficulty badge in corner */}
          <span className={`absolute bottom-1 left-1 text-[8px] font-bold rounded px-1 py-0.5 border leading-none ${DIFFICULTY_COLOR[difficulty]}`}>
            {difficulty[0]}
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[13px] font-bold text-slate-900 leading-tight">{suggestion.name}</h3>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <DifficultyDots score={difficultyScore} />
            <span className={`text-[9px] font-bold rounded-full border px-1.5 py-0.5 ${DIFFICULTY_COLOR[difficulty]}`}>
              {difficulty}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
            <span className="flex items-center gap-0.5"><Clock size={9} /> {durationLabel}</span>
            <span className="flex items-center gap-0.5 font-semibold text-rose-600"><DollarSign size={9} />{priceLabel}</span>
            <span className={`text-[9px] font-bold border rounded-full px-1.5 py-0.5 ${SLOTS_COLOR(slotsAvailableLabel)}`}>
              {slotsAvailableLabel}
            </span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 flex-col items-end gap-2 border-l border-slate-100 pl-2.5">
          <label
            className="flex cursor-pointer items-center"
            onClick={(e) => { e.stopPropagation(); onCompareToggle(); }}
          >
            <input
              type="checkbox"
              checked={isCompared}
              readOnly
              className="h-3.5 w-3.5 rounded-sm border-slate-300 text-rose-500 focus:ring-rose-300 cursor-pointer"
            />
          </label>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer ${
              isPending
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600'
            }`}
          >
            {isPending ? <Check size={13} strokeWidth={2.5} /> : <Plus size={13} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {isExpanded && (
        <div className="animate-fade-up border-t border-slate-100 bg-slate-50/60 p-3.5 space-y-3">
          {detailsLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-slate-400">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-rose-500" />
              Loading activity details…
            </div>
          ) : (
            <>
              {/* AI reasoning */}
              <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-violet-700">
                  <Sparkles size={11} className="fill-current" />
                  <span className="text-[11px] font-bold uppercase tracking-wide">Why this pick</span>
                </div>
                <ul className="space-y-1.5">
                  {strengths.slice(0, 2).map((s, i) => (
                    <li key={`s-${i}`} className="flex items-start gap-1.5 text-xs text-slate-700 leading-snug">
                      <Check size={11} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                      {s}
                    </li>
                  ))}
                  {tradeOffs.slice(0, 1).map((t, i) => (
                    <li key={`t-${i}`} className="flex items-start gap-1.5 text-xs text-slate-600 leading-snug">
                      <span className="mt-0.5 shrink-0 text-slate-400">→</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Key facts */}
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  <Clock size={9} className="inline mr-0.5" /> {durationLabel}
                </span>
                <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  <Users size={9} className="inline mr-0.5" /> {groupSizeLabel}
                </span>
                {ageRequirement && (
                  <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {ageRequirement}
                  </span>
                )}
              </div>

              {/* What's included */}
              {whatIncluded.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Included</p>
                  <div className="flex flex-wrap gap-1.5">
                    {whatIncluded.map((item, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Check size={9} strokeWidth={3} /> {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* What to bring */}
              {whatToBring.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Bring</p>
                  <div className="flex flex-wrap gap-1.5">
                    {whatToBring.slice(0, 4).map((item, i) => (
                      <span key={i} className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10.5px] text-slate-400">{cancellationPolicy}</p>

              <div className="flex gap-2">
                {suggestion.details?.website_uri && (
                  <a
                    href={suggestion.details.website_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Globe size={12} /> Book Online
                  </a>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelect(); }}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all active:scale-[0.98] ${
                    isPending ? 'bg-rose-50 text-rose-700' : 'bg-rose-500 text-white hover:bg-rose-600'
                  }`}
                >
                  {isPending ? 'Added ✓' : `Add · ${priceLabel}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
