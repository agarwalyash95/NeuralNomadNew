'use client';

import React from 'react';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import type { TripViewModel } from './types';

const LABELS: Record<string, string> = {
  dates: 'trip dates',
  weather: 'weather',
  prices: 'prices',
  availability: 'availability',
  opening_status: 'opening status',
  rooms: 'rooms',
  transport_capacity: 'vehicle capacity',
  transport: 'transport',
  connectors: 'travel connectors',
  daily_density: 'daily pace',
  buffers: 'travel buffers',
  day_structure: 'day structure',
  destination: 'destination plan',
  all_days: 'daily itinerary',
};

interface PlanSyncBannerProps {
  status: NonNullable<TripViewModel['syncStatus']>;
  onReview: () => void;
  compact?: boolean;
}

export default function PlanSyncBanner({ status, onReview, compact = false }: PlanSyncBannerProps) {
  const labels = status.scopes.map((scope) => LABELS[scope] || scope.replace(/_/g, ' '));
  const visible = labels.slice(0, compact ? 2 : 4);
  const remainder = labels.length - visible.length;
  const failed = status.status === 'failed';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2.5 border px-3 ${compact ? 'py-2' : 'rounded-xl py-2.5'} ${
        failed
          ? 'border-rose-200 bg-rose-50 text-rose-900'
          : 'border-amber-200/80 bg-amber-50/80 text-amber-950'
      }`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 shadow-sm">
        {failed ? <AlertTriangle size={13} /> : <RefreshCw size={13} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold">
          {failed ? 'Some trip updates need attention' : 'Trip change saved · dependent details need review'}
        </p>
        <div className="mt-1 flex min-w-0 flex-wrap gap-1">
          {visible.map((label) => (
            <span key={label} className="rounded-full border border-current/10 bg-white/65 px-2 py-0.5 text-[9px] font-semibold capitalize">
              {label}
            </span>
          ))}
          {remainder > 0 && <span className="px-1 py-0.5 text-[9px] font-bold">+{remainder}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onReview}
        className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-ink-900 px-2.5 text-[10px] font-bold text-white transition hover:bg-ink-700 active:scale-95"
      >
        Review <ArrowRight size={11} />
      </button>
    </div>
  );
}
