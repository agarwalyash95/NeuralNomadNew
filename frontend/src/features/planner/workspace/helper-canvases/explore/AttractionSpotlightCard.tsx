'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Check, ArrowRightLeft, Map, Globe, ChevronDown, AlertTriangle,
  Clock, Footprints, Ticket, Camera, Mountain, Landmark, Users, Accessibility,
} from 'lucide-react';
import type { AttractionRecommendation } from './services/sightRecommendationEngine';
import { getTimingBadge, getWeatherBadge, isOpenNow } from './services/sightPresentation';
import MediaLightbox from '@/features/planner/components/MediaLightbox';
import { FOCUS_RING_CLASS } from '@/lib/utils';

interface AttractionSpotlightCardProps {
  recommendation: AttractionRecommendation;
  isPending: boolean;
  compact: boolean;
  onSelect: () => void;
}

// ── Quality dot bar ───────────────────────────────────────────────────────
// 5 dots, filled/unfilled — replaces the numeric star rating as the
// primary quality signal for attractions.
function QualityDots({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
            i < score ? 'bg-emerald-500' : 'bg-slate-200'
          }`}
        />
      ))}
    </span>
  );
}

// ── Quality row for expanded state ────────────────────────────────────────
const QUALITY_META = [
  { key: 'photography' as const, icon: Camera, label: 'Photography' },
  { key: 'scenic' as const, icon: Mountain, label: 'Scenic' },
  { key: 'history' as const, icon: Landmark, label: 'History' },
  { key: 'familyFriendly' as const, icon: Users, label: 'Family' },
  { key: 'accessibility' as const, icon: Accessibility, label: 'Accessible' },
  { key: 'walkingEffort' as const, icon: Footprints, label: 'Walking Effort' },
];

export default function AttractionSpotlightCard({
  recommendation,
  isPending,
  compact,
  onSelect,
}: AttractionSpotlightCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const {
    suggestion,
    label,
    confidence,
    confidenceReason,
    strengths,
    tradeOffs,
    highlights,
    experienceQualities: q,
    timingSlot,
    bestTimeWindow,
    weatherSuitability,
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
  const weatherBadge = getWeatherBadge(weatherSuitability);
  const openStatus = isOpenNow(suggestion.details?.opening_hours);

  const CONFIDENCE_DOT: Record<'High' | 'Medium' | 'Low', string> = {
    High: 'bg-emerald-500',
    Medium: 'bg-amber-500',
    Low: 'bg-slate-400',
  };

  const visitLabel =
    visitDurationMins >= 60
      ? `${Math.floor(visitDurationMins / 60)}h${visitDurationMins % 60 > 0 ? ` ${visitDurationMins % 60}m` : ''}`
      : `${visitDurationMins}m`;

  const mapsUrl = suggestion.latitude && suggestion.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${suggestion.latitude},${suggestion.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(suggestion.name)}`;

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-surface hover:shadow-hover transition-shadow"
    >
      {/* ── Hero image — cinematic landscape, not portrait thumbnail ── */}
      <motion.div
        layout
        className={`relative w-full overflow-hidden bg-slate-900 ${compact ? 'h-28' : 'h-44'}`}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {allPhotos[0] ? (
          <img
            src={allPhotos[0]}
            alt={suggestion.name}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            onClick={() => setLightboxIndex(0)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-800">
            <Mountain size={40} className="text-slate-600 opacity-40" />
          </div>
        )}

        {/* Dark gradient overlay — bottom only so image reads top-to-bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Timing badge — top left */}
        <span
          className={`absolute left-3 top-3 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm ${timingBadge.color}`}
        >
          {timingBadge.emoji} {timingBadge.label}
        </span>

        {/* Open status — top right */}
        {openStatus !== 'unknown' && (
          <span
            className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm border ${
              openStatus === 'open'
                ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200'
                : 'bg-slate-100/90 text-slate-500 border-slate-200'
            }`}
          >
            {openStatus === 'open' ? 'Open now' : 'Closed'}
          </span>
        )}

        {/* AI label + confidence dot — bottom left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
            <Sparkles size={9} className="fill-current" />
            {label}
          </span>
          <span
            className={`h-2 w-2 rounded-full ${CONFIDENCE_DOT[confidence]}`}
            title={`${confidence} confidence`}
          />
        </div>

        {/* Photo count — bottom right */}
        {allPhotos.length > 1 && (
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
          >
            <Camera size={10} /> {allPhotos.length}
          </button>
        )}
      </motion.div>

      {/* ── Card body ── */}
      <div className="p-3.5">
        {/* Row 1 — name + top-3 quality dots + add button */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-bold leading-tight text-slate-900">{suggestion.name}</h2>

            {/* 3-quality dot row for fast scanning */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
              <span className="flex items-center gap-1">
                <Camera size={10} className="text-slate-400" />
                <QualityDots score={q.photography} />
              </span>
              <span className="flex items-center gap-1">
                <Mountain size={10} className="text-slate-400" />
                <QualityDots score={q.scenic} />
              </span>
              <span className="flex items-center gap-1">
                <Landmark size={10} className="text-slate-400" />
                <QualityDots score={q.history} />
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSelect}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
              isPending
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {isPending ? <><Check size={12} className="inline mr-1" />Added</> : 'Add to Day'}
          </button>
        </div>

        {/* Row 2 — at-a-glance pill strip */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
            <Clock size={10} className="text-slate-400" />
            {visitLabel} visit
          </span>
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
            <Footprints size={10} className="text-slate-400" />
            {walkTimeMins} min walk
          </span>
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            entryFee === 'Free' || entryFee.toLowerCase().includes('free')
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-700'
          }`}>
            <Ticket size={10} className="text-slate-400" />
            {entryFee}
          </span>
          {weatherBadge && (
            <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${weatherBadge.color}`}>
              {weatherBadge.emoji} {weatherBadge.label}
            </span>
          )}
        </div>

        {/* Row 3 — AI routing insight + expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className={`mt-2.5 flex w-full items-start gap-1.5 text-left rounded-lg p-2 -mx-2 hover:bg-slate-50 transition-colors ${FOCUS_RING_CLASS}`}
        >
          <Sparkles size={11} className="mt-0.5 shrink-0 text-emerald-600 fill-current" />
          <span className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-slate-700 line-clamp-2">
            {confidenceReason}
          </span>
          <ChevronDown
            size={13}
            className={`mt-0.5 shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Route position — always visible, below insight */}
        <p className="mt-1 text-[10.5px] text-slate-400 pl-5">
          {routePosition}
        </p>

        {/* Warning chips */}
        {contextualWarnings.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {contextualWarnings.slice(0, 2).map((w, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700"
              >
                <AlertTriangle size={9} />
                {w}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Expanded detail — accordion ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-slate-100"
          >
            <div className="p-3.5 space-y-3 bg-slate-50/60">

              {/* AI reasoning — violet dashed surface (global convention) */}
              <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-700">
                    <Sparkles size={11} className="fill-current" />
                    Why visit now
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    confidence === 'High' ? 'bg-emerald-50 text-emerald-700' :
                    confidence === 'Medium' ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {confidence} match
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {strengths.slice(0, 2).map((s, i) => (
                    <li key={`s-${i}`} className="flex items-start gap-1.5 text-xs text-slate-700 leading-snug">
                      <Check size={11} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                      <span>{s}</span>
                    </li>
                  ))}
                  {tradeOffs.slice(0, 1).map((t, i) => (
                    <li key={`t-${i}`} className="flex items-start gap-1.5 text-xs text-slate-600 leading-snug">
                      <ArrowRightLeft size={10} className="mt-0.5 shrink-0 text-slate-400" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Full 6-quality grid */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Experience qualities</p>
                <div className="grid grid-cols-3 gap-2">
                  {QUALITY_META.map(({ key, icon: Icon, label: ql }) => (
                    <div key={key} className="rounded-lg bg-white border border-slate-100 p-2 text-center">
                      <Icon size={13} className="mx-auto mb-1 text-slate-400" />
                      <QualityDots score={q[key]} />
                      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">{ql}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timing + crowd detail */}
              <div className="rounded-lg bg-white border border-slate-100 p-3 text-xs space-y-1.5">
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-base">{getTimingBadge(timingSlot).emoji}</span>
                  <div>
                    <span className="font-semibold text-slate-800">Best time: </span>
                    {bestTimeWindow}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-base">🔥</span>
                  <div>
                    <span className="font-semibold text-slate-800">Peak crowd: </span>
                    {crowdPeakTime}
                    {quietTime && <span className="text-slate-400"> · quiet {quietTime}</span>}
                  </div>
                </div>
              </div>

              {/* Visit tips */}
              {highlights.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Visit highlights</p>
                  <ul className="space-y-1">
                    {highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600 leading-snug">
                        <span className="text-emerald-500 mt-0.5">✦</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Map size={12} /> See on Map
                </a>
                {suggestion.details?.website_uri && (
                  <a
                    href={suggestion.details.website_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Globe size={12} /> Website
                  </a>
                )}
              </div>

              <button
                type="button"
                onClick={onSelect}
                className={`w-full rounded-xl py-2.5 text-xs font-bold transition-all active:scale-[0.98] ${
                  isPending
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isPending
                  ? 'Added to day\'s plan ✓'
                  : `Add to Day · ${visitLabel} visit · ${walkTimeMins} min walk`}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <MediaLightbox
          images={allPhotos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          title={suggestion.name}
        />
      )}
    </motion.div>
  );
}
