'use client';

import React from 'react';
import {
  Sparkles, Check, ArrowRightLeft, Map, Globe, Plus,
  Clock, Footprints, Ticket, Camera, Mountain, Landmark,
  AlertTriangle,
} from 'lucide-react';
import type { AttractionRecommendation } from './services/sightRecommendationEngine';
import { getTimingBadge, isOpenNow } from './services/sightPresentation';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface AttractionSuggestionCardProps {
  recommendation: AttractionRecommendation;
  isExpanded: boolean;
  isPending: boolean;
  detailsLoading: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onCompareToggle: () => void;
  isCompared: boolean;
}

function QualityDots({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full ${i < score ? 'bg-emerald-500' : 'bg-slate-200'}`}
        />
      ))}
    </span>
  );
}

export default function AttractionSuggestionCard({
  recommendation,
  isExpanded,
  isPending,
  detailsLoading,
  onToggleExpand,
  onSelect,
  onCompareToggle,
  isCompared,
}: AttractionSuggestionCardProps) {
  const {
    suggestion,
    strengths,
    tradeOffs,
    highlights,
    experienceQualities: q,
    timingSlot,
    bestTimeWindow,
    crowdPeakTime,
    quietTime,
    visitDurationMins,
    entryFee,
    routePosition,
    walkTimeMins,
    contextualWarnings,
  } = recommendation;

  const allPhotos = [suggestion.image_url, ...suggestion.secondary_images].filter(Boolean) as string[];
  const timingBadge = getTimingBadge(timingSlot);
  void isOpenNow; // available for future use

  const visitLabel =
    visitDurationMins >= 60
      ? `${Math.floor(visitDurationMins / 60)}h${visitDurationMins % 60 > 0 ? ` ${visitDurationMins % 60}m` : ''}`
      : `${visitDurationMins}m`;

  const mapsUrl = suggestion.latitude && suggestion.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${suggestion.latitude},${suggestion.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(suggestion.name)}`;

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all bg-white ${
        isExpanded
          ? 'border-emerald-200 shadow-hover'
          : 'border-slate-100 hover:border-emerald-200 shadow-surface hover:shadow-hover'
      }`}
    >
      {/* ── Collapsed row ── */}
      <div
        className={`flex items-center gap-2.5 p-2.5 select-none cursor-pointer ${FOCUS_RING_CLASS}`}
        {...clickableDivProps(onToggleExpand)}
        aria-expanded={isExpanded}
      >
        {/* Thumbnail with timing emoji badge */}
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
              <Mountain size={24} className="text-slate-300" />
            </div>
          )}
          {/* Timing emoji badge in corner */}
          <span className="absolute bottom-1 left-1 text-[12px] drop-shadow-sm">
            {timingBadge.emoji}
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="truncate text-[13px] font-bold text-slate-900 leading-tight">{suggestion.name}</h3>

          {/* 3-quality dot row — Photography · Scenic · History */}
          <div className="mt-1 flex items-center gap-2.5 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <Camera size={9} />
              <QualityDots score={q.photography} />
            </span>
            <span className="flex items-center gap-1">
              <Mountain size={9} />
              <QualityDots score={q.scenic} />
            </span>
            <span className="flex items-center gap-1">
              <Landmark size={9} />
              <QualityDots score={q.history} />
            </span>
          </div>

          {/* One-line route context */}
          <p className="mt-1 text-[10px] text-slate-400 truncate">{routePosition}</p>
        </div>

        {/* Right actions */}
        <div className="flex shrink-0 flex-col items-end gap-2 border-l border-slate-100 pl-2.5">
          <label
            className="flex cursor-pointer items-center gap-1"
            onClick={(e) => { e.stopPropagation(); onCompareToggle(); }}
          >
            <input
              type="checkbox"
              checked={isCompared}
              readOnly
              className="h-3.5 w-3.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-400 cursor-pointer"
            />
          </label>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer ${
              isPending
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700'
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
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />
              Loading visit details…
            </div>
          ) : (
            <>
              {/* AI reasoning — violet convention shared across all canvases */}
              <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-700 mb-2">
                  <Sparkles size={11} className="fill-current" />
                  Why visit
                </span>
                <ul className="space-y-1.5">
                  {strengths.slice(0, 2).map((s, i) => (
                    <li key={`s-${i}`} className="flex items-start gap-1.5 text-xs text-slate-700 leading-snug">
                      <Check size={11} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                      {s}
                    </li>
                  ))}
                  {tradeOffs.slice(0, 1).map((t, i) => (
                    <li key={`t-${i}`} className="flex items-start gap-1.5 text-xs text-slate-600 leading-snug">
                      <ArrowRightLeft size={10} className="mt-0.5 shrink-0 text-slate-400" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* At-a-glance pills */}
              <div className="flex flex-wrap gap-1.5">
                <span className="flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                  <Clock size={10} className="text-slate-400" /> {visitLabel} visit
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                  <Footprints size={10} className="text-slate-400" /> {walkTimeMins} min walk
                </span>
                <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                  entryFee === 'Free' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <Ticket size={10} className="text-slate-400" /> {entryFee}
                </span>
                <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${timingBadge.color}`}>
                  {timingBadge.emoji} {bestTimeWindow}
                </span>
              </div>

              {/* Crowd timing */}
              <div className="rounded-lg bg-white border border-slate-100 p-2.5 text-[10.5px] text-slate-600 space-y-1">
                <div><span className="font-semibold text-slate-800">Peak crowd: </span>{crowdPeakTime}</div>
                {quietTime && <div><span className="font-semibold text-slate-800">Quietest: </span>{quietTime}</div>}
              </div>

              {/* Highlights */}
              {highlights.length > 0 && (
                <ul className="space-y-1">
                  {highlights.slice(0, 3).map((h, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-snug">
                      <span className="text-emerald-500 mt-0.5">✦</span>
                      {h}
                    </li>
                  ))}
                </ul>
              )}

              {/* Warning chips */}
              {contextualWarnings.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {contextualWarnings.slice(0, 2).map((w, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      <AlertTriangle size={9} /> {w}
                    </span>
                  ))}
                </div>
              )}

              {/* Map link — no address */}
              <div className="flex gap-2">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Map size={12} /> See on Map
                </a>
                {suggestion.details?.website_uri && (
                  <a
                    href={suggestion.details.website_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Globe size={12} />
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                className={`w-full rounded-xl py-2.5 text-xs font-bold transition-all active:scale-[0.98] ${
                  isPending
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isPending
                  ? 'Added to plan ✓'
                  : `Add to Day · ${visitLabel} · ${walkTimeMins} min walk`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
