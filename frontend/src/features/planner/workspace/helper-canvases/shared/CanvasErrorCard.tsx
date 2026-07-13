'use client';

import React from 'react';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';

export type CanvasErrorVariant = 'error' | 'timeout';

const VARIANT_COPY: Record<CanvasErrorVariant, { icon: typeof AlertTriangle; message: string; retryLabel: string }> = {
  error: {
    icon: AlertTriangle,
    message: "Couldn't load results — check your connection and try again.",
    retryLabel: 'Retry',
  },
  timeout: {
    icon: Clock,
    message: 'Live lookup timed out — showing what we already had on file.',
    retryLabel: 'Try live search again',
  },
};

/**
 * Distinct from the "no results" empty state — this means the request
 * itself failed, or the live tier (Places / provider search) never came
 * back, so the traveler is told that instead of silently rendering an
 * empty list that reads as "nothing exists here." Shared across every
 * canvas per design-system-spec.md §8 (formerly ExploreStatusUI's
 * `ExploreErrorCard`, promoted here so Flight/Hotel/Train/Bus/Cab/Visa/
 * Forex/Attractions/Restaurants all render failures the same way).
 */
export function CanvasErrorCard({
  variant = 'error',
  message,
  onRetry,
}: {
  variant?: CanvasErrorVariant;
  message?: string;
  onRetry?: () => void;
}) {
  const copy = VARIANT_COPY[variant];
  const Icon = copy.icon;
  return (
    <div className="mx-4 mt-4 flex flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-center shadow-surface">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
        <Icon size={16} />
      </div>
      <p className="text-[12.5px] font-semibold text-ink-700">{message ?? copy.message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3.5 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-amber-700"
        >
          <RefreshCw size={12} /> {copy.retryLabel}
        </button>
      )}
    </div>
  );
}

/**
 * A request that got no response at all (network drop, hung connection)
 * reads as 'timeout' — anything the server actually responded to (4xx/5xx)
 * is a real 'error'. Mirrors apiClient's ApiError.code (services/api.ts).
 */
export function classifyFetchErrorVariant(err: any): CanvasErrorVariant {
  return err?.code === 'NO_RESPONSE' ? 'timeout' : 'error';
}
