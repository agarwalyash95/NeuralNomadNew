'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  MapPin,
  Star,
  Sparkles,
  Clock,
  Plane,
  Train,
  Bus,
  Pin,
  PinOff,
} from 'lucide-react';

import { ItineraryItem } from './types';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';
import RichHoverCard from './RichHoverCard';
import { calculateHaversineDistanceKm } from './utils/routeOptimizer';
import { parsePriceToInteger } from './utils/priceParser';
import { getCategoryStyle } from './utils/categoryStyle';
import { usePlannerHoverStore } from '@/store/planner-hover.store';

/**
 * buildComparativeReason — the "why is this a good swap" line the mandate
 * asks for, computed entirely from data already in hand (no LLM call). Picks
 * the single most persuasive real difference vs the current occupant rather
 * than listing every fact — a rating bump, then a meaningful price delta,
 * then distance, in that order; nothing shown if no difference clears a
 * reporting threshold (an honest "no reason" beats a manufactured one).
 */
function buildComparativeReason(current: ItineraryItem, candidate: ItineraryItem): string | null {
  if (candidate.rating != null && current.rating != null) {
    const delta = candidate.rating - current.rating;
    if (delta >= 0.3) return `${delta.toFixed(1)}★ higher rated`;
    if (delta <= -0.3) return `${Math.abs(delta).toFixed(1)}★ lower rated`;
  }

  const currentPrice = parsePriceToInteger(current.price);
  const candidatePrice = parsePriceToInteger(candidate.price);
  if (currentPrice > 0 && candidatePrice > 0) {
    const delta = currentPrice - candidatePrice;
    if (Math.abs(delta) >= Math.max(50, currentPrice * 0.1)) {
      return delta > 0 ? `₹${delta.toLocaleString()} cheaper` : `₹${Math.abs(delta).toLocaleString()} pricier`;
    }
  }

  if (candidate.latitude != null && candidate.longitude != null && current.latitude != null && current.longitude != null) {
    const distKm = calculateHaversineDistanceKm(candidate.latitude, candidate.longitude, current.latitude, current.longitude, candidate, current);
    if (distKm > 0.3) return `${distKm} km from ${current.title}`;
  }

  return null;
}

