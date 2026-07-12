'use client';

import React from 'react';

/**
 * Matches HotelCard's collapsed geometry exactly so the swap from loading
 * to loaded doesn't shift layout. Uses the app's existing (previously
 * unused, on this canvas) `.animate-shimmer` token.
 */
export default function HotelCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-surface" aria-hidden="true">
      <div className="flex items-stretch gap-3 p-3">
        <div className="animate-shimmer w-24 shrink-0 rounded-xl sm:w-28" style={{ minHeight: 84 }} />
        <div className="min-w-0 flex-1 space-y-2 py-0.5">
          <div className="flex items-center justify-between gap-2">
            <div className="animate-shimmer h-4 w-2/3 rounded" />
            <div className="animate-shimmer h-5 w-14 rounded-full" />
          </div>
          <div className="animate-shimmer h-3 w-1/2 rounded" />
          <div className="animate-shimmer h-3 w-1/3 rounded" />
          <div className="flex gap-1.5">
            <div className="animate-shimmer h-4 w-16 rounded-full" />
            <div className="animate-shimmer h-4 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <div className="animate-shimmer h-9 flex-1 rounded-lg" />
        <div className="animate-shimmer h-9 w-20 rounded-lg" />
        <div className="animate-shimmer h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}
