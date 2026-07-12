'use client';

import React from 'react';
import { ArrowRight, X, AlertTriangle } from 'lucide-react';
import type { TripContext } from '@/features/planner/workspace/types';

interface HotelConfirmBarProps {
  newItemTitle: string;
  newItemPrice?: string;
  tripContext?: TripContext;
  /** True only when this actually overwrites an existing booked hotel. */
  isReplacing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Hotel-only fork of ReplaceConfirmBar (left untouched — it's shared by
 * every other booking canvas). A routine "add to an empty day" no longer
 * wears the same amber warning as an actual overwrite of something already
 * booked; the caution styling now means what it says.
 */
export default function HotelConfirmBar({ newItemTitle, newItemPrice, tripContext, isReplacing, onCancel, onConfirm }: HotelConfirmBarProps) {
  return (
    <div className={`sticky bottom-0 z-30 border-t px-4 py-3 shadow-modal ${isReplacing ? 'border-amber-200 bg-amber-50' : 'border-line bg-paper-1'}`}>
      <div className="mb-2 flex items-start gap-2">
        {isReplacing && <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />}
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold ${isReplacing ? 'text-amber-900' : 'text-ink-800'}`}>
            {isReplacing
              ? `Replace "${tripContext?.activeNodeTitle}"${tripContext?.activeNodeDayLabel ? ` in ${tripContext.activeNodeDayLabel}` : ''}?`
              : 'Add this hotel to your trip?'}
          </p>
          <p className={`mt-0.5 flex items-center gap-1 text-[11px] ${isReplacing ? 'text-amber-700' : 'text-ink-500'}`}>
            <span className="truncate font-medium">{newItemTitle}</span>
            {newItemPrice && (
              <>
                <span>·</span>
                <span>{newItemPrice}</span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[40px] flex-1 rounded-xl border border-line bg-paper-2 text-xs font-semibold text-ink-700 transition-colors hover:bg-paper-1"
        >
          <X size={12} className="mr-1 inline" /> Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`min-h-[40px] flex-1 rounded-xl text-xs font-semibold text-white transition-colors ${
            isReplacing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-cat-stay hover:brightness-110'
          }`}
        >
          {isReplacing ? 'Yes, Replace' : 'Add to trip'} <ArrowRight size={12} className="ml-1 inline" />
        </button>
      </div>
    </div>
  );
}
