'use client';

import React, { useState } from 'react';
import { Expand, Images } from 'lucide-react';
import MediaLightbox from '@/features/planner/components/MediaLightbox';
import { FOCUS_RING_CLASS } from '@/lib/utils';

interface HotelPhotoGalleryProps {
  images: string[];
  title: string;
}

/**
 * Hero + swipeable strip + count, in place of the old flat 96px thumbnail
 * row. Photos aren't categorized (room/bathroom/view/pool) because the API
 * doesn't tag them by category — labeling them as such would be a guess.
 */
export default function HotelPhotoGallery({ images, title }: HotelPhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  const hero = images[0]!;
  const rest = images.slice(1);

  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setLightboxIndex(0);
        }}
        className={`group relative block h-40 w-full overflow-hidden rounded-xl ${FOCUS_RING_CLASS}`}
      >
        <img src={hero} alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        {images.length > 1 && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
            <Images size={11} /> {images.length} photos
          </span>
        )}
      </button>

      {rest.length > 0 && (
        <div className="custom-scrollbar mt-2 flex snap-x gap-2 overflow-x-auto pb-1">
          {rest.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(i + 1);
              }}
              className="group relative h-16 w-20 shrink-0 snap-start overflow-hidden rounded-lg border border-line"
            >
              <img src={img} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
                <Expand size={12} className="text-white" />
              </span>
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <MediaLightbox images={images} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} title={title} />
      )}
    </div>
  );
}
