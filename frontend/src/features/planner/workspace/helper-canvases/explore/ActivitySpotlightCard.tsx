'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Check, ArrowRightLeft, Globe, Zap, Clock, DollarSign, Users,
  CalendarCheck, ChevronDown,
} from 'lucide-react';
import type { ActivityRecommendation } from './services/activityRecommendationEngine';
import { FOCUS_RING_CLASS } from '@/lib/utils';

interface ActivityBookingHeaderProps {
  recommendation: ActivityRecommendation;
  compact: boolean;
}

interface ActivitySpotlightCardProps {
  recommendation: ActivityRecommendation;
  isPending: boolean;
  compact: boolean;
  onSelect: () => void;
}

// ── Difficulty dot bar ─────────────────────────────────────────────────────
function DifficultyDots({ score }: { score: number }) {
  const colors = ['bg-emerald-400', 'bg-yellow-400', 'bg-orange-400', 'bg-red-400', 'bg-red-600'];
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`inline-block h-2 w-2 rounded-full transition-colors ${
            i < score ? colors[Math.min(score - 1, colors.length - 1)] : 'bg-slate-200'
          }`}
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

/**
 * ActivityBookingHeader — replaces ExperienceProgressCard for the Activities
 * tab. Shows booking urgency, duration, group size, and slot availability.
 * Collapses on scroll like the progress card.
 */
