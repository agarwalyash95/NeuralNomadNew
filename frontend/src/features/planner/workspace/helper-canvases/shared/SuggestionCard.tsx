'use client';

import React, { useState } from 'react';
import {
  Star, MapPin, Phone, Map, Globe, Check, Clock, Users, Accessibility,
  Dog, Coffee, Utensils, Compass, Zap, BedDouble, Ticket, Dumbbell, Expand,
} from 'lucide-react';
import { Suggestion, SuggestionCategory } from '../../plan-canvas/types';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';
import MediaLightbox from '@/features/planner/components/MediaLightbox';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';
import SuggestionDetailSkeleton from './SuggestionDetailSkeleton';

/** Per-category visual identity — mirrors GenericNode's tint mapping so a
 *  suggestion card and its eventual Plan Canvas node feel like the same object. */
const CATEGORY_STYLE: Record<SuggestionCategory, {
  icon: React.ElementType;
  accentText: string;
  accentBg: string;
  border: string;
  ring: string;
  chip: string;
  button: string;
  buttonSelected: string;
  emptyBg: string;
}> = {
  restaurant: {
    icon: Utensils,
    accentText: '!text-[rgb(var(--cat-food))]',
    accentBg: 'bg-[rgb(var(--cat-food)/0.08)]',
    border: 'hover:border-[rgb(var(--cat-food)/0.4)]',
    ring: 'border-[rgb(var(--cat-food))] ring-2 ring-[rgb(var(--cat-food)/0.15)] shadow-hover',
    chip: 'bg-[rgb(var(--cat-food)/0.1)] text-[rgb(var(--cat-food))]',
    button: 'bg-[rgb(var(--cat-food))] text-white hover:brightness-95',
    buttonSelected: 'bg-[rgb(var(--cat-food))] text-white ring-2 ring-[rgb(var(--cat-food)/0.25)]',
    emptyBg: 'bg-[rgb(var(--cat-food)/0.08)]',
  },
  attraction: {
    icon: Compass,
    accentText: '!text-[rgb(var(--cat-attraction))]',
    accentBg: 'bg-[rgb(var(--cat-attraction)/0.08)]',
    border: 'hover:border-[rgb(var(--cat-attraction)/0.4)]',
    ring: 'border-[rgb(var(--cat-attraction))] ring-2 ring-[rgb(var(--cat-attraction)/0.15)] shadow-hover',
    chip: 'bg-[rgb(var(--cat-attraction)/0.1)] text-[rgb(var(--cat-attraction))]',
    button: 'bg-[rgb(var(--cat-attraction))] text-white hover:brightness-95',
    buttonSelected: 'bg-[rgb(var(--cat-attraction))] text-white ring-2 ring-[rgb(var(--cat-attraction)/0.25)]',
    emptyBg: 'bg-[rgb(var(--cat-attraction)/0.08)]',
  },
  activity: {
    icon: Zap,
    accentText: '!text-[rgb(var(--cat-activity))]',
    accentBg: 'bg-[rgb(var(--cat-activity)/0.08)]',
    border: 'hover:border-[rgb(var(--cat-activity)/0.4)]',
    ring: 'border-[rgb(var(--cat-activity))] ring-2 ring-[rgb(var(--cat-activity)/0.15)] shadow-hover',
    chip: 'bg-[rgb(var(--cat-activity)/0.1)] text-[rgb(var(--cat-activity))]',
    button: 'bg-[rgb(var(--cat-activity))] text-white hover:brightness-95',
    buttonSelected: 'bg-[rgb(var(--cat-activity))] text-white ring-2 ring-[rgb(var(--cat-activity)/0.25)]',
    emptyBg: 'bg-[rgb(var(--cat-activity)/0.08)]',
  },
  hotel: {
    icon: BedDouble,
    accentText: '!text-[rgb(var(--cat-stay))]',
    accentBg: 'bg-[rgb(var(--cat-stay)/0.08)]',
    border: 'hover:border-[rgb(var(--cat-stay)/0.4)]',
    ring: 'border-[rgb(var(--cat-stay))] ring-2 ring-[rgb(var(--cat-stay)/0.15)] shadow-hover',
    chip: 'bg-[rgb(var(--cat-stay)/0.1)] text-[rgb(var(--cat-stay))]',
    button: 'bg-[rgb(var(--cat-stay))] text-white hover:brightness-95',
    buttonSelected: 'bg-[rgb(var(--cat-stay))] text-white ring-2 ring-[rgb(var(--cat-stay)/0.25)]',
    emptyBg: 'bg-[rgb(var(--cat-stay)/0.08)]',
  },
};

