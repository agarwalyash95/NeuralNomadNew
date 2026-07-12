'use client';

import React, { useState } from 'react';
import {
  Star, Clock, Utensils, Sparkles, Check, ArrowRightLeft, Map, Globe, Phone, Plus, ChevronDown,
  Award, MapPinned, PiggyBank, Mountain, Users, Leaf, Coffee, Moon,
} from 'lucide-react';
import type { MealRecommendation } from './services/mealRecommendationEngine';
import { getFoodFirstPhotos, getBudgetBreakdown, isOpenNow } from './services/mealPresentation';
import MediaLightbox from '@/features/planner/components/MediaLightbox';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface RestaurantSuggestionCardProps {
  recommendation: MealRecommendation;
  isExpanded: boolean;
  isPending: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onCompareToggle: () => void;
  isCompared: boolean;
}

// Icon-coded per label so recommendation types are scannable without
// leaning on a rainbow of badge colors — purple stays reserved for the
// AI reasoning panel below, not for categorizing cards.
const LABEL_ICON: Record<MealRecommendation['label'], React.ElementType> = {
  'Best Overall': Award,
  'Best Local Food': MapPinned,
  'Best Budget': PiggyBank,
  'Best View': Mountain,
  'Family Favorite': Users,
  'Vegetarian Pick': Leaf,
  'Trending Cafe': Coffee,
  'Late Night Spot': Moon,
};

