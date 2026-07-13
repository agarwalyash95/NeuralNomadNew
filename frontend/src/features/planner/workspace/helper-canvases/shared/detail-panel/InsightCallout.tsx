'use client';

import React from 'react';
import { Sparkles, Info, TriangleAlert } from 'lucide-react';

interface InsightCalloutProps {
  /** Server-side enrichment judgment line (placeFacts.buildJudgmentLine). */
  judgment?: string | null;
  /** Top approved local tip — ordering (scam/safety first) happens server side. */
  tip?: { text: string; category: string } | null;
}

/**
 * Same gradient judgment box and border-t tip row as RichHoverCard, at the
 * same type scale — not a bigger "premium" reinterpretation. Renders
 * nothing when neither exists — absence is the honest default, most places
 * haven't been enriched yet.
 */
export default function InsightCallout({ judgment, tip }: InsightCalloutProps) {
  if (!judgment && !tip) return null;

  const tipIsWarning = tip != null && (tip.category === 'scam_warning' || tip.category === 'safety' || tip.category === 'after_dark');
  const TipIcon = tipIsWarning ? TriangleAlert : Info;

  return (
    <div>
      {judgment && (
        <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 px-3 py-2">
          <Sparkles size={12} className="mt-0.5 shrink-0 text-purple-500" />
          <p className="text-[11px] font-semibold leading-relaxed text-ink-900">{judgment}</p>
        </div>
      )}
      {tip && (
        <div className={`flex items-start gap-1.5 ${judgment ? 'mt-2.5 border-t border-line/70 pt-2.5' : ''}`}>
          <TipIcon size={11} className={`mt-0.5 shrink-0 ${tipIsWarning ? 'text-amber-500' : 'text-ink-400'}`} />
          <p className="text-[10.5px] font-medium leading-relaxed text-ink-700">{tip.text}</p>
        </div>
      )}
    </div>
  );
}
