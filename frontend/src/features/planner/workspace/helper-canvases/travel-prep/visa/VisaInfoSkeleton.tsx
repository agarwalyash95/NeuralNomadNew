'use client';

import React from 'react';

/** Matches the resolved visa type card + documents card geometry. */
export default function VisaInfoSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="rounded-xl border border-line bg-paper-2 p-4">
        <div className="flex items-center gap-2">
          <div className="animate-shimmer h-[18px] w-[18px] rounded-full" />
          <div className="animate-shimmer h-3.5 w-40 rounded" />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5 rounded-lg bg-paper-1/60 p-2">
              <div className="animate-shimmer h-2.5 w-14 rounded" />
              <div className="animate-shimmer h-3 w-20 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-line bg-paper-2 p-4">
        <div className="animate-shimmer mb-2 h-3 w-32 rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-shimmer h-3 w-full rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
