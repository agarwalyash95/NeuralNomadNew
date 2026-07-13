'use client';

import React from 'react';

function shimmer() {
  return 'animate-shimmer rounded-lg';
}

/**
 * Loading skeleton for the attraction/activity canvas — matches
 * AttractionSuggestionCard/ActivitySuggestionCard's compact row geometry.
 */
export default function AttractionCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper-2 shadow-surface">
      <div className="flex items-center gap-2.5 p-2.5">
        <div className={`h-16 w-16 shrink-0 rounded-xl ${shimmer()}`} />
        <div className="flex-1 space-y-2 py-0.5">
          <div className={`h-3.5 w-3/5 ${shimmer()}`} />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className={`h-1.5 w-1.5 rounded-full ${shimmer()}`} />
                ))}
              </div>
            ))}
          </div>
          <div className={`h-2.5 w-4/5 ${shimmer()}`} />
        </div>
        <div className="flex flex-col gap-2 pl-2.5 border-l border-line">
          <div className={`h-3.5 w-3.5 rounded ${shimmer()}`} />
          <div className={`h-7 w-7 rounded-lg ${shimmer()}`} />
        </div>
      </div>
    </div>
  );
}
