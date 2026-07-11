'use client';

/**
 * InsightStrip — proactive, itinerary-level intelligence (PlanInsightEngine),
 * surfaced inline rather than as a floating popup. Every insight is advisory
 * until a rule sets a concrete `action`; K3's two rules (DailyWalkLoadWarning,
 * HeatExposureWarning) are advisory-only, so dismiss is the only control here
 * today — accept/apply lands with the K5 rules that carry a real diff.
 *
 * Dismissal is persisted server-side (PlanInsightDismissal), scoped to the
 * plan's current content — the roadmap explicitly calls out that without
 * this, "Not now" would just reappear on the next render.
 */

import React from 'react';
import { AlertTriangle, Info, X, Loader2 } from 'lucide-react';
import { useInsights, useDismissInsight } from '@/features/planner/hooks/usePlannerQueries';

export default function InsightStrip({ workspaceId }: { workspaceId: string | null }) {
  const { data: insights = [], isLoading } = useInsights(workspaceId);
  const dismissInsight = useDismissInsight(workspaceId);

  if (isLoading) return null; // insights never block the itinerary from rendering
  if (insights.length === 0) return null;

  return (
    <div className="mb-3 flex flex-col gap-1.5">
      {insights.map((insight) => {
        const isWarning = insight.severity === 'warning';
        const Icon = isWarning ? AlertTriangle : Info;
        const busy = dismissInsight.isPending && dismissInsight.variables === insight.context_hash;
        return (
          <div
            key={insight.context_hash}
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] font-medium ${
              isWarning
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-line bg-paper-1 text-ink-700'
            }`}
          >
            <Icon size={13} className={`mt-0.5 shrink-0 ${isWarning ? 'text-amber-500' : 'text-ink-400'}`} />
            <p className="flex-1 leading-relaxed">{insight.message}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => dismissInsight.mutate(insight.context_hash)}
              className="shrink-0 rounded-lg p-1 text-current opacity-60 transition hover:bg-black/5 hover:opacity-100 disabled:opacity-40"
              title="Not now"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
