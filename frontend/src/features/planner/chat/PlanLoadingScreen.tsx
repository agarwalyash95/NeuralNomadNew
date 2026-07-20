'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, Loader2, Sparkles, MapPin, Calendar, Users, Wallet, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GenerationJobStatus } from '@/services/planner.types';

export interface PlanLoadingScreenProps {
  onComplete?: () => void;
  onRetry?: () => void;
  destination?: string;
  durationDays?: number;
  travelersCount?: number;
  budgetText?: string;
  /** Real pipeline state polled from GET plan/status/ — nothing simulated */
  job?: GenerationJobStatus | null;
  /** If true, renders without the fixed full-screen overlay */
  inline?: boolean;
}

const PHASE_ICONS: Record<string, string> = {
  understanding: '📋',
  selecting_cities: '🗺️',
  finding_places: '📍',
  composing: '🗓️',
  routing: '🚗',
  pricing: '💰',
  finalizing: '✨',
};

export default function PlanLoadingScreen({
  onComplete,
  onRetry,
  destination,
  durationDays,
  travelersCount,
  budgetText,
  job,
  inline = false,
}: PlanLoadingScreenProps) {
  const completedRef = useRef(false);

  const status = job?.status ?? 'queued';
  const progress = status === 'done' ? 100 : (job?.progress ?? 0);
  const phases = job?.phases ?? [];

  const isDegraded = status === 'done' && !!job?.degraded;

  // When the backend reports done, hold 100% briefly, then hand off. A
  // degraded (fallback) plan holds a bit longer so the honest note below is
  // actually readable, not just flashed.
  useEffect(() => {
    if (status !== 'done' || completedRef.current) return undefined;
    completedRef.current = true;
    const timer = setTimeout(() => onComplete?.(), isDegraded ? 1800 : 700);
    return () => clearTimeout(timer);
  }, [status, isDegraded, onComplete]);

  // Extract destination text — returns undefined when unknown (chip is hidden)
  const formatDestination = (dest: any): string | undefined => {
    if (!dest) return undefined;
    if (typeof dest === 'string') return dest;
    if (typeof dest === 'object') {
      return dest.name || dest.city_name || dest.destination_city || dest.destination_text || undefined;
    }
    return String(dest);
  };
  const destFull = formatDestination(destination);

  const isFailed = status === 'failed';
  const needsInput = status === 'needs_input';

  const containerClasses = inline
    ? "relative flex flex-col items-center justify-center p-4 text-slate-900 overflow-hidden rounded-2xl bg-paper-1 border border-line"
    : "fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#faf9f6] p-4 sm:p-6 text-slate-900 select-none overflow-hidden";

  const cardClasses = inline
    ? "w-full rounded-2xl bg-white/70 p-4 shadow-sm backdrop-blur-md"
    : "w-full rounded-[32px] border border-white/50 bg-white/70 p-6 sm:p-8 shadow-[0_30px_100px_-20px_rgba(79,70,229,0.12)] backdrop-blur-2xl";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={containerClasses}
    >
      {/* ── Floating Glow Blobs (ambient background) ── */}
      {!inline && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-100/40 rounded-full blur-[120px] motion-safe:animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-100/40 rounded-full blur-[120px] motion-safe:animate-pulse" style={{ animationDuration: '10s' }} />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-center max-w-lg w-full">
        {/* Brand Badge */}
        {!inline && (
          <div className="mb-6 flex items-center gap-2 rounded-xl bg-white/80 px-4 py-1.5 shadow-sm border border-slate-200/70 backdrop-blur-md">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black text-xs">
              N
            </div>
            <span className="text-sm font-bold text-slate-800 tracking-tight">NeuralNomad</span>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cardClasses}
        >
          <div className="mx-auto mb-4 flex items-center justify-center gap-2 rounded-full bg-indigo-50 px-3.5 py-1 border border-indigo-100/40 w-fit">
            <Sparkles size={13} className="text-indigo-600 motion-safe:animate-pulse" />
            <span className="text-[10px] font-bold text-indigo-700 tracking-wider uppercase">AI Planner Active</span>
          </div>

          <h1 className="text-center text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            {needsInput ? 'A Choice Is Needed' : isFailed ? 'Plan Generation Hit a Snag' : 'Crafting Your Travel Plan'}
          </h1>

          {/* Meta chips — only facts we actually know */}
          {(destFull || durationDays || travelersCount || budgetText) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-slate-50/50 p-3 border border-slate-100 text-xs font-semibold text-slate-600">
              {destFull && (
                <div className="flex items-center gap-1">
                  <MapPin size={13} className="text-indigo-500" />
                  <span className="text-slate-800 font-bold">{destFull}</span>
                </div>
              )}
              {durationDays !== undefined && durationDays > 0 && (
                <div className="flex items-center gap-1">
                  <Calendar size={13} className="text-purple-500" />
                  <span>{durationDays} {durationDays === 1 ? 'Day' : 'Days'}</span>
                </div>
              )}
              {travelersCount !== undefined && travelersCount > 0 && (
                <div className="flex items-center gap-1">
                  <Users size={13} className="text-emerald-500" />
                  <span>{travelersCount} {travelersCount === 1 ? 'Traveler' : 'Travelers'}</span>
                </div>
              )}
              {budgetText && (
                <div className="flex items-center gap-1">
                  <Wallet size={13} className="text-amber-500" />
                  <span>{budgetText}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Real pipeline phases — state and detail come from the server ── */}
          <div className="mt-8 space-y-3">
            {phases.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl bg-indigo-50/30 border border-indigo-100/30 p-3">
                <Loader2 size={14} className="animate-spin text-indigo-600 shrink-0" />
                <p className="text-xs sm:text-sm font-semibold text-indigo-600">Starting generation…</p>
              </div>
            )}
            {phases.map((phase) => (
              <div
                key={phase.key}
                className={cn(
                  'flex items-start gap-4 transition-all duration-300 rounded-xl p-2',
                  phase.state === 'active' && 'bg-indigo-50/30 border border-indigo-100/30',
                  phase.state === 'failed' && 'bg-red-50/40 border border-red-100/50'
                )}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center mt-0.5">
                  {phase.state === 'done' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
                    >
                      <Check size={11} strokeWidth={3} />
                    </motion.div>
                  ) : phase.state === 'active' ? (
                    <div className="relative flex h-5 w-5 items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                      <div className="relative flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <Loader2 size={10} className="animate-spin" />
                      </div>
                    </div>
                  ) : phase.state === 'failed' ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <AlertTriangle size={11} />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-slate-200 bg-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-xs sm:text-sm font-semibold transition-colors duration-300',
                      phase.state === 'done' && 'text-slate-400 font-medium',
                      phase.state === 'active' && 'text-indigo-600 font-bold',
                      phase.state === 'failed' && 'text-red-600 font-bold',
                      phase.state === 'pending' && 'text-slate-400 font-medium'
                    )}
                  >
                    {phase.label}
                  </p>
                  {phase.detail && (
                    <p className="mt-0.5 text-[11px] font-medium text-slate-400 truncate" title={phase.detail}>
                      {phase.detail}
                    </p>
                  )}
                </div>

                <div className="text-sm opacity-80 shrink-0">{PHASE_ICONS[phase.key] ?? '•'}</div>
              </div>
            ))}
          </div>

          {/* ── Degraded notice — status is 'done' but this is the curated
              fallback plan, not the AI-composed one (Phase 0b: previously
              indistinguishable from a real success). Honest, not alarming. ── */}
          {isDegraded && (
            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-xs font-semibold text-amber-800">
                {job?.error || 'Our AI planner had trouble this time, so we built a curated starter plan instead — you can still customize everything.'}
              </p>
            </div>
          )}

          {/* ── Failure panel with retry ── */}
          {isFailed && (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50/60 p-4">
              <p className="text-xs font-semibold text-red-700">
                {job?.error || 'Generation stopped unexpectedly.'}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 active:scale-95 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>Retry Generation</span>
                </button>
              )}
            </div>
          )}

          {needsInput && (
            <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-xs font-bold text-amber-800">I preserved your trip instead of making an unsafe assumption.</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] font-medium text-amber-700">
                {(job?.blockers?.length ? job.blockers : [{ detail: job?.error || 'Review the trip inputs.' }]).map((blocker, index) => (
                  <li key={`${blocker.code || 'blocker'}-${index}`}>{blocker.detail || blocker.code}</li>
                ))}
              </ul>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="mt-3 rounded-lg bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-800"
                >
                  Return to trip questions
                </button>
              )}
            </div>
          )}

          {/* ── Progress bar — the width IS the backend progress ── */}
          {!isFailed && !needsInput && (
            <div className="mt-8 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold tracking-tight">
                <span className="text-slate-400 uppercase tracking-wider">Generation Progress</span>
                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-extrabold">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 border border-slate-200/40 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-sm transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </motion.div>

        <p className="mt-4 text-center text-xs font-semibold text-slate-400 flex items-center justify-center gap-1">
          <span>💡</span> Tip: You can customize, swap, or delete any activity once your plan is ready!
        </p>
      </div>
    </motion.div>
  );
}
