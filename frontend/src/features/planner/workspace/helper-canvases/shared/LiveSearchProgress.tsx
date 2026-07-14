'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

export interface LiveSearchPhase { key: string; label: string; }

/**
 * Tracks only real, observable state: whether the call is still active and
 * how long it's been running. Does NOT claim any specific sub-phase is
 * "done" — a single REST call with no backend-reported sub-phases has no
 * real signal for that, and claiming one anyway (advancing a phase index on
 * a timer) is exactly the "live" theater the product manifesto forbids
 * (real-time info must always be truthful). elapsedMs is used only for the
 * honest ">8s, still working" note below, never to fabricate progress.
 */
export function useLiveSearchPhases(active: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) { setElapsedMs(0); return; }
    const start = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - start), 200);
    return () => clearInterval(timer);
  }, [active]);

  return { elapsedMs };
}

/** Stay on the Tier-2 skeleton until a call has run long enough that a
 *  static skeleton would start to feel stalled — separates a ~<300ms cache
 *  hit from a multi-second live call without needing a backend signal. */
export function useTierEscalation(active: boolean, escalateAfterMs = 600) {
  const [escalated, setEscalated] = useState(false);
  useEffect(() => {
    if (!active) { setEscalated(false); return; }
    const timer = setTimeout(() => setEscalated(true), escalateAfterMs);
    return () => clearTimeout(timer);
  }, [active, escalateAfterMs]);
  return escalated;
}

const TIMEOUT_MS = 8000;

/**
 * Honest loading state for a single REST call: what we're looking for
 * (the phase labels, shown as a static list of what this search covers —
 * not a completion sequence) plus one real signal, elapsed time. No phase
 * is ever marked "done" or "active" ahead of the others, because we have no
 * backend signal to justify that claim.
 */
export function LiveSearchProgress({ phases, elapsedMs }: {
  phases: LiveSearchPhase[]; elapsedMs: number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper-2 p-4 shadow-surface">
      <div className="space-y-1.5">
        {phases.map((phase) => (
          <div key={phase.key} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
            <div className="flex h-4 w-4 shrink-0 items-center justify-center">
              <Loader2 size={12} className="animate-spin text-ink-600" />
            </div>
            <span className="text-[12px] font-semibold text-ink-700">{phase.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-paper-0">
        <div className="h-full w-full rounded-full bg-ink-600/60 animate-pulse" />
      </div>
      {elapsedMs > TIMEOUT_MS && (
        <p className="mt-2 text-[11px] font-semibold text-amber-600">Taking longer than usual — still working…</p>
      )}
    </div>
  );
}

/** Resolved badge for surfaces with no cache layer — asserts only the one
 *  honest fact available (this was a live call), never a fabricated
 *  cache-vs-live distinction the backend doesn't report. */
export function LiveResultsBadge({ label = 'Live results, just now' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper-2 px-2 py-0.5 text-[9.5px] font-bold text-ink-500">
      <Sparkles size={10} /> {label}
    </span>
  );
}
