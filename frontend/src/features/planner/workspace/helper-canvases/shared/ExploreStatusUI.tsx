'use client';

import React from 'react';
import { Database, Sparkles } from 'lucide-react';
import type { ExploreSource } from '@/services/reference.service';

/**
 * Small pill shown once results have loaded, naming which tier actually
 * served them. Cache/database reads are near-instant; a live Google Places
 * call took a real network round trip (up to 5s) — the traveler should be
 * able to tell the difference between "from what we already had" and
 * "just fetched live", the same trust grammar block schema v2 uses for costs.
 */
export function TierBadge({ source }: { source: ExploreSource }) {
  if (source === 'cache') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper-2 px-2 py-0.5 text-[9.5px] font-bold text-ink-500">
        <Database size={10} /> From saved results
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper-2 px-2 py-0.5 text-[9.5px] font-bold text-ink-500">
      <Sparkles size={10} /> Live from Google, just now
    </span>
  );
}

// The error card that used to live here (`ExploreErrorCard`) was promoted
// to the shared `CanvasErrorCard` (./CanvasErrorCard.tsx) so every canvas —
// not just the explore ones — renders request failures the same way. See
// design-system-spec.md §8.
