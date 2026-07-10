'use client';

import React from 'react';
import { TripContext } from '../../types';
import { ProvenanceBadge } from '../../../components/ProvenanceBadge';

interface CurrentlyBookedCardProps {
  tripContext: TripContext;
  /** Only render when the clicked plan block matches this type (e.g. 'hotel', 'flight') */
  nodeType: string | string[];
}

/**
 * Shows what's currently on the plan for the block that was clicked, so the
 * results below read as "alternatives to this" instead of a blind search.
 * Renders nothing if no plan block triggered this canvas (e.g. opened from
 * the sidebar rather than by clicking a timeline node).
 */
export default function CurrentlyBookedCard({ tripContext, nodeType }: CurrentlyBookedCardProps) {
  const matches = Array.isArray(nodeType)
    ? tripContext.activeNodeType != null && nodeType.includes(tripContext.activeNodeType)
    : tripContext.activeNodeType === nodeType;
  if (!matches || !tripContext.activeNodeTitle) return null;

  return (
    <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Currently on your plan</p>
        <p className="truncate text-sm font-semibold text-slate-800">{tripContext.activeNodeTitle}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {tripContext.activeNodeCost?.provenance && (
          <ProvenanceBadge provenance={tripContext.activeNodeCost.provenance} />
        )}
        {tripContext.activeNodePrice && (
          <span className="text-sm font-bold text-slate-900">{tripContext.activeNodePrice}</span>
        )}
      </div>
    </div>
  );
}
