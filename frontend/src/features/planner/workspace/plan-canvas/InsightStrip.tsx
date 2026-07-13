'use client';

import React from 'react';
import { AlertTriangle, Info, X, Loader2 } from 'lucide-react';
import { useInsights, useDismissInsight } from '@/features/planner/hooks/usePlannerQueries';
import type { PlanInsight } from '@/services/planner.types';

interface InsightStripProps {
  workspaceId: string | null;
  /** When provided, each insight becomes clickable — used by the Trip Status
   *  Spine's attention rollup to scroll straight to what it's about. */
  onSelect?: (insight: PlanInsight) => void;
}

export default function InsightStrip({ workspaceId, onSelect }: InsightStripProps) {
  const { data: insights = [], isLoading } = useInsights(workspaceId);
  const dismissInsight = useDismissInsight(workspaceId);

  if (isLoading) return null;
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {insights.map((insight, index) => {
        const isWarning = insight.severity === 'warning';
        const Icon = isWarning ? AlertTriangle : Info;
        const busy = dismissInsight.isPending && dismissInsight.variables === insight.context_hash;

        return (
          <div
            key={`${insight.context_hash}-${index}`}
            role="status"
            aria-live="polite"
            className={`group flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[11.5px] font-medium leading-relaxed ${
              isWarning
                ? 'border-l-2 border-amber-400 bg-amber-50/70 text-amber-900'
                : 'border-l-2 border-line bg-paper-1 text-ink-700'
            }`}
            style={{ boxShadow: 'var(--shadow-surface)' }}
          >
            <Icon
              size={13}
              className={`mt-0.5 shrink-0 ${isWarning ? 'text-amber-500' : 'text-ink-400'}`}
              aria-hidden="true"
            />
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(insight)}
                className="flex-1 text-left cursor-pointer hover:underline"
                title="Show me where this is"
              >
                {insight.message}
              </button>
            ) : (
              <p className="flex-1">{insight.message}</p>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => dismissInsight.mutate(insight.context_hash)}
              aria-label="Dismiss"
              className="shrink-0 flex h-5 w-5 items-center justify-center rounded-lg text-current opacity-0 transition group-hover:opacity-60 hover:!opacity-100 hover:bg-black/5 disabled:opacity-40 cursor-pointer"
              style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
              title="Not now"
            >
              {busy
                ? <Loader2 size={11} className="animate-spin" />
                : <X size={11} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
