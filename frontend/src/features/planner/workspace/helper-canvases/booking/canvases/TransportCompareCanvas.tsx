'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Plane, Train, Bus, Car, Sparkles } from 'lucide-react';
import { plannerService } from '@/services/planner.service';
import type { TransportLegComparison, TransportLegRow } from '@/services/planner.types';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';
import { LiveSearchProgress, useLiveSearchPhases, useTierEscalation } from '../../shared/LiveSearchProgress';
import TransportCardSkeleton from './TransportCardSkeleton';

const COMPARE_PHASES = [
  { key: 'search', label: 'Checking real routes' },
  { key: 'compare', label: 'Comparing durations & fares' },
  { key: 'finalize', label: 'Finalizing results' },
];

interface TransportCompareCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  /** Opens the matching single-mode booking canvas for the chosen row */
  onSelectMode: (mode: TransportLegRow['mode']) => void;
}

const MODE_ICON: Record<TransportLegRow['mode'], React.ElementType> = {
  flight: Plane, train: Train, bus: Bus, cab: Car,
};
const MODE_LABEL: Record<TransportLegRow['mode'], string> = {
  flight: 'Flight', train: 'Train', bus: 'Bus', cab: 'Cab',
};

/**
 * TransportCompareCanvas — flight/train/bus/cab compared for one inter-city
 * leg, composing real reference-route durations + live_price lookups behind
 * GET /planner/legs/compare/. A mode simply doesn't appear if no real route
 * data exists for it — never an estimated duration standing in for a real one.
 */
export default function TransportCompareCanvas({ onClose, tripContext, onSelectMode }: TransportCompareCanvasProps) {
  const [origin, setOrigin] = useState(tripContext.activeNodeSubtitle?.split(' to ')[0]?.trim() || tripContext.allCities?.[0] || '');
  const [destination, setDestination] = useState(
    tripContext.activeNodeSubtitle?.split(' to ')[1]?.trim() ||
    tripContext.allCities?.[(tripContext.allCities?.indexOf(origin) ?? -1) + 1] || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TransportLegComparison | null>(null);

  const escalated = useTierEscalation(loading);
  const { activeIndex, elapsedMs } = useLiveSearchPhases(loading && escalated, COMPARE_PHASES.length);

  const fetchComparison = async () => {
    if (!origin.trim() || !destination.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await plannerService.compareLegs(origin.trim(), destination.trim(), tripContext.activeNodeDateStr || tripContext.startDate, tripContext.travellers);
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Couldn't compare transport options right now.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComparison(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedRows = data?.rows
    ? [...data.rows].sort((a, b) => (a.duration_mins ?? Infinity) - (b.duration_mins ?? Infinity))
    : [];

  return (
    <div className="flex h-full flex-col bg-paper-1">
      <CanvasHeader
        icon={<ArrowLeftRight size={18} />}
        iconColor="bg-ink-900"
        label="Compare Transport"
        title={origin && destination ? `${origin} → ${destination}` : 'Compare modes'}
        tripContext={tripContext}
        onClose={onClose}
      />

      <div className="border-b border-line bg-paper-2 p-3">
        <div className="flex items-center gap-2">
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="From"
            className="flex-1 min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-xs text-ink-900 outline-none focus:border-line-strong"
          />
          <ArrowLeftRight size={13} className="shrink-0 text-ink-400" />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="To"
            className="flex-1 min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-xs text-ink-900 outline-none focus:border-line-strong"
          />
          <button
            onClick={fetchComparison}
            disabled={loading || !origin.trim() || !destination.trim()}
            className="shrink-0 cursor-pointer rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-ink-700 disabled:opacity-50"
          >
            Compare
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
        {loading && !escalated ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <TransportCardSkeleton key={i} />
            ))}
          </div>
        ) : loading && escalated ? (
          <LiveSearchProgress phases={COMPARE_PHASES} activeIndex={activeIndex} elapsedMs={elapsedMs} />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs font-semibold text-red-700">{error}</div>
        ) : sortedRows.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper-0 p-8 text-center">
            <p className="text-sm font-semibold text-ink-600">No scheduled routes on file for this pair yet.</p>
            <p className="mt-1 text-xs text-ink-500">Try the individual Flight/Train/Bus search instead.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data?.recommendation && (
              <div className="flex items-start gap-2 rounded-xl border p-3" style={{ borderColor: 'rgb(var(--color-ai) / 0.18)', background: 'rgb(var(--color-ai) / 0.05)' }}>
                <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: 'rgb(var(--color-ai))' }} />
                <p className="text-xs font-semibold leading-relaxed text-ink-700">{data.recommendation.reason}</p>
              </div>
            )}

            {sortedRows.map((row) => {
              const Icon = MODE_ICON[row.mode];
              const isRecommended = data?.recommendation?.mode === row.mode;
              return (
                <div
                  key={row.mode}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${isRecommended ? 'border-[rgb(var(--color-ai)/0.3)] bg-[rgb(var(--color-ai)/0.06)] shadow-surface' : 'border-line bg-paper-2 hover:border-line-strong'}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-paper-0 text-ink-700">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-ink-900">{MODE_LABEL[row.mode]}</h4>
                      {isRecommended && (
                        <span className="rounded-full bg-[rgb(var(--color-ai)/0.1)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[rgb(var(--color-ai))]">Suggested</span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-ink-500">
                      {row.duration_label || 'Duration unknown'}
                      {row.distance_km ? ` · ${row.distance_km} km` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-ink-900">{row.price_label || 'Price on request'}</p>
                    {row.provenance && <ProvenanceBadge provenance={row.provenance as any} className="mt-1" />}
                  </div>
                  <button
                    onClick={() => onSelectMode(row.mode)}
                    className="shrink-0 cursor-pointer rounded-lg bg-ink-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-ink-700"
                  >
                    Search
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