/** Small on/off facts shown only in the expanded state — kept generic across
 *  categories instead of one bespoke layout per category. */
function buildFacts(s: Suggestion): { icon: React.ElementType; label: string }[] {
  const d = s.details || {};
  const facts: { icon: React.ElementType; label: string }[] = [];
  if (d.dine_in) facts.push({ icon: Utensils, label: 'Dine-in' });
  if (d.takeout) facts.push({ icon: Check, label: 'Takeout' });
  if (d.delivery) facts.push({ icon: Check, label: 'Delivery' });
  if (d.outdoor_seating) facts.push({ icon: Coffee, label: 'Outdoor Seating' });
  if (d.serves_vegetarian_food) facts.push({ icon: Check, label: 'Vegetarian Options' });
  if (d.allows_dogs) facts.push({ icon: Dog, label: 'Allows Dogs' });
  if (d.menu_for_children) facts.push({ icon: Utensils, label: 'Kids Menu' });
  if (d.good_for_children) facts.push({ icon: Check, label: 'Kid Friendly' });
  if (d.good_for_groups) facts.push({ icon: Users, label: 'Good for Groups' });
  if (d.wheelchair_accessible) facts.push({ icon: Accessibility, label: 'Accessible' });
  if (d.guided_tour) facts.push({ icon: Check, label: 'Guided Tour' });
  if (d.equipment_included) facts.push({ icon: Check, label: 'Equipment Included' });
  if (d.difficulty_level) facts.push({ icon: Dumbbell, label: `${d.difficulty_level} Difficulty` });
  if (d.price_range) facts.push({ icon: Ticket, label: d.price_range });
  return facts;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  isExpanded: boolean;
  isPending: boolean;
  detailsLoading?: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  /** Label on the select button, e.g. "Select Restaurant" */
  selectLabel: string;
}

