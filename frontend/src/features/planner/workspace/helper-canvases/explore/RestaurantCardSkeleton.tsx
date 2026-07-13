'use client';

import React from 'react';

/**
 * Matches RestaurantSuggestionCard's collapsed row geometry so the swap from
 * loading to loaded doesn't shift layout. Reuses the app's existing
 * `.animate-shimmer` token (same pattern as HotelCardSkeleton).
 */
export default function RestaurantCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper-2" aria-hidden="true">
      <div className="flex items-center gap-3 p-2.5">
        <div className="animate-shimmer h-[72px] w-[72px] shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
          <div className="animate-shimmer h-3.5 w-3/4 rounded" />
          <div className="animate-shimmer h-3 w-1/2 rounded" />
          <div className="animate-shimmer h-3 w-2/3 rounded" />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="animate-shimmer h-4 w-4 rounded-sm" />
          <div className="animate-shimmer h-7 w-7 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
