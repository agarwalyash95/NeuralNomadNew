'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LiveSearchPhase { key: string; label: string; }

/** Elapsed-time phase framing for single REST calls with no backend-reported
 *  sub-phases (unlike plan generation's polled job/status). Never claims a
 *  phase finished faster than the wall clock actually moved, and the bar
 *  caps below 100% until the parent unmounts it on resolve. */
export function useLiveSearchPhases(active: boolean, phaseCount: number, stepMs = 1400) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) { setActiveIndex(0); setElapsedMs(0); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setElapsedMs(elapsed);
      setActiveIndex(Math.min(phaseCount - 1, Math.floor(elapsed / stepMs)));
    }, 200);
    return () => clearInterval(timer);
  }, [active, phaseCount, stepMs]);

  return { activeIndex, elapsedMs };
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

export function LiveSearchProgress({ phases, activeIndex, elapsedMs }: {
  phases: LiveSearchPhase[]; activeIndex: number; elapsedMs: number;
}) {
  const progress = Math.min(92, ((activeIndex + 1) / phases.length) * 92);
  return (
    <div className="rounded-2xl border border-line bg-paper-2 p-4 shadow-surface">
      <div className="space-y-1.5">
        {phases.map((phase, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          return (
            <div key={phase.key} className={cn('flex items-center gap-2.5 rounded-lg px-1.5 py-1', state === 'active' && 'bg-paper-0/60')}>
              <div className="flex h-4 w-4 shrink-0 items-center justify-center">
                {state === 'done' ? (
                  <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check size={9} strokeWidth={3} />
                  </div>
                ) : state === 'active' ? (
                  <Loader2 size={12} className="animate-spin text-ink-600" />
                ) : (
                  <div className="h-2.5 w-2.5 rounded-full border border-line-strong" />
                )}
              </div>
              <span className={cn('text-[12px] font-semibold', state === 'active' ? 'text-ink-900' : 'text-ink-400')}>
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-paper-0">
        <div className="h-full rounded-full bg-ink-600/60 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
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
