'use client';

import React from 'react';

/** Matches SuggestionCard's expanded-panel geometry — replaces the spinner
 *  that previously stood in for a real content skeleton. */
export default function SuggestionDetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="animate-shimmer h-14 w-full rounded-lg" />
      <div className="flex gap-2">
        <div className="animate-shimmer h-24 w-32 shrink-0 rounded-lg" />
        <div className="animate-shimmer h-24 w-32 shrink-0 rounded-lg" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-shimmer h-5 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="animate-shimmer h-9 flex-1 rounded-xl" />
        <div className="animate-shimmer h-9 flex-1 rounded-xl" />
        <div className="animate-shimmer h-9 flex-1 rounded-xl" />
      </div>
    </div>
  );
}