export default function SuggestionCard({
  suggestion,
  isExpanded,
  isPending,
  detailsLoading,
  onToggleExpand,
  onSelect,
  selectLabel,
}: SuggestionCardProps) {
  const style = CATEGORY_STYLE[suggestion.category];
  const Icon = style.icon;
  const d = suggestion.details || {};
  const facts = buildFacts(suggestion);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const allPhotos = [suggestion.image_url, ...suggestion.secondary_images].filter(Boolean) as string[];

  return (
    <div className={`rounded-2xl border bg-paper-2 shadow-surface transition-all duration-[var(--motion-card)] ease-[var(--ease-out)] overflow-hidden ${isExpanded ? style.ring : `border-line ${style.border} hover:shadow-hover`}`}>
      {/* Collapsed header — only what matters at a glance */}
      <div
        className={`flex items-stretch gap-3 p-3 cursor-pointer ${FOCUS_RING_CLASS}`}
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        {...clickableDivProps(onToggleExpand)}
      >
        <div className="w-1/4 shrink-0 relative bg-paper-1 rounded-lg overflow-hidden min-h-[90px]">
          {suggestion.image_url ? (
            <img src={suggestion.image_url} alt={suggestion.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className={`flex items-center justify-center h-full w-full ${style.emptyBg}`}>
              <Icon size={24} className={style.accentText} />
            </div>
          )}
        </div>

        <div className="flex-1 py-1 min-w-0">
          <h3 className="text-title truncate leading-tight">{suggestion.name}</h3>
          <p className={`text-micro mt-0.5 ${style.accentText}`}>
            {suggestion.subtitle.replace(/_/g, ' ')}
          </p>

          <div className="mt-1.5 flex items-center gap-1.5 text-caption">
            <MapPin size={11} className="text-ink-400 shrink-0" />
            <span className="truncate">{suggestion.address}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
            {suggestion.rating != null && (
              <div className="flex items-center gap-0.5">
                <Star size={12} className="text-amber-400 fill-amber-400" />
                <span className="text-tabular text-ink-900 ml-0.5">{suggestion.rating}</span>
                <span className="text-ink-400">({suggestion.ratings_count})</span>
              </div>
            )}
            {suggestion.distance_km != null && (
              <>
                <span className="text-ink-400">•</span>
                <span className="text-ink-500 font-medium">{suggestion.distance_km} km away</span>
              </>
            )}
            {suggestion.duration_label && (
              <>
                <span className="text-ink-400">•</span>
                <span className="text-ink-500 font-medium flex items-center gap-0.5">
                  <Clock size={10} /> {suggestion.duration_label}
                </span>
              </>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            {suggestion.price_label && (
              <span className={`text-tabular px-1.5 py-0.5 rounded text-caption ${style.chip}`}>{suggestion.price_label}</span>
            )}
            <ProvenanceBadge provenance={suggestion.cost.provenance} />
          </div>
        </div>
      </div>

      {/* Expanded — everything else, hidden until clicked */}
      {isExpanded && (
        <div className={`border-t border-line ${style.accentBg} p-4 animate-in slide-in-from-top-2 fade-in duration-200`}>
          {detailsLoading ? (
            <SuggestionDetailSkeleton />
          ) : (
            <div className="space-y-4">
              {d.editorial_summary && (
                <div className="bg-paper-2 p-3 rounded-lg border border-line text-body italic">
                  &quot;{d.editorial_summary}&quot;
                </div>
              )}

              {suggestion.secondary_images.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x custom-scrollbar">
                  {suggestion.secondary_images.map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLightboxIndex(allPhotos.indexOf(img)); }}
                      className="group relative h-24 w-32 shrink-0 snap-start overflow-hidden rounded-lg border border-line cursor-pointer"
                    >
                      <img src={img} alt="" className="h-full w-full object-cover transition-transform duration-[var(--motion-card)] ease-[var(--ease-out)] group-hover:scale-105" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-[var(--motion-card)] ease-[var(--ease-out)] group-hover:bg-black/20 group-hover:opacity-100">
                        <Expand size={14} className="text-white drop-shadow" />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {facts.length > 0 && (
                <div className="flex flex-wrap gap-2 bg-paper-2 p-3 rounded-lg border border-line shadow-surface">
                  {facts.map((fact, i) => {
                    const FactIcon = fact.icon;
                    return (
                      <span key={i} className="flex items-center gap-1.5 text-body">
                        <FactIcon size={12} className={style.accentText} /> {fact.label}
                      </span>
                    );
                  })}
                </div>
              )}

              {d.opening_hours?.[0] && (
                <p className="flex items-center gap-2 text-caption">
                  <Clock size={12} className="text-ink-400" /> {d.opening_hours[0]}
                </p>
              )}

              <div className="flex items-center gap-2">
                {d.national_phone_number && (
                  <a href={`tel:${d.national_phone_number}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-paper-1 hover:bg-paper-0 text-body font-semibold text-ink-700 transition-colors duration-[var(--motion-hover)] ease-[var(--ease-out)]">
                    <Phone size={14} /> Call
                  </a>
                )}
                {suggestion.latitude != null && suggestion.longitude != null && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${suggestion.latitude},${suggestion.longitude}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-paper-1 hover:bg-paper-0 text-body font-semibold text-ink-700 transition-colors duration-[var(--motion-hover)] ease-[var(--ease-out)]">
                    <Map size={14} /> Directions
                  </a>
                )}
                {d.website_uri && (
                  <a href={d.website_uri} target="_blank" rel="noreferrer" className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-body font-semibold transition-colors duration-[var(--motion-hover)] ease-[var(--ease-out)] ${style.chip} hover:brightness-95`}>
                    <Globe size={14} /> Website
                  </a>
                )}
              </div>

              {d.reviews && d.reviews.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-micro">Top Reviews</h4>
                    <span className="text-caption text-ink-400">Scroll for more ({Math.min(d.reviews.length, 5)})</span>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory custom-scrollbar">
                    {d.reviews.slice(0, 5).map((rev: any, i: number) => (
                      <div key={i} className="w-[82%] shrink-0 snap-start bg-paper-2 p-3 rounded-xl border border-line text-body shadow-surface flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-ink-900 truncate max-w-[140px]">{rev.authorAttribution?.displayName || 'Traveler'}</span>
                            <div className="flex text-amber-400 shrink-0">
                              {[...Array(5)].map((_, idx) => (
                                <Star key={idx} size={10} fill={idx < (rev.rating || 5) ? 'currentColor' : 'none'} className={idx < (rev.rating || 5) ? '' : 'text-ink-400'} />
                              ))}
                            </div>
                          </div>
                          <p className="text-caption leading-relaxed whitespace-normal mt-1 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">{rev.text?.text || rev.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                className={`w-full rounded-xl py-2.5 text-body font-semibold shadow-surface transition-colors duration-[var(--motion-hover)] ease-[var(--ease-out)] mt-2 cursor-pointer ${isPending ? style.buttonSelected : style.button}`}
              >
                {isPending ? 'Selected' : selectLabel}
              </button>
            </div>
          )}
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