interface AIInsightsPanelProps {
  /** A deliberately pinned item always wins over ambient hover. */
  pinnedItem?: ItineraryItem | null;
  /** Shown when nothing is hovered or pinned (e.g. the trip's first block). */
  defaultItem?: ItineraryItem | null;
  onSwapItem?: (newItem: ItineraryItem) => void;
  /** Opens the matching Helper Canvas to search real alternatives */
  onExplore?: (item: ItineraryItem) => void;
  /** Whether `item` is pinned — survives the pointer moving elsewhere */
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export default function AIInsightsPanel({ pinnedItem, defaultItem, onSwapItem, onExplore, isPinned, onTogglePin }: AIInsightsPanelProps) {
  // Subscribed locally so hover changes only re-render this panel, never the
  // parent workspace or the timeline — see planner-hover.store.ts.
  const ambientHovered = usePlannerHoverStore((s) => s.hoveredItem);
  const item = pinnedItem || ambientHovered || defaultItem || null;

  if (!item) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-paper-1">
        <Compass size={40} className="text-slate-300 motion-safe:animate-pulse mb-3" />
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">No Item Selected</h4>
        <p className="mt-1 max-w-xs text-xs text-slate-400">Hover over any itinerary item on the left to instantly reveal smart AI insights and coordinates details.</p>
      </div>
    );
  }

  // Only real, pre-computed insights are shown — we never invent alternatives
  const cachedInsights = (item as any)?._aiInsights;

  const candidates: (ItineraryItem & { comparativeReason: string | null })[] = cachedInsights?.candidates
    ? cachedInsights.candidates.map((c: any) => {
        const candidate: ItineraryItem = {
          id: c.id || `candidate-${c.title}-${item.id}`,
          type: item.type,
          title: c.title,
          subtitle: c.subtitle || '',
          price: c.price,
          rating: c.rating,
          status: 'Pending',
          aiTip: c.aiTip,
          latitude: c.latitude,
          longitude: c.longitude,
        };
        return { ...candidate, comparativeReason: buildComparativeReason(item, candidate) };
      })
    : [];


  // Derive styles and icons based on item type. Flight/train/bus keep their
  // own distinct accents (matching TransportNode's specialized per-mode
  // scheme) — hotel/food/activity/attraction/taxi/cab come from the shared
  // categoryStyle map so the same object reads the same way on every
  // surface (this panel previously disagreed with GenericNode/SuggestionCard
  // on hotel — violet here vs indigo there — and on activity — emerald here
  // vs rose there — plus fell through to a generic gray for attraction).
  const getCategoryTheme = () => {
    switch (item.type as string) {
      case 'flight':
        return {
          icon: <Plane size={18} className="text-indigo-600" />,
          badgeBg: 'bg-indigo-50 border-indigo-100 text-indigo-700',
          gradient: 'from-indigo-50/20 to-indigo-100/10',
          cardBorder: 'border-indigo-100',
          focusColor: 'text-indigo-600',
        };
      case 'train':
        return {
          icon: <Train size={18} className="text-sky-600" />,
          badgeBg: 'bg-sky-50 border-sky-100 text-sky-700',
          gradient: 'from-sky-50/20 to-sky-100/10',
          cardBorder: 'border-sky-100',
          focusColor: 'text-sky-600',
        };
      case 'bus':
        return {
          icon: <Bus size={18} className="text-teal-600" />,
          badgeBg: 'bg-teal-50 border-teal-100 text-teal-700',
          gradient: 'from-teal-50/20 to-teal-100/10',
          cardBorder: 'border-teal-100',
          focusColor: 'text-teal-600',
        };
      case 'hotel':
      case 'food':
      case 'activity':
      case 'attraction':
      case 'taxi':
      case 'cab': {
        const style = getCategoryStyle(item.type);
        const Icon = style.icon;
        return {
          icon: <Icon size={18} className={style.text} />,
          badgeBg: `${style.bg} ${style.border} ${style.text}`,
          gradient: style.gradient,
          cardBorder: style.border,
          focusColor: style.text,
        };
      }
      default:
        return {
          icon: <Compass size={18} className="text-slate-600" />,
          badgeBg: 'bg-slate-50 border-slate-100 text-slate-700',
          gradient: 'from-slate-50/20 to-slate-100/10',
          cardBorder: 'border-slate-100',
          focusColor: 'text-slate-600',
        };
    }
  };

  const theme = getCategoryTheme();

  return (
    <div className="flex h-full w-full flex-col bg-paper-1 overflow-y-auto custom-scrollbar border-t border-line lg:border-t-0 p-4 lg:p-6 select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.22 }}
          className="flex flex-col gap-5 h-full"
        >
          {/* A. Header Section */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${theme.badgeBg}`}>
                  {theme.icon}
                  {item.type}
                </span>
                
                {item.status && (
                  <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    item.status === 'Confirmed'
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                      : 'bg-amber-50 border-amber-100 text-amber-700'
                  }`}>
                    {item.status}
                  </span>
                )}

                {onTogglePin && (
                  <button
                    type="button"
                    onClick={onTogglePin}
                    aria-pressed={isPinned}
                    title={isPinned ? 'Unpin — panel will follow hover again' : 'Pin — keep showing this item while you look elsewhere'}
                    className={`ml-auto flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      isPinned
                        ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600'
                    }`}
                  >
                    {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
                    {isPinned ? 'Pinned' : 'Pin'}
                  </button>
                )}
              </div>

              <h3 className="mt-2 text-xl lg:text-2xl font-black text-slate-900 leading-tight tracking-tight">
                {item.title}
              </h3>
              {item.subtitle && (
                <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin size={12} className="text-slate-400 shrink-0" />
                  {item.subtitle}
                </p>
              )}
            </div>

            {item.price && (
              <div className="flex flex-col items-end shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                  {item.cost?.provenance?.tier === 'verified' ? 'Cost' : 'Est. Cost'}
                </span>
                <span className="text-lg font-black text-slate-900">{item.price}</span>
                <ProvenanceBadge provenance={item.cost?.provenance} className="mt-1" />
              </div>
            )}
          </div>

          {/* B. Large Image or Aesthetic Cover Card */}
          {item.image ? (
            <div className="relative h-36 w-full overflow-hidden rounded-[20px] border border-white/60 shadow-sm shrink-0">
              <img 
                src={item.image} 
                alt={item.title} 
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent" />
            </div>
          ) : (
            <div className={`relative h-24 w-full overflow-hidden rounded-[20px] border ${theme.cardBorder} bg-gradient-to-br ${theme.gradient} flex items-center justify-center p-4 shrink-0`}>
              <Sparkles className={`w-8 h-8 ${theme.focusColor} opacity-20`} />
            </div>
          )}

          {/* B2. Rich place facts — photos/hours/phone/website from reference data */}
          <RichHoverCard item={item} />

          {/* C. AI Insights Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Main AI Recommendation/Tip — only rendered when a real tip exists */}
            {item.aiTip && (
              <div className={`col-span-1 md:col-span-2 rounded-[18px] border p-3.5 bg-white/70 shadow-2xs backdrop-blur-xs ${theme.cardBorder}`}>
                <div className="flex items-center gap-2 text-indigo-700">
                  <Sparkles size={15} className="text-indigo-500 fill-indigo-200" />
                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-950">AI Smart Recommendation</h4>
                </div>
                <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-800 italic">
                  &quot;{item.aiTip}&quot;
                </p>
              </div>
            )}

            {/* 2. Details & Logistics — real local tips now come from
                RichHoverCard's reviewed local_tips pipeline above, not an
                invented per-category note (a Himalaya-specific "cab union"
                tip used to render on every trip regardless of destination). */}
            <div className="col-span-1 md:col-span-2 rounded-[18px] border border-slate-200/80 p-3 bg-white/60 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-slate-800">
                  <Clock size={15} className="text-slate-500" />
                  <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-800">Logistics</h4>
                </div>
                
                <div className="mt-1.5 flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                  {item.startTime && (
                    <p className="flex justify-between">
                      <span className="text-slate-400">Timings:</span> 
                      <span className="text-slate-800">{item.startTime} {item.endTime ? `to ${item.endTime}` : ''}</span>
                    </p>
                  )}
                  {item.details && (
                    <p className="mt-1 border-t border-slate-100 pt-1 leading-normal text-slate-500 font-medium">
                      {item.details}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* D. Alternatives — real cached candidates, or an honest path to search */}
          <div className="mt-1 flex flex-col gap-2 border-t border-slate-200/80 pt-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-800">
                <Sparkles size={13} className="text-blue-600" />
                Alternatives
              </span>
              {candidates.length > 0 && (
                <span className="text-[10px] font-semibold text-slate-400">1-Click Swap</span>
              )}
            </div>

            {candidates.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {candidates.map((cand) => (
                  <div
                    key={cand.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs transition-all hover:border-blue-300 hover:shadow-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-bold text-slate-900 truncate">{cand.title}</h5>
                        {cand.rating && (
                          <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-700">
                            <Star size={10} className="fill-amber-400 text-amber-400" /> {cand.rating}
                          </span>
                        )}
                      </div>
                      {cand.comparativeReason && (
                        <p className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 truncate">
                          <Sparkles size={9} className="shrink-0" />
                          {cand.comparativeReason}
                        </p>
                      )}
                      {cand.aiTip && <p className="text-[10px] text-slate-500 truncate">{cand.aiTip}</p>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {cand.price && <span className="text-xs font-black text-slate-800">{cand.price}</span>}
                      <button
                        onClick={() => onSwapItem?.(cand)}
                        className="rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-blue-700 transition-colors cursor-pointer"
                      >
                        Swap
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-slate-300 bg-white/50 p-3">
                <p className="text-[11px] font-medium leading-relaxed text-slate-500">
                  I don&apos;t have verified alternatives for this yet. Want me to search
                  real options nearby?
                </p>
                <button
                  onClick={() => onExplore?.(item)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs transition-colors hover:bg-blue-700 cursor-pointer"
                >
                  Search real alternatives
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
