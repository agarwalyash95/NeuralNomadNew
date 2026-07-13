'use client';

import React from 'react';

/** Matches the train/bus/cab result row's collapsed geometry — identity +
 *  route/duration line, price block right. Shared across the three
 *  reference-inventory transport canvases (they render near-identical rows). */
export default function TransportCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-paper-2 p-4 shadow-surface" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="animate-shimmer h-3.5 w-32 rounded" />
          <div className="animate-shimmer h-2.5 w-20 rounded" />
          <div className="mt-2 flex items-center gap-2">
            <div className="animate-shimmer h-3 w-10 rounded" />
            <div className="animate-shimmer h-2 w-12 rounded-full" />
            <div className="animate-shimmer h-3 w-10 rounded" />
          </div>
        </div>
        <div className="shrink-0 space-y-2 text-right">
          <div className="animate-shimmer ml-auto h-5 w-16 rounded" />
          <div className="animate-shimmer ml-auto h-6 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
