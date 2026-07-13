'use client';

import React from 'react';

/** Matches the resolved forex vendor card geometry. */
export default function ForexVendorCardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-paper-2 shadow-surface p-4" aria-hidden="true">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="animate-shimmer h-3.5 w-28 rounded" />
          <div className="animate-shimmer h-2.5 w-20 rounded" />
          <div className="animate-shimmer h-2.5 w-16 rounded" />
        </div>
        <div className="space-y-1.5 text-right">
          <div className="animate-shimmer ml-auto h-3.5 w-14 rounded" />
          <div className="animate-shimmer ml-auto h-2.5 w-10 rounded" />
        </div>
      </div>
    </div>
  );
}
