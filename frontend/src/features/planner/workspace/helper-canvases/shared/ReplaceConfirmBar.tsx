'use client';

import React from 'react';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { TripContext } from '../../types';

interface ReplaceConfirmBarProps {
  /** The newly selected item name (e.g. "The Himalayan") */
  newItemTitle: string;
  /** The item price (e.g. "₹8,500 / night") */
  newItemPrice?: string;
  /** Trip context — used to show "in Day 1" label */
  tripContext?: TripContext;
  /** Accent color for the confirm button (e.g. "bg-blue-600 hover:bg-blue-700") */
  confirmColor?: string;
  /** Confirm button copy (default "Yes, Replace") */
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Inline confirmation bar — appears after user clicks "Select" on a result.
 * Shows: what will be replaced, where (Day X), Cancel + Confirm buttons.
 * 
 * This is a sticky bar at the bottom of the canvas — NOT a modal.
 */
export default function ReplaceConfirmBar({
  newItemTitle,
  newItemPrice,
  tripContext,
  confirmColor = 'bg-blue-600 hover:bg-blue-700',
  confirmLabel = 'Yes, Replace',
  onCancel,
  onConfirm,
}: ReplaceConfirmBarProps) {
  return (
    <div className="sticky bottom-0 z-30 border-t border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
      {/* Warning row */}
      <div className="mb-2 flex items-start gap-2">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-900">
            {tripContext?.activeNodeTitle
              ? `Replace "${tripContext.activeNodeTitle}" ${tripContext.activeNodeDayLabel ? `in ${tripContext.activeNodeDayLabel}` : ''}?`
              : 'Add to your itinerary?'
            }
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700">
            <span className="font-medium truncate">{newItemTitle}</span>
            {newItemPrice && (
              <>
                <span className="text-amber-400">·</span>
                <span>{newItemPrice}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Action row */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <X size={12} className="mr-1 inline" />
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 rounded-xl py-2 text-xs font-semibold text-white transition-colors ${confirmColor}`}
        >
          {confirmLabel}
          <ArrowRight size={12} className="ml-1 inline" />
        </button>
      </div>
    </div>
  );
}
