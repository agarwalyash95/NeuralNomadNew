'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, ArrowRightLeft, Utensils, ChevronDown, Clock, MapPin, Star } from 'lucide-react';
import type { MealRecommendation } from './services/mealRecommendationEngine';
import { getFoodFirstPhotos, getBudgetBreakdown } from './services/mealPresentation';

interface MealDecisionCardProps {
  recommendation: MealRecommendation;
  isPending: boolean;
  /** True once the canvas has scrolled past the top of the list — shrinks the hero photo. */
  compact?: boolean;
  onSelect: () => void;
}

const CONFIDENCE_DOT: Record<MealRecommendation['confidence'], string> = {
  High: 'bg-emerald-500',
  Medium: 'bg-amber-500',
  Low: 'bg-rose-500',
};

export default function MealDecisionCard({ recommendation, isPending, compact, onSelect }: MealDecisionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    suggestion,
    label,
    confidence,
    confidenceReason,
    strengths,
    tradeOffs,
    budgetImpact,
    nearbyAttractions,
    signatureDishes,
    diningAtmosphere,
    crowdLevel,
    bestTimeToVisit,
    timeSlot,
  } = recommendation;

  const dist = suggestion.distance_km ?? 1.2;
  const walkTime = Math.round(dist * 12);
  const costLabel = suggestion.price_label || '₹₹';
  const photo = getFoodFirstPhotos(suggestion)[0];
  const budget = getBudgetBreakdown(budgetImpact);

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-surface transition-shadow hover:shadow-hover"
    >
      <div className="p-3.5">
        {/* Row 1 — photo, identity, primary action */}
        <div className="flex items-start gap-3">
          <motion.div
            layout
            className={`relative shrink-0 overflow-hidden rounded-xl bg-paper-1 ${compact ? 'h-12 w-12' : 'h-14 w-14'}`}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {photo ? (
              <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-cat-food/10">
                <Utensils size={18} className="text-cat-food" />
              </div>
            )}
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-white">
                <Sparkles size={9} className="fill-current" /> {label}
              </span>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CONFIDENCE_DOT[confidence]}`} title={`${confidence} confidence`} />
            </div>
            <h2 className="mt-1 truncate text-title text-ink-900">{suggestion.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-ink-500">
              {suggestion.rating != null && (
                <span className="flex items-center gap-0.5 font-semibold text-ink-700">
                  <Star size={10} className="fill-amber-400 text-amber-400" /> {suggestion.rating}
                </span>
              )}
              <span className="tabular-nums">{walkTime} min walk</span>
              <span className="font-semibold text-cat-food">{costLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onSelect}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors active:scale-95 ${
              isPending ? 'bg-cat-food/15 text-cat-food' : 'bg-cat-food text-white hover:brightness-110'
            }`}
          >
            {isPending ? <span className="inline-flex items-center gap-1"><Check size={12} /> Selected</span> : 'Choose'}
          </button>
        </div>

        {/* Row 2 — one-line AI insight, expandable */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-2.5 flex w-full items-start gap-1.5 text-left"
        >
          <Sparkles size={12} className="mt-0.5 shrink-0 text-violet-600" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-700">{confidenceReason}</span>
          <ChevronDown size={13} className={`mt-0.5 shrink-0 text-ink-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Row 3 — always-visible facts: timing + budget, no percentages */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-500">
          <span className="flex items-center gap-1">
            <Clock size={11} className="text-ink-400" /> {timeSlot}
          </span>
          <span className="tabular-nums">
            <span className="font-semibold text-ink-700">₹{budget.spent}</span> for two ·{' '}
            <span className={budget.overBudget ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-700'}>
              ₹{Math.abs(budget.remaining)} {budget.overBudget ? 'over' : 'left'}
            </span>{' '}
            of ₹{budget.allocated} budget
          </span>
        </div>
      </div>

      {expanded && (
        <div className="animate-fade-up border-t border-line bg-paper-1/60 p-3.5">
          {/* AI reasoning — bullets, not paragraphs. Violet stays confined to this panel. */}
          <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-violet-700">
              <Sparkles size={12} className="fill-current" />
              <span className="text-[11px] font-bold uppercase tracking-wide">Why this pick</span>
            </div>
            <ul className="space-y-1.5">
              {strengths.slice(0, 2).map((s, i) => (
                <li key={`s-${i}`} className="flex items-start gap-1.5 text-xs leading-snug text-ink-700">
                  <Check size={12} className="mt-0.5 shrink-0 text-emerald-600" strokeWidth={3} />
                  <span>{s}</span>
                </li>
              ))}
              {tradeOffs.slice(0, 1).map((t, i) => (
                <li key={`t-${i}`} className="flex items-start gap-1.5 text-xs leading-snug text-ink-700">
                  <ArrowRightLeft size={11} className="mt-0.5 shrink-0 text-ink-400" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Signature dishes + atmosphere */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-micro mb-1">Signature dishes</p>
              <div className="flex flex-wrap gap-1">
                {signatureDishes.slice(0, 2).map((dish, i) => (
                  <span key={i} className="rounded-full bg-paper-2 border border-line px-2 py-0.5 text-[10.5px] font-medium text-ink-700">
                    {dish}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-micro mb-1">Atmosphere</p>
              <p className="text-[11px] leading-snug text-ink-700 line-clamp-2">{diningAtmosphere}</p>
            </div>
          </div>

          {/* Crowd, timing, proximity */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-ink-500">
            <span>🔥 {crowdLevel} crowd · best {bestTimeToVisit}</span>
            <span className="flex items-center gap-1 truncate">
              <MapPin size={10} className="text-ink-400" /> Near {nearbyAttractions[0] || 'itinerary stop'}
            </span>
          </div>

          {/* Budget breakdown — allocated / spent / remaining, no percentages */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-paper-2 border border-line p-2 text-center">
              <p className="text-sm font-bold tabular-nums text-ink-900">₹{budget.allocated}</p>
              <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">Allocated</p>
            </div>
            <div className="rounded-lg bg-paper-2 border border-line p-2 text-center">
              <p className="text-sm font-bold tabular-nums text-ink-900">₹{budget.spent}</p>
              <p className="text-[9.5px] font-semibold uppercase tracking-wide text-ink-400">Est. spend</p>
            </div>
            <div className={`rounded-lg border p-2 text-center ${budget.overBudget ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <p className={`text-sm font-bold tabular-nums ${budget.overBudget ? 'text-rose-700' : 'text-emerald-700'}`}>
                {budget.overBudget ? '−' : ''}₹{Math.abs(budget.remaining)}
              </p>
              <p className={`text-[9.5px] font-semibold uppercase tracking-wide ${budget.overBudget ? 'text-rose-500' : 'text-emerald-600'}`}>
                {budget.overBudget ? 'Over budget' : 'Remaining'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onSelect}
            className={`mt-3.5 w-full rounded-xl py-2.5 text-xs font-bold transition-all active:scale-[0.98] ${
              isPending ? 'bg-cat-food/15 text-cat-food' : 'bg-cat-food text-white hover:brightness-110'
            }`}
          >
            {isPending ? "Added to day's plan" : `Continue with ${suggestion.name} · ${costLabel} · ${walkTime} min walk`}
          </button>
        </div>
      )}
    </motion.div>
  );
}
