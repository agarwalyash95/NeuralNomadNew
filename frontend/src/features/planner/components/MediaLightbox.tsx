'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaLightboxProps {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  title?: string;
  /** Real per-photo attribution when the API supplies it. Falls back to a
   *  generic "Photos via Google" credit rather than inventing a photographer
   *  name we don't have — Places photos require attribution either way. */
  attribution?: string;
}

export default function MediaLightbox({ images, index, onClose, onIndexChange, title, attribution }: MediaLightboxProps) {
  const touchStartX = useRef<number | null>(null);

  const goPrev = useCallback(
    () => onIndexChange((index - 1 + images.length) % images.length),
    [index, images.length, onIndexChange]
  );
  const goNext = useCallback(
    () => onIndexChange((index + 1) % images.length),
    [index, images.length, onIndexChange]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, goPrev, goNext]);

  if (typeof document === 'undefined' || images.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm motion-reduce:backdrop-blur-none"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Image viewer'}
      onClick={onClose}
      onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        if (Math.abs(delta) > 50) (delta > 0 ? goPrev() : goNext());
        touchStartX.current = null;
      }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors cursor-pointer"
        aria-label="Close image viewer"
      >
        <X size={22} />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors cursor-pointer sm:left-4"
            aria-label="Previous image"
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors cursor-pointer sm:right-4"
            aria-label="Next image"
          >
            <ChevronRight size={26} />
          </button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element -- full-size lightbox image, not a next/image candidate (external, unoptimized) */}
      <img
        src={images[index]}
        alt={title ? `${title} — photo ${index + 1} of ${images.length}` : `Photo ${index + 1} of ${images.length}`}
        className="max-h-[78vh] max-w-[92vw] select-none rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      <div className="mt-3 flex flex-col items-center gap-1 px-4 text-center" onClick={(e) => e.stopPropagation()}>
        {title && <p className="text-sm font-semibold text-white">{title}</p>}
        <div className="flex items-center gap-2 text-[11px] text-white/60">
          {images.length > 1 && <span>{index + 1} / {images.length}</span>}
          <span>{attribution || 'Photos via Google'}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