export function ActivityBookingHeader({ recommendation, compact }: ActivityBookingHeaderProps) {
  const { durationLabel, difficulty, difficultyScore: _ds, slotsAvailableLabel, groupSizeLabel, bookingRequired, bookingLeadTimeHours } = recommendation;

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="mx-4 mb-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-surface"
    >
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap size={13} className="text-rose-500 fill-rose-100" />
            <AnimatePresence mode="wait">
              {compact ? (
                <motion.span
                  key="compact"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[11px] font-semibold text-slate-700"
                >
                  Activities · {slotsAvailableLabel}
                </motion.span>
              ) : (
                <motion.span
                  key="full"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-[11px] font-semibold text-slate-700"
                >
                  Availability &amp; booking
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${SLOTS_COLOR(slotsAvailableLabel)}`}>
            {slotsAvailableLabel}
          </span>
        </div>

        {!compact && (
          <div className="flex flex-wrap gap-1.5">
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
              <Clock size={10} className="text-slate-400" /> {durationLabel}
            </span>
            <span className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${DIFFICULTY_COLOR[difficulty]}`}>
              {difficulty}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
              <Users size={10} className="text-slate-400" /> {groupSizeLabel}
            </span>
            {bookingRequired && bookingLeadTimeHours > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                <CalendarCheck size={10} /> Book {bookingLeadTimeHours}h before
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * ActivitySpotlightCard — hero card for the top recommended activity.
 * Visually distinct from AttractionSpotlightCard: bold availability badge
 * overlaid on image, rose accent, emphasis on booking + difficulty + price.
 */
export default function ActivitySpotlightCard({
  recommendation,
  isPending,
  compact,
  onSelect,
}: ActivitySpotlightCardProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    suggestion,
    label,
    confidence,
    confidenceReason,
    strengths,
    tradeOffs,
    difficulty,
    difficultyScore,
    durationLabel,
    priceLabel,
    bookingRequired,
    bookingLeadTimeHours,
    slotsAvailableLabel,
    whatIncluded,
    whatToBring,
    ageRequirement,
    groupSizeLabel,
    cancellationPolicy,
  } = recommendation;

  const allPhotos = [suggestion.image_url, ...suggestion.secondary_images].filter(Boolean) as string[];

  const CONFIDENCE_DOT = { High: 'bg-emerald-500', Medium: 'bg-amber-500', Low: 'bg-slate-400' };

  const LABEL_EMOJI: Record<string, string> = {
    'Thrill Seeker': '⚡',
    'Cultural Immersion': '🎭',
    'Best for Beginners': '🌱',
    'Family Activity': '👨‍👩‍👧',
    'Scenic Adventure': '🏔️',
    'Budget Pick': '💸',
    'Popular Choice': '🔥',
  };

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-surface hover:shadow-hover transition-shadow"
    >
      {/* ── Hero image with bold overlay ── */}
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
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-800">
            <Zap size={40} className="text-slate-600 opacity-40" />
          </div>
        )}

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Availability badge — top right, urgent */}
        <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm ${SLOTS_COLOR(slotsAvailableLabel)}`}>
          {slotsAvailableLabel}
        </span>

        {/* Booking urgency chip — top left if advance booking needed */}
        {bookingRequired && bookingLeadTimeHours > 0 && (
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/90 px-2.5 py-1 text-[10px] font-bold backdrop-blur-sm text-amber-700">
            <CalendarCheck size={9} /> Book {bookingLeadTimeHours}h before
          </span>
        )}

        {/* Label + confidence dot — bottom left */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
            <span>{LABEL_EMOJI[label] || '⚡'}</span>
            {label}
          </span>
          <span className={`h-2 w-2 rounded-full ${CONFIDENCE_DOT[confidence]}`} title={`${confidence} confidence`} />
        </div>
      </motion.div>

      {/* ── Card body ── */}
      <div className="p-3.5">
        {/* Row 1 — name + difficulty + add button */}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-bold text-slate-900 leading-tight">{suggestion.name}</h2>
            <div className="mt-1.5 flex items-center gap-2">
              <DifficultyDots score={difficultyScore} />
              <span className={`text-[10px] font-bold rounded-full border px-2 py-0.5 ${DIFFICULTY_COLOR[difficulty]}`}>
                {difficulty}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onSelect}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
              isPending
                ? 'bg-rose-50 text-rose-700'
                : 'bg-rose-500 text-white hover:bg-rose-600'
            }`}
          >
            {isPending ? <><Check size={12} className="inline mr-1" />Added</> : 'Add to Day'}
          </button>
        </div>

        {/* Row 2 — pill strip: duration, price, group */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
            <Clock size={10} className="text-slate-400" /> {durationLabel}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
            <DollarSign size={10} className="text-slate-400" /> {priceLabel}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
            <Users size={10} className="text-slate-400" /> {groupSizeLabel}
          </span>
          {ageRequirement && (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
              {ageRequirement}
            </span>
          )}
        </div>

        {/* Row 3 — AI insight + expand */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className={`mt-2.5 flex w-full items-start gap-1.5 text-left rounded-lg p-2 -mx-2 hover:bg-slate-50 transition-colors ${FOCUS_RING_CLASS}`}
        >
          <Sparkles size={11} className="mt-0.5 shrink-0 text-rose-500 fill-current" />
          <span className="min-w-0 flex-1 text-[11px] font-medium text-slate-700 line-clamp-2">
            {confidenceReason}
          </span>
          <ChevronDown size={13} className={`mt-0.5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* ── Expanded accordion ── */}
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
                      <ArrowRightLeft size={10} className="mt-0.5 shrink-0 text-slate-400" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* What's included */}
              {whatIncluded.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">What's included</p>
                  <div className="flex flex-wrap gap-1.5">
                    {whatIncluded.map((item, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Check size={9} strokeWidth={3} /> {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* What to bring */}
              {whatToBring.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">What to bring</p>
                  <div className="flex flex-wrap gap-1.5">
                    {whatToBring.map((item, i) => (
                      <span key={i} className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancellation */}
              <p className="text-[10.5px] text-slate-500 flex items-start gap-1.5">
                <CalendarCheck size={11} className="mt-0.5 text-slate-400 shrink-0" />
                {cancellationPolicy}
              </p>

              {/* Website CTA + Add to Plan */}
              <div className="flex gap-2">
                {suggestion.details?.website_uri && (
                  <a
                    href={suggestion.details.website_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Globe size={12} /> Book Online
                  </a>
                )}
                <button
                  type="button"
                  onClick={onSelect}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-[0.98] ${
                    isPending ? 'bg-rose-50 text-rose-700' : 'bg-rose-500 text-white hover:bg-rose-600'
                  }`}
                >
                  {isPending ? 'Added ✓' : `Add to Day · ${priceLabel}`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
