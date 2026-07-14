'use client';

/**
 * ActivityFeed — the "since you last looked" ambient insight stream (T2.5).
 *
 * PlanProposals already have a dedicated, prominent accept/reject surface
 * (ProposalCard, bottom-left) — this doesn't duplicate that. PlanInsights
 * (walk-load, schedule gaps, opening-hours conflicts) previously had no
 * glanceable, trip-wide surface — only a per-focused-day view inside
 * AIInsightsPanel. This is that missing surface: a collapsed pill that
 * expands into every currently-active advisory insight across the whole
 * trip, each dismissible. Real data only — insights come straight from
 * PlanInsightEngine via useInsights, never fabricated.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, AlertTriangle, Info } from 'lucide-react';
import { useInsights, useDismissInsight } from '@/features/planner/hooks/usePlannerQueries';
import { cn } from '@/lib/utils';

interface ActivityFeedProps {
  workspaceId: string;
}

export function ActivityFeed({ workspaceId }: ActivityFeedProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: insights = [] } = useInsights(workspaceId);
  const dismissInsight = useDismissInsight(workspaceId);

  if (insights.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            className="max-h-[60vh] w-[340px] overflow-y-auto rounded-2xl border border-line bg-paper-1 p-3 shadow-modal"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">
                Since you last looked
              </span>
            </div>

            {insights.map((ins) => (
              <div key={ins.context_hash} className="mb-2 rounded-xl border border-line/60 bg-paper-2 p-3">
                <div className="flex items-start gap-2">
                  {ins.severity === 'warning' ? (
                    <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                  ) : (
                    <Info size={13} className="mt-0.5 shrink-0 text-blue-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    {ins.day_number != null && (
                      <p className="text-[9px] font-bold uppercase tracking-wide text-ink-400">
                        Day {ins.day_number}
                      </p>
                    )}
                    <p className="mt-0.5 text-[12px] font-medium text-ink-700">{ins.message}</p>
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => dismissInsight.mutate(ins.context_hash)}
                    className="rounded-lg border border-line px-2 py-1 text-[10px] font-bold text-ink-500 hover:bg-paper-0"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 rounded-full border border-line bg-paper-1 px-3 py-1.5 text-[11px] font-bold text-ink-700 shadow-surface hover:bg-paper-2',
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[rgb(var(--color-ai))] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[rgb(var(--color-ai))]" />
        </span>
        {insights.length} insight{insights.length === 1 ? '' : 's'}
        {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
    </div>
  );
}
