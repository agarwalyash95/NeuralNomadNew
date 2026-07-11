'use client';

/**
 * RichHoverCard — the "enough to decide" panel for a hovered plan block.
 * Every fact here is a reference-data field (Google-Places-backed master
 * tables): photos, rating + review count, today's hours, phone, website,
 * editorial summary. Nothing synthesized. Renders nothing when the block
 * has no place_id (pre-redesign plans) or the lookup misses.
 */

import React, { useState } from 'react';
import { Star, Phone, Globe, Clock, Loader2, Accessibility, CreditCard, ParkingCircle, Leaf, CalendarClock, Sparkles, Info, Expand } from 'lucide-react';
import type { ItineraryItem, SuggestionDetails } from './types';
import { usePlaceDetails } from '../hooks/usePlaceDetails';
import MediaLightbox from '@/features/planner/components/MediaLightbox';

// One line, picked by decision-relevance per the fields the enrichment
// pipeline actually populates (apps.knowledge.services.enrichment) — never
// invented client-side, only ever what the LLM synthesis wrote server-side.
// Most places won't have this yet (enrichment runs as a background batch,
// popularity-ordered) — absent is the honest, expected default.
function buildJudgmentLine(insights: SuggestionDetails['insights']): string | null {
  if (!insights) return null;
  if (insights.signature_dish?.name) {
    return `Order the ${insights.signature_dish.name} — mentioned in ${insights.signature_dish.mention_count} reviews`;
  }
  if (insights.noise_profile?.text) return insights.noise_profile.text;
  if (insights.guest_fit?.tags?.length) return `Best for: ${insights.guest_fit.tags.slice(0, 3).join(', ')}`;
  if (insights.hype_calibration?.text) return insights.hype_calibration.text;
  if (insights.real_duration?.minutes) return `Typical visit: about ${Math.round(insights.real_duration.minutes / 60 * 10) / 10} hrs`;
  if (insights.vantage_point?.text) return insights.vantage_point.text;
  return null;
}

function todaysHours(openingHours?: string[] | null): string | null {
  if (!openingHours || openingHours.length === 0) return null;
  // Google weekday descriptions start on Monday; JS getDay() starts Sunday
  const index = (new Date().getDay() + 6) % 7;
  const line = openingHours[index];
  if (!line) return null;
  return line.replace(/^[A-Za-z]+:\s*/, '');
}

// The data was already fetched here — parking/payment/accessibility all live
// on `details` — it just never rendered. A sibling component (SuggestionCard)
// already had a working fact-chip pattern for exactly this; ported here
// rather than reinvented (see docs/travel-intelligence-implementation-roadmap.md §2.1).
function buildFactChips(details: SuggestionDetails) {
  const chips: { icon: React.ElementType; label: string }[] = [];
  if (details.accessibility_detail?.step_free) chips.push({ icon: Accessibility, label: 'Step-free access' });
  else if (details.wheelchair_accessible) chips.push({ icon: Accessibility, label: 'Wheelchair accessible' });
  if (details.parking_options && Object.values(details.parking_options).some(Boolean)) {
    chips.push({ icon: ParkingCircle, label: 'Parking available' });
  }
  if (details.payment_options && Object.values(details.payment_options).some(Boolean)) {
    chips.push({ icon: CreditCard, label: 'Cards accepted' });
  }
  const dietary = details.dietary_accommodations;
  if (dietary?.vegetarian && dietary.vegetarian !== 'limited') {
    chips.push({ icon: Leaf, label: `Vegetarian: ${dietary.vegetarian.replace('_', ' ')}` });
  }
  if (details.reservation_policy) {
    const label = details.reservation_policy === 'walk_in' ? 'Walk-in friendly'
      : details.reservation_policy === 'required' ? 'Reservation required' : 'Reservation recommended';
    chips.push({ icon: CalendarClock, label });
  }
  return chips;
}

function ThinDetailsNotice({ message }: { message: string }) {
  // Previously these cases rendered nothing at all — a hover that silently
  // shows no card reads as broken, not as "no data." An empty/error state
  // this component can't recover from on its own is still worth one line
  // of honest copy (see docs/travel-intelligence-implementation-roadmap.md §2.1).
  return (
    <div className="rounded-[18px] border border-dashed border-line bg-paper-2/40 p-3">
      <span className="text-[11px] font-semibold text-ink-400">{message}</span>
    </div>
  );
}