export default function RestaurantSuggestionCard({
  recommendation,
  isExpanded,
  isPending,
  onToggleExpand,
  onSelect,
  onCompareToggle,
  isCompared,
}: RestaurantSuggestionCardProps) {
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
    timeSlot,
    itineraryContext,
  } = recommendation;

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const allPhotos = getFoodFirstPhotos(suggestion);
  const dist = suggestion.distance_km ?? 1.2;
  const walkTime = Math.round(dist * 12);
  const costLabel = suggestion.price_label || '₹₹';
  const budget = getBudgetBreakdown(budgetImpact);
  const openStatus = isOpenNow(suggestion.details?.opening_hours);
  const LabelIcon = LABEL_ICON[label] || Award;

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-paper-2 border transition-all ${
        isExpanded ? 'border-cat-food/40 shadow-hover' : 'border-line hover:border-cat-food/30 shadow-surface hover:shadow-hover'
      }`}
    >
      {/* ── Collapsed row ── */}
      <div
        className={`flex items-center gap-3 p-2.5 select-none cursor-pointer ${FOCUS_RING_CLASS}`}
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        {...clickableDivProps(onToggleExpand)}
      >
        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-paper-1">
          {allPhotos[0] ? (
            <img src={allPhotos[0]} alt={suggestion.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-cat-food/10">
              <Utensils size={20} className="text-cat-food" />
            </div>
          )}
          <span className="absolute left-1 top-1 flex items-center justify-center rounded-full bg-black/55 p-1 backdrop-blur-sm" title={label}>
            <LabelIcon size={10} className="text-white" />
          </span>
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-center justify-between gap-1.5">
            <h3 className="truncate text-title text-ink-900">{suggestion.name}</h3>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption">
            {suggestion.rating !== null && (
              <span className="flex items-center gap-0.5 font-semibold text-ink-700">
                <Star size={10} className="fill-amber-400 text-amber-400" /> {suggestion.rating}
              </span>
            )}
            <span className="text-ink-500 tabular-nums">{walkTime}m · {dist}km</span>
            <span className="font-semibold text-cat-food">{costLabel}</span>
            {openStatus !== 'unknown' && (
              <span className={`font-semibold ${openStatus === 'open' ? 'text-emerald-700' : 'text-ink-400'}`}>
                {openStatus === 'open' ? 'Open now' : 'Closed'}
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-ink-700">
            <Sparkles size={10} className="shrink-0 text-violet-600" />
            <span className="truncate">{confidenceReason}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 border-l border-line pl-2.5">
          <label
            className="flex cursor-pointer items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onCompareToggle();
            }}
          >
            <input
              type="checkbox"
              checked={isCompared}
              readOnly
              className="h-3.5 w-3.5 rounded-sm border-line text-cat-food focus:ring-cat-food cursor-pointer"
            />
          </label>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors cursor-pointer ${
              isPending ? 'bg-cat-food/15 text-cat-food' : 'bg-paper-1 hover:bg-line/40 text-ink-700'
            }`}
          >
            {isPending ? <Check size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* ── Expanded — progressive disclosure via accordion sections ── */}
      {isExpanded && (
        <div className="animate-fade-up border-t border-line bg-paper-1/60 p-3.5 space-y-3">
          {/* AI reasoning — always open, bullets not paragraphs, only violet surface on the card */}
          <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-700">
                <Sparkles size={12} className="fill-current" /> Why this pick
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold ${
                confidence === 'High' ? 'bg-emerald-50 text-emerald-700' : confidence === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {confidence} confidence
              </span>
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
              <li className="flex items-start gap-1.5 text-[11px] leading-snug text-ink-500">
                <MapPinned size={11} className="mt-0.5 shrink-0 text-ink-400" />
                <span>{itineraryContext} · {timeSlot} slot · near {nearbyAttractions.join(' and ')}</span>
              </li>
            </ul>

            {signatureDishes.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1 border-t border-violet-100 pt-2.5">
                {signatureDishes.slice(0, 3).map((dish, i) => (
                  <span key={i} className="rounded-full bg-paper-2 border border-line px-2 py-0.5 text-[10.5px] font-medium text-ink-700">
                    {dish}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-violet-100 pt-2.5">
              <div className="rounded-lg bg-paper-2 border border-line p-1.5 text-center">
                <p className="text-xs font-bold tabular-nums text-ink-900">₹{budget.allocated}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-400">Allocated</p>
              </div>
              <div className="rounded-lg bg-paper-2 border border-line p-1.5 text-center">
                <p className="text-xs font-bold tabular-nums text-ink-900">₹{budget.spent}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-400">Est. spend</p>
              </div>
              <div className={`rounded-lg border p-1.5 text-center ${budget.overBudget ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <p className={`text-xs font-bold tabular-nums ${budget.overBudget ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {budget.overBudget ? '−' : ''}₹{Math.abs(budget.remaining)}
                </p>
                <p className={`text-[9px] font-semibold uppercase tracking-wide ${budget.overBudget ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {budget.overBudget ? 'Over' : 'Left'}
                </p>
              </div>
            </div>
          </div>

          {allPhotos.length > 1 && (
            <Section title="Photos" defaultOpen>
              <div className="grid grid-cols-3 gap-1.5">
                {allPhotos.slice(0, 6).map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex(i);
                    }}
                    className="group relative aspect-square overflow-hidden rounded-lg"
                  >
                    <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
                  </button>
                ))}
              </div>
            </Section>
          )}

          <Section title="Hours & contact">
            <div className="space-y-1.5 text-xs text-ink-700">
              {suggestion.details?.opening_hours?.[0] && (
                <p className="flex items-center gap-1.5">
                  <Clock size={12} className="shrink-0 text-ink-400" />
                  <span className="font-semibold text-ink-900">Hours today:</span> {suggestion.details.opening_hours[0].split(': ').slice(1).join(': ')}
                </p>
              )}
              {suggestion.details?.national_phone_number && (
                <p className="flex items-center gap-1.5">
                  <Phone size={12} className="shrink-0 text-ink-400" />
                  <span className="font-semibold text-ink-900">Phone:</span>
                  <a href={`tel:${suggestion.details.national_phone_number}`} className="hover:underline">{suggestion.details.national_phone_number}</a>
                </p>
              )}
              <div className="flex items-center gap-2 pt-1">
                {suggestion.latitude !== null && suggestion.longitude !== null && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${suggestion.latitude},${suggestion.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-paper-2 border border-line py-1.5 text-[11px] font-semibold text-ink-700 hover:bg-paper-1"
                  >
                    <Map size={12} /> Directions
                  </a>
                )}
                {suggestion.details?.website_uri && (
                  <a
                    href={suggestion.details.website_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-paper-2 border border-line py-1.5 text-[11px] font-semibold text-ink-700 hover:bg-paper-1"
                  >
                    <Globe size={12} /> Website
                  </a>
                )}
              </div>
            </div>
          </Section>

          {suggestion.details?.reviews && suggestion.details.reviews.length > 0 && (
            <Section title={`Reviews (${Math.min(5, suggestion.details.reviews.length)})`}>
              <div className="space-y-2">
                {suggestion.details.reviews.slice(0, 3).map((rev: any, idx: number) => {
                  const text = typeof rev.text === 'object' && rev.text ? (rev.text.text || '') : (rev.text || '');
                  const author = rev.authorAttribution?.displayName || rev.author_name || 'Traveler';
                  return (
                    <div key={idx} className="rounded-lg border border-line bg-paper-2 p-2.5 text-xs">
                      <div className="mb-0.5 flex items-center justify-between gap-2 font-bold text-ink-800">
                        <span className="truncate">{author}</span>
                        <span className="shrink-0 text-amber-500">★ {rev.rating || 5}</span>
                      </div>
                      <p className="italic leading-relaxed text-ink-700">&quot;{text.slice(0, 140)}{text.length > 140 ? '...' : ''}&quot;</p>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`w-full rounded-xl py-2.5 text-xs font-bold transition-all active:scale-[0.98] ${
              isPending ? 'bg-cat-food/15 text-cat-food' : 'bg-cat-food text-white hover:brightness-110'
            }`}
          >
            {isPending ? 'Added to plan' : `Add to plan · ${costLabel} for 2 · ${walkTime} min walk`}
          </button>
        </div>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          images={allPhotos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          title={suggestion.name}
        />
      )}
    </div>
  );
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-paper-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className={`flex min-h-[36px] w-full items-center justify-between px-3 py-1.5 text-left ${FOCUS_RING_CLASS}`}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-700">{title}</span>
        <ChevronDown size={13} className={`text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-line p-2.5 pt-2">{children}</div>}
    </div>
  );
}
