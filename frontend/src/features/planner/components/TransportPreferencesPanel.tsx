'use client';

import React, { useEffect, useState } from 'react';
import { X, Gauge, Loader2 } from 'lucide-react';
import { useTransportPreference, useSetTransportPreference } from '@/features/planner/hooks/usePlannerQueries';
import type { TransportPreference } from '@/services/planner.types';

const PRIORITIES: { value: NonNullable<TransportPreference['priority']>; label: string }[] = [
  { value: 'cheapest', label: 'Cheapest' },
  { value: 'fastest', label: 'Fastest' },
  { value: 'comfort', label: 'Comfort' },
];

const TOGGLES: { key: keyof TransportPreference; label: string }[] = [
  { key: 'avoid_flights', label: 'Avoid flights' },
  { key: 'avoid_overnight', label: 'Avoid overnight travel' },
  { key: 'minimal_transfers', label: 'Minimize transfers' },
];

interface TransportPreferencesPanelProps {
  onClose: () => void;
}

/**
 * TransportPreferencesPanel — cross-trip (TravelerProfile-backed), not
 * per-trip. Read as the default sort/filter when booking canvases open;
 * see FlightCanvas/TrainCanvas/BusCanvas/CabCanvas for the consuming side.
 */
export default function TransportPreferencesPanel({ onClose }: TransportPreferencesPanelProps) {
  const { data: saved, isLoading } = useTransportPreference();
  const setPreference = useSetTransportPreference();
  const [draft, setDraft] = useState<TransportPreference>({});
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    await setPreference.mutateAsync(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transport-preferences-title"
        className="w-full max-w-[360px] rounded-2xl border border-line bg-paper-2 p-4 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-blue-600" />
            <h3 id="transport-preferences-title" className="text-sm font-bold text-ink-900">Transport preferences</h3>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-full p-1 text-ink-400 hover:bg-paper-1 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            <X size={16} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-ink-400" />
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">Priority</p>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, priority: d.priority === p.value ? null : p.value }))}
                    className={`flex-1 cursor-pointer rounded-lg border px-2 py-1.5 text-[11px] font-bold transition-colors ${
                      draft.priority === p.value
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-line bg-paper-1 text-ink-600 hover:bg-paper-0'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">Also prefer</p>
              <div className="flex flex-col gap-1.5">
                {TOGGLES.map((t) => (
                  <label key={t.key} className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-ink-700">
                    <input
                      type="checkbox"
                      checked={Boolean(draft[t.key])}
                      onChange={(e) => setDraft((d) => ({ ...d, [t.key]: e.target.checked }))}
                      className="h-3.5 w-3.5 accent-blue-600"
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <p className="text-[10px] font-medium leading-relaxed text-ink-400">
              Applies across every trip you plan — not just this one. Booking searches will default to these choices.
            </p>

            <button
              onClick={handleSave}
              disabled={setPreference.isPending}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-[12px] font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {setPreference.isPending && <Loader2 size={12} className="animate-spin" />}
              Save preferences
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
