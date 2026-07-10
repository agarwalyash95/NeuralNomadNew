'use client';

/**
 * RichHoverCard — the "enough to decide" panel for a hovered plan block.
 * Every fact here is a reference-data field (Google-Places-backed master
 * tables): photos, rating + review count, today's hours, phone, website,
 * editorial summary. Nothing synthesized. Renders nothing when the block
 * has no place_id (pre-redesign plans) or the lookup misses.
 */

import React from 'react';
import { Star, Phone, Globe, Clock, Loader2 } from 'lucide-react';
import type { ItineraryItem } from './types';
import { usePlaceDetails } from '../hooks/usePlaceDetails';

function todaysHours(openingHours?: string[] | null): string | null {
  if (!openingHours || openingHours.length === 0) return null;
  // Google weekday descriptions start on Monday; JS getDay() starts Sunday
  const index = (new Date().getDay() + 6) % 7;
  const line = openingHours[index];
  if (!line) return null;
  return line.replace(/^[A-Za-z]+:\s*/, '');
}

export default function RichHoverCard({ item }: { item: ItineraryItem | null }) {
  const { data, isLoading } = usePlaceDetails(item);

  if (!item?.place_id) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-[18px] border border-line bg-paper-2/60 p-3">
        <Loader2 size={13} className="animate-spin text-ink-400" />
        <span className="text-[11px] font-semibold text-ink-500">Loading place details…</span>
      </div>
    );
  }
  if (!data) return null;

  const details = data.details ?? {};
  const photos = [data.image_url, ...(data.secondary_images ?? [])].filter(Boolean).slice(0, 4) as string[];
  const hours = todaysHours(details.opening_hours);

  return (
    <div className="rounded-[18px] border border-line bg-paper-2/70 p-3.5 shadow-2xs">
      {/* Photo strip */}
      {photos.length > 1 && (
        <div className="mb-3 grid grid-cols-4 gap-1.5">
          {photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${data.name} photo ${i + 1}`}
              className="h-14 w-full rounded-lg object-cover"
              loading="lazy"
            />
          ))}
        </div>
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

      {details.editorial_summary && (
        <p className="mt-2 text-[11px] font-medium leading-relaxed text-ink-700">
          {details.editorial_summary}
        </p>
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
