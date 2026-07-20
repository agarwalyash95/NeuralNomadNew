import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, Utensils, GitCompareArrows } from 'lucide-react';
import type { MealRecommendation } from './services/mealRecommendationEngine';
import { getFoodFirstPhotos, isOpenNow } from './services/mealPresentation';
import { TripContext } from '../../types';

interface RestaurantSuggestionCardProps {
  recommendation: MealRecommendation;
  isPending: boolean;
  onSelect: () => void;
  onAdd: () => void;
  tripContext: TripContext;
  /** Phase 2b (docs/planner-north-star-audit-and-vision.md) — pin state for
   *  RestaurantCompareTray. Optional so this card still works anywhere pin
   *  tracking doesn't apply. */
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export default function RestaurantSuggestionCard({
  recommendation, isPending, onSelect, onAdd, isPinned, onTogglePin,
}: RestaurantSuggestionCardProps) {
  const { suggestion, walkTimeMins } = recommendation;
  const photo = getFoodFirstPhotos(suggestion)[0];

  // Phase 2d (docs/planner-north-star-audit-and-vision.md) — up to 2 real
  // facts instead of 1 (walk-time/price/rating), plus a real open-now
  // signal reused from the same isOpenNow helper the detail panel already
  // computes, so choosing doesn't require opening every card first.
  const openStatus = useMemo(() => isOpenNow(suggestion.details?.opening_hours), [suggestion.details?.opening_hours]);
  const factChips = useMemo(() => {
    const chips: string[] = [];
    if (walkTimeMins != null) chips.push(`${walkTimeMins} min walk`);
    if (suggestion.price_label) chips.push(suggestion.price_label);
    else if (suggestion.rating != null) chips.push(`${suggestion.rating.toFixed(1)}★`);
    if (openStatus !== 'unknown') chips.push(openStatus === 'open' ? 'Open now' : 'Closed now');
    return chips.slice(0, 2);
  }, [walkTimeMins, suggestion.price_label, suggestion.rating, openStatus]);

  return (
    <div
      onClick={onSelect}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line-strong/40 bg-paper-2 shadow-surface hover:border-cat-food/30 hover:shadow-hover hover:scale-[1.005] cursor-pointer transition-all duration-300"
      style={{ minHeight: '190px' }}
    >
      {/* Cinematic Wide Image */}
      <div className="relative h-36 w-full overflow-hidden bg-paper-1 shrink-0">
        {photo ? (
          <motion.img
            layoutId={`place-photo-${suggestion.id}`}
            src={photo}
            alt={suggestion.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-cat-food/10">
            <Utensils size={24} className="text-cat-food/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>

      {/* Card Info Content */}
      <div className="flex flex-1 flex-col p-3.5 select-none justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-bold tracking-tight text-ink-900 leading-snug">
            {suggestion.name}
          </h3>
          {(suggestion.subtitle || suggestion.address) && (
            <p className="mt-0.5 text-[11.5px] font-medium text-ink-500 line-clamp-1">
              {suggestion.subtitle || suggestion.address}
            </p>
          )}
        </div>

        {/* Fact chips and Button Row */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          {factChips.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {factChips.map((chip) => (
                <span
                  key={chip}
                  className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                    chip === 'Closed now'
                      ? 'text-rose-600 bg-rose-50 border-rose-200'
                      : chip === 'Open now'
                        ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                        : 'text-cat-food bg-cat-food/10 border-cat-food/15'
                  }`}
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1.5">
            {onTogglePin && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
                className={`flex h-7 w-7 items-center justify-center rounded-full shadow-xs transition-all duration-200 cursor-pointer ${
                  isPinned
                    ? 'bg-cat-food/15 text-cat-food border border-cat-food/40'
                    : 'bg-paper-1 hover:bg-line/40 text-ink-500 border border-line hover:scale-105'
                }`}
                title={isPinned ? 'Remove from comparison' : 'Add to comparison'}
                aria-pressed={isPinned}
              >
                <GitCompareArrows size={13} strokeWidth={2.5} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className={`flex h-7 w-7 items-center justify-center rounded-full shadow-xs transition-all duration-200 cursor-pointer ${
                isPending
                  ? 'bg-cat-food text-white shadow-sm shadow-cat-food/25'
                  : 'bg-paper-1 hover:bg-line/40 text-ink-700 border border-line hover:scale-105'
              }`}
              title={isPending ? 'Added' : 'Add to plan'}
            >
              {isPending ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={3} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
