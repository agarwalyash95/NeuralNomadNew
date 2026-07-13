import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, Mountain } from 'lucide-react';
import type { AttractionRecommendation } from './services/sightRecommendationEngine';
import { TripContext } from '../../types';

interface AttractionSuggestionCardProps {
  recommendation: AttractionRecommendation;
  isPending: boolean;
  onSelect: () => void;
  onAdd: () => void;
  tripContext: TripContext;
}

export default function AttractionSuggestionCard({
  recommendation, isPending, onSelect, onAdd,
}: AttractionSuggestionCardProps) {
  const { suggestion, entryFee, entryFeeIsReal, walkTimeMins } = recommendation;
  const photo = suggestion.image_url;

  // Real fact only — no invented "saves transit time" verdict.
  const factChip = useMemo(() => {
    if (walkTimeMins != null) return `${walkTimeMins} min walk`;
    if (entryFeeIsReal && entryFee.toLowerCase().includes('free')) return 'Free entry';
    if (suggestion.rating != null) return `${suggestion.rating.toFixed(1)}★`;
    return null;
  }, [walkTimeMins, entryFee, entryFeeIsReal, suggestion.rating]);

  return (
    <div
      onClick={onSelect}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line-strong/40 bg-paper-2 shadow-surface hover:border-cat-attraction/30 hover:shadow-hover hover:scale-[1.005] cursor-pointer transition-all duration-300"
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
          <div className="flex h-full w-full items-center justify-center bg-cat-attraction/10">
            <Mountain size={24} className="text-cat-attraction/40" />
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

        {/* Fact chip and Button Row */}
        <div className="mt-2.5 flex items-center justify-between">
          {factChip ? (
            <span className="inline-flex items-center text-[10px] font-bold text-cat-attraction bg-cat-attraction/10 px-2 py-0.5 rounded-md border border-cat-attraction/15">
              {factChip}
            </span>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className={`flex h-7 w-7 items-center justify-center rounded-full shadow-xs transition-all duration-200 cursor-pointer ${
              isPending 
                ? 'bg-cat-attraction text-white shadow-sm shadow-cat-attraction/25' 
                : 'bg-paper-1 hover:bg-line/40 text-ink-700 border border-line hover:scale-105'
            }`}
            title={isPending ? 'Added' : 'Add to plan'}
          >
            {isPending ? <Check size={13} strokeWidth={3} /> : <Plus size={13} strokeWidth={3} />}
          </button>
        </div>
      </div>
    </div>
  );
}
