'use client';

import React from 'react';

/** Matches the flight result card's collapsed geometry — identity+price row,
 *  route timeline, chip row, split action row. */
export default function FlightCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-surface" aria-hidden="true">
      <div className="p-4 pb-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="animate-shimmer h-8 w-8 shrink-0 rounded-lg" />
            <div className="space-y-1.5">
              <div className="animate-shimmer h-3.5 w-24 rounded" />
              <div className="animate-shimmer h-2.5 w-16 rounded" />
            </div>
          </div>
          <div className="animate-shimmer h-5 w-16 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="animate-shimmer h-4 w-10 rounded" />
          <div className="animate-shimmer h-2 flex-1 rounded-full" />
          <div className="animate-shimmer h-4 w-10 rounded" />
        </div>
        <div className="mt-2.5 flex gap-1.5">
          <div className="animate-shimmer h-4 w-16 rounded-full" />
          <div className="animate-shimmer h-4 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex border-t border-line">
        <div className="animate-shimmer m-2 h-7 flex-1 rounded-lg" />
        <div className="animate-shimmer m-2 h-7 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
