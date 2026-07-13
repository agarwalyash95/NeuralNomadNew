'use client';

import React, { useState } from 'react';
import { Star, Repeat2, type LucideIcon } from 'lucide-react';
import MediaLightbox from '@/features/planner/components/MediaLightbox';

interface DetailHeroProps {
  photos: string[];
  badgeLabel: string;
  title: string;
  tagline?: string | null;
  rating?: number | null;
  ratingsCount?: number | null;
  /** Plan node this pick would replace — a plain chip in the info block
   *  below the photo, same as everything else here. */
  replacingLabel?: string | null;
  replacingDetail?: string | null;
  FallbackIcon: LucideIcon;
  fallbackGradientClassName: string;
  fallbackIconClassName: string;
}

/**
 * A plain, static header: one photo, a row of thumbnails if there are more,
 * then badge/title/tagline/rating as normal text underneath — the exact
 * photo-grid-then-facts shape RichHoverCard uses, just sized for a full
 * page. No sticky collapse, no crossfading between photos, no carousel
 * arrows — that scroll-linked motion read as disorienting "sliding," not
 * premium. Clicking a photo opens the lightbox; that's the only motion here.
 */
export default function DetailHero({
  photos, badgeLabel, title, tagline, rating, ratingsCount,
  replacingLabel, replacingDetail,
  FallbackIcon, fallbackGradientClassName, fallbackIconClassName,
}: DetailHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const starCount = Math.round(rating ?? 0);
  const thumbnails = photos.slice(0, 5);

  return (
    <div className="w-full shrink-0">
      <button
        type="button"
        onClick={() => photos.length > 0 && setLightboxIndex(activeIndex)}
        aria-label={photos.length > 0 ? `Open photos of ${title}` : undefined}
        className={`block h-52 w-full overflow-hidden bg-ink-900 ${photos.length > 0 ? 'cursor-zoom-in' : 'cursor-default'}`}
      >
        {photos[activeIndex] ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google Places photo URL
          <img src={photos[activeIndex]} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${fallbackGradientClassName}`}>
            <FallbackIcon size={40} className={`${fallbackIconClassName} opacity-40`} />
          </div>
        )}
      </button>

      {thumbnails.length > 1 && (
        <div className="flex gap-1.5 px-6 pt-2.5">
          {thumbnails.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`View photo ${i + 1}`}
              aria-pressed={i === activeIndex}
              className={`h-11 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg transition-opacity ${i === activeIndex ? 'opacity-100 ring-2 ring-ink-900' : 'opacity-60 hover:opacity-90'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
          {photos.length > thumbnails.length && (
            <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg bg-paper-2 text-[10.5px] font-bold text-ink-500">
              +{photos.length - thumbnails.length}
            </span>
          )}
        </div>
      )}

      <div className="px-6 pt-4">
        {replacingLabel && (
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-paper-2 px-2.5 py-1">
            <Repeat2 size={11} className="text-ink-400" />
            <p className="text-[10.5px] font-semibold text-ink-500">
              Replacing {replacingLabel}{replacingDetail ? ` · ${replacingDetail}` : ''}
            </p>
          </div>
        )}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-400">{badgeLabel}</p>
        <h2 className="mt-1 text-[21px] font-bold leading-[1.15] tracking-tight text-ink-900">{title}</h2>
        {tagline && <p className="mt-1 text-[12.5px] font-medium leading-snug text-ink-500">{tagline}</p>}
        {starCount > 0 && rating != null && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={12} className={i < starCount ? 'fill-amber-400 text-amber-400' : 'fill-line text-line'} />
              ))}
            </div>
            <span className="text-[12px] font-bold text-ink-900">{rating.toFixed(1)}</span>
            {ratingsCount != null && ratingsCount > 0 && (
              <span className="text-[11px] font-medium text-ink-400">· {ratingsCount.toLocaleString()} reviews</span>
            )}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <MediaLightbox images={photos} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} title={title} />
      )}
    </div>
  );
}
