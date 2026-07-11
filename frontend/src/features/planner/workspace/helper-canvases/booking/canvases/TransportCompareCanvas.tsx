'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Plane, Train, Bus, Car, Sparkles } from 'lucide-react';
import { plannerService } from '@/services/planner.service';
import type { TransportLegComparison, TransportLegRow } from '@/services/planner.types';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import { ProvenanceBadge } from '@/features/planner/components/ProvenanceBadge';

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
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader
        icon={<ArrowLeftRight size={18} />}
        iconColor="bg-slate-800"
        label="Compare Transport"
        title={origin && destination ? `${origin} → ${destination}` : 'Compare modes'}
        tripContext={tripContext}
        onClose={onClose}
      />

      <div className="border-b border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-2">
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="From"
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-slate-400"
          />
          <ArrowLeftRight size={13} className="shrink-0 text-slate-400" />
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="To"
            className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-slate-400"
          />
          <button
            onClick={fetchComparison}
            disabled={loading || !origin.trim() || !destination.trim()}
            className="shrink-0 cursor-pointer rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            Compare
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
            <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-slate-800" />
            <p className="text-sm font-semibold text-slate-600">Comparing real routes...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs font-semibold text-red-700">{error}</div>
        ) : sortedRows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-600">No scheduled routes on file for this pair yet.</p>
            <p className="mt-1 text-xs text-slate-500">Try the individual Flight/Train/Bus search instead.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data?.recommendation && (
              <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-3">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-purple-500" />
                <p className="text-xs font-semibold leading-relaxed text-indigo-950">{data.recommendation.reason}</p>
              </div>
            )}

            {sortedRows.map((row) => {
              const Icon = MODE_ICON[row.mode];
              const isRecommended = data?.recommendation?.mode === row.mode;
              return (
                <div
                  key={row.mode}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${isRecommended ? 'border-indigo-300 bg-indigo-50/40 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-bold text-slate-900">{MODE_LABEL[row.mode]}</h4>
                      {isRecommended && (
                        <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-700">Suggested</span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500">
                      {row.duration_label || 'Duration unknown'}
                      {row.distance_km ? ` · ${row.distance_km} km` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black text-slate-900">{row.price_label || 'Price on request'}</p>
                    {row.provenance && <ProvenanceBadge provenance={row.provenance as any} className="mt-1" />}
                  </div>
                  <button
                    onClick={() => onSelectMode(row.mode)}
                    className="shrink-0 cursor-pointer rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-slate-900"
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