export default function RichHoverCard({ item }: { item: ItineraryItem | null }) {
  const { data, isLoading, isError } = usePlaceDetails(item);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!item?.place_id) {
    return <ThinDetailsNotice message="Basic details only — no reference match for this item." />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-[18px] border border-line bg-paper-2/60 p-3">
        <Loader2 size={13} className="animate-spin text-ink-400" />
        <span className="text-[11px] font-semibold text-ink-500">Loading place details…</span>
      </div>
    );
  }
  if (isError) {
    return <ThinDetailsNotice message="Couldn't load extra details for this item right now." />;
  }
  if (!data) return null;

  const details = data.details ?? {};
  const photos = [data.image_url, ...(data.secondary_images ?? [])].filter(Boolean).slice(0, 4) as string[];
  const hours = todaysHours(details.opening_hours);
  const factChips = buildFactChips(details);
  const judgmentLine = buildJudgmentLine(details.insights);
  // Only the top review-cleared tip surfaces here — the card is a hover
  // glance, not a safety brief. Ordering (scam/safety first) happens server
  // side in suggestions.py::_local_tips.
  const localTip = details.local_tips?.[0] ?? null;
  const lowCompleteness = photos.length === 0 && !details.editorial_summary && factChips.length === 0 && !hours;

  return (
    <div className="rounded-[18px] border border-line bg-paper-2/70 p-3.5 shadow-2xs">
      {judgmentLine && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 px-3 py-2">
          <Sparkles size={12} className="mt-0.5 shrink-0 text-purple-500" />
          <p className="text-[11px] font-semibold leading-relaxed text-ink-900">{judgmentLine}</p>
        </div>
      )}
      {/* Photo strip — click any photo to open the fullscreen gallery */}
      {photos.length > 0 && (
        <div className={`mb-3 grid gap-1.5 ${photos.length > 1 ? 'grid-cols-4' : 'grid-cols-1'}`}>
          {photos.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setLightboxIndex(i)}
              className={`group relative overflow-hidden rounded-lg cursor-pointer ${photos.length > 1 ? 'h-14 w-full' : 'h-32 w-full'}`}
            >
              <img
                src={src}
                alt={`${data.name} photo ${i + 1}`}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
                <Expand size={14} className="text-white drop-shadow" />
              </span>
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox
          images={photos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          title={data.name}
        />
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {data.rating != null && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-ink-900">
            <Star size={11} className="fill-amber-400 text-amber-400" />
            {data.rating}
            {data.ratings_count > 0 && (
              <span className="font-semibold text-ink-400">({data.ratings_count.toLocaleString()})</span>
            )}
          </span>
        )}
        {details.price_range && (
          <span className="text-[11px] font-bold text-ink-500">{details.price_range}</span>
        )}
        {hours && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-500">
            <Clock size={11} className="text-ink-400" />
            {hours}
          </span>
        )}
      </div>

      {lowCompleteness && (
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
          Limited info available
        </p>
      )}

      {details.editorial_summary && (
        <p className="mt-2 text-[11px] font-medium leading-relaxed text-ink-700">
          {details.editorial_summary}
        </p>
      )}

      {factChips.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {factChips.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1 rounded-lg border border-line bg-paper-1 px-2 py-1 text-[10px] font-bold text-ink-600"
            >
              <Icon size={10} className="text-ink-400" />
              {label}
            </span>
          ))}
        </div>
      )}

      {localTip && (
        <div className="mt-2.5 flex items-start gap-1.5 border-t border-line/70 pt-2.5">
          <Info size={11} className="mt-0.5 shrink-0 text-ink-400" />
          <p className="text-[10.5px] font-medium leading-relaxed text-ink-700">{localTip.text}</p>
        </div>
      )}

      {(details.national_phone_number || details.website_uri) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line/70 pt-2.5">
          {details.national_phone_number && (
            <a
              href={`tel:${details.national_phone_number}`}
              className="flex items-center gap-1 rounded-lg border border-line bg-paper-1 px-2 py-1 text-[10px] font-bold text-ink-700 transition hover:border-line-strong hover:bg-paper-2"
            >
              <Phone size={10} className="text-ink-400" />
              {details.national_phone_number}
            </a>
          )}
          {details.website_uri && (
            <a
              href={details.website_uri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-lg border border-line bg-paper-1 px-2 py-1 text-[10px] font-bold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50"
            >
              <Globe size={10} className="text-blue-500" />
              Website
            </a>
          )}
        </div>
      )}
    </div>
  );
}
