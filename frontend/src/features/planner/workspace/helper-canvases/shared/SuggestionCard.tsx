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
  spinner: string;
  emptyBg: string;
}> = {
  restaurant: {
    icon: Utensils,
    accentText: 'text-orange-600',
    accentBg: 'bg-orange-50',
    border: 'hover:border-orange-300',
    ring: 'border-orange-400 ring-2 ring-orange-100 shadow-md',
    chip: 'bg-orange-50 text-orange-700',
    button: 'bg-orange-500 text-white hover:bg-orange-600',
    buttonSelected: 'bg-orange-600 text-white ring-2 ring-orange-200',
    spinner: 'border-t-orange-500',
    emptyBg: 'bg-orange-50',
  },
  attraction: {
    icon: Compass,
    accentText: 'text-emerald-700',
    accentBg: 'bg-emerald-50',
    border: 'hover:border-emerald-300',
    ring: 'border-emerald-500 ring-2 ring-emerald-100 shadow-md',
    chip: 'bg-emerald-50 text-emerald-800',
    button: 'bg-emerald-600 text-white hover:bg-emerald-700',
    buttonSelected: 'bg-emerald-700 text-white ring-2 ring-emerald-200',
    spinner: 'border-t-emerald-600',
    emptyBg: 'bg-emerald-50',
  },
  activity: {
    icon: Zap,
    accentText: 'text-rose-700',
    accentBg: 'bg-rose-50',
    border: 'hover:border-rose-300',
    ring: 'border-rose-400 ring-2 ring-rose-100 shadow-md',
    chip: 'bg-rose-50 text-rose-800',
    button: 'bg-rose-500 text-white hover:bg-rose-600',
    buttonSelected: 'bg-rose-700 text-white ring-2 ring-rose-200',
    spinner: 'border-t-rose-500',
    emptyBg: 'bg-rose-50',
  },
  hotel: {
    icon: BedDouble,
    accentText: 'text-indigo-700',
    accentBg: 'bg-indigo-50',
    border: 'hover:border-indigo-300',
    ring: 'border-indigo-400 ring-2 ring-indigo-100 shadow-md',
    chip: 'bg-indigo-50 text-indigo-800',
    button: 'bg-indigo-600 text-white hover:bg-indigo-700',
    buttonSelected: 'bg-indigo-700 text-white ring-2 ring-indigo-200',
    spinner: 'border-t-indigo-600',
    emptyBg: 'bg-indigo-50',
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
    <div className={`rounded-xl border bg-white transition-all overflow-hidden ${isExpanded ? style.ring : `border-slate-200 ${style.border} hover:shadow-sm`}`}>
      {/* Collapsed header — only what matters at a glance */}
      <div
        className={`flex items-stretch gap-3 p-3 cursor-pointer ${FOCUS_RING_CLASS}`}
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        {...clickableDivProps(onToggleExpand)}
      >
        <div className="w-1/4 shrink-0 relative bg-slate-100 rounded-lg overflow-hidden min-h-[90px]">
          {suggestion.image_url ? (
            <img src={suggestion.image_url} alt={suggestion.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className={`flex items-center justify-center h-full w-full ${style.emptyBg}`}>
              <Icon size={24} className={style.accentText} />
            </div>
          )}
        </div>

        <div className="flex-1 py-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 truncate leading-tight">{suggestion.name}</h3>
          <p className={`text-[11px] font-semibold mt-0.5 uppercase tracking-wide ${style.accentText}`}>
            {suggestion.subtitle.replace(/_/g, ' ')}
          </p>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin size={11} className="text-slate-400 shrink-0" />
            <span className="truncate">{suggestion.address}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            {suggestion.rating != null && (
              <div className="flex items-center gap-0.5">
                <Star size={12} className="text-amber-400 fill-amber-400" />
                <span className="font-semibold text-slate-800 ml-0.5">{suggestion.rating}</span>
                <span className="text-slate-400">({suggestion.ratings_count})</span>
              </div>
            )}
            {suggestion.distance_km != null && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-medium">{suggestion.distance_km} km away</span>
              </>
            )}
            {suggestion.duration_label && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-medium flex items-center gap-0.5">
                  <Clock size={10} /> {suggestion.duration_label}
                </span>
              </>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            {suggestion.price_label && (
              <span className={`font-medium px-1.5 py-0.5 rounded text-[10px] ${style.chip}`}>{suggestion.price_label}</span>
            )}
            <ProvenanceBadge provenance={suggestion.cost.provenance} />
          </div>
        </div>
      </div>

      {/* Expanded — everything else, hidden until clicked */}
      {isExpanded && (
        <div className={`border-t border-slate-100 ${style.accentBg}/20 p-4 animate-in slide-in-from-top-2 fade-in duration-200`}>
          {detailsLoading ? (
            <div className="flex justify-center p-4">
              <div className={`h-6 w-6 animate-spin rounded-full border-2 border-slate-200 ${style.spinner}`} />
            </div>
          ) : (
            <div className="space-y-4">
              {d.editorial_summary && (
                <div className="bg-white p-3 rounded-lg border border-slate-100 text-xs text-slate-700 italic">
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
                      className="group relative h-24 w-32 shrink-0 snap-start overflow-hidden rounded-lg border border-slate-200 cursor-pointer"
                    >
                      <img src={img} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
                        <Expand size={14} className="text-white drop-shadow" />
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {facts.length > 0 && (
                <div className="flex flex-wrap gap-2 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                  {facts.map((fact, i) => {
                    const FactIcon = fact.icon;
                    return (
                      <span key={i} className="flex items-center gap-1.5 text-xs text-slate-700">
                        <FactIcon size={12} className={style.accentText} /> {fact.label}
                      </span>
                    );
                  })}
                </div>
              )}

              {d.opening_hours?.[0] && (
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Clock size={12} className="text-slate-400" /> {d.opening_hours[0]}
                </p>
              )}

              <div className="flex items-center gap-2">
                {d.national_phone_number && (
                  <a href={`tel:${d.national_phone_number}`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition">
                    <Phone size={14} /> Call
                  </a>
                )}
                {suggestion.latitude != null && suggestion.longitude != null && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${suggestion.latitude},${suggestion.longitude}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition">
                    <Map size={14} /> Directions
                  </a>
                )}
                {d.website_uri && (
                  <a href={d.website_uri} target="_blank" rel="noreferrer" className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${style.chip} hover:brightness-95`}>
                    <Globe size={14} /> Website
                  </a>
                )}
              </div>

              {d.reviews && d.reviews.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Top Reviews</h4>
                    <span className="text-[10px] font-medium text-slate-400">Scroll for more ({Math.min(d.reviews.length, 5)})</span>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x snap-mandatory custom-scrollbar">
                    {d.reviews.slice(0, 5).map((rev: any, i: number) => (
                      <div key={i} className="w-[82%] shrink-0 snap-start bg-white p-3 rounded-xl border border-slate-100 text-xs shadow-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-slate-900 truncate max-w-[140px]">{rev.authorAttribution?.displayName || 'Traveler'}</span>
                            <div className="flex text-amber-400 shrink-0">
                              {[...Array(5)].map((_, idx) => (
                                <Star key={idx} size={10} fill={idx < (rev.rating || 5) ? 'currentColor' : 'none'} className={idx < (rev.rating || 5) ? '' : 'text-slate-200'} />
                              ))}
                            </div>
                          </div>
                          <p className="text-slate-600 text-[11px] leading-relaxed whitespace-normal mt-1 max-h-[100px] overflow-y-auto custom-scrollbar pr-1">{rev.text?.text || rev.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect(); }}
                className={`w-full rounded-xl py-2.5 text-sm font-bold shadow transition-colors mt-2 cursor-pointer ${isPending ? style.buttonSelected : style.button}`}
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
