import React from 'react';
import { Check } from 'lucide-react';
import type { PlannerWorkspace } from '@/services/planner.types';

export function PlanningSummaryCard({ workspace }: { workspace: PlannerWorkspace | null }) {
  if (!workspace || !workspace.draft_state) return null;
  const draft = workspace.draft_state as any;
  const meta = (draft.metadata || {}) as any;

  // Build the summary items
  const items = [];
  if (meta.origin) items.push({ label: 'Origin', value: String(meta.origin), key: 'origin' });
  if (draft.destination_text) items.push({ label: 'Destination', value: String(draft.destination_text), key: 'destination' });
  
  if (draft.start_date && draft.end_date) {
    items.push({ label: 'Dates', value: `${draft.start_date} to ${draft.end_date}`, key: 'dates' });
  } else if (draft.start_date) {
    items.push({ label: 'Start Date', value: draft.start_date, key: 'dates' });
  }

  if (draft.adults) {
    const total = draft.adults + (draft.children || 0);
    items.push({ label: 'Travelers', value: `${total}`, key: 'travelers' });
  }

  if (meta.budget_inr) items.push({ label: 'Budget', value: `₹${meta.budget_inr.toLocaleString()}`, key: 'budget' });
  else if (draft.budget_tier) items.push({ label: 'Budget', value: draft.budget_tier, key: 'budget' });

  if (meta.preferred_mode) items.push({ label: 'Transport', value: meta.preferred_mode, key: 'transport' });
  if (meta.star_rating || meta.property_type) {
    items.push({ label: 'Stay', value: `${meta.star_rating || ''} ${meta.property_type || ''}`.trim(), key: 'stay' });
  }

  const score = meta.confidence_score || 0;
  const isReady = draft.ready_for_plan;

  if (items.length === 0) return null;

  return (
    <div className="mx-4 my-2 rounded-2xl border border-line bg-paper-1 p-3 shadow-surface animate-fade-in">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Current Trip</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {items.map(item => (
          <div key={item.key} className="flex flex-col rounded-lg bg-paper-0 p-2">
            <span className="text-[10px] uppercase text-ink-400">{item.label}</span>
            <span className="font-semibold text-ink-800 truncate">{item.value}</span>
          </div>
        ))}
      </div>
      
      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-center justify-between text-xs font-bold text-ink-700">
          <span>Planning Progress</span>
          <span>{score}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper-0">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ink-900 to-violet-700 transition-all duration-500"
            style={{ width: `${score}%` }}
          />
        </div>
        {isReady && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check size={14} /> Ready for Plan Generation
          </div>
        )}
      </div>
    </div>
  );
}
