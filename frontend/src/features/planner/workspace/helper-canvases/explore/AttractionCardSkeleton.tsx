'use client';

import React from 'react';

interface AttractionCardSkeletonProps {
  variant?: 'spotlight' | 'list';
}

function shimmer() {
  return 'bg-slate-200 animate-pulse rounded-lg';
}

/**
 * Loading skeleton for the attraction/activity canvas.
 * Two variants:
 *  - 'spotlight' — matches the tall landscape hero card
 *  - 'list'      — matches the compact suggestion card row
 */
export default function AttractionCardSkeleton({ variant = 'list' }: AttractionCardSkeletonProps) {
  if (variant === 'spotlight') {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-surface">
        {/* Image skeleton */}
        <div className={`h-44 w-full ${shimmer()} rounded-none`} />
        <div className="p-3.5 space-y-3">
          {/* Name + dots */}
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <div className={`h-4 w-3/4 ${shimmer()}`} />
              <div className="flex gap-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <div key={j} className={`h-1.5 w-1.5 rounded-full ${shimmer()}`} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className={`h-8 w-20 rounded-xl ${shimmer()}`} />
          </div>
          {/* Pill strip */}
          <div className="flex gap-1.5">
            {[80, 72, 64, 90].map((w, i) => (
              <div key={i} className={`h-6 rounded-full ${shimmer()}`} style={{ width: w }} />
            ))}
          </div>
          {/* Insight line */}
          <div className={`h-3 w-5/6 ${shimmer()}`} />
          <div className={`h-2.5 w-3/4 ${shimmer()}`} />
        </div>
      </div>
    );
  }

  // List variant
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-surface">
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
        <div className="flex flex-col gap-2 pl-2.5 border-l border-slate-100">
          <div className={`h-3.5 w-3.5 rounded ${shimmer()}`} />
          <div className={`h-7 w-7 rounded-lg ${shimmer()}`} />
        </div>
      </div>
    </div>
  );
}
