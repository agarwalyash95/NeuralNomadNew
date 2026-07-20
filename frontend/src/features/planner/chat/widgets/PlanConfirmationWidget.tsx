import React, { useState } from 'react';
import { Sparkles, ArrowRight, Pencil, ChevronDown, Info } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';
import { ClusterWidget } from './ClusterWidget';
import { getLocalCurrency } from './fieldOptions';

/**
 * Trip Review Card — the upgraded plan_confirmation_widget. Reads the full
 * summary the backend now builds (widget_orchestrator._build_confirmation_payload):
 * every collected field, which ones arrived by extraction rather than
 * explicit confirmation (`inferred_fields` — shown with a badge and
 * editable), an optional visa line, and a never-a-step `fine_tune` cluster
 * offered as an inline expander (rendered via the same generic ClusterWidget,
 * reusing its cluster_submit/cluster_skip contract).
 */

interface Summary {
  destination?: string;
  start_date?: string | null;
  end_date?: string | null;
  duration?: string | null;
  origin?: string | null;
  travelers?: number | null;
  children?: number;
  visit_purpose?: string | null;
  budget_tier?: string | null;
  budget_inr?: number | null;
  preferred_mode?: string | null;
  star_rating?: number | null;
  property_type?: string | null;
  interests?: string[];
  nearby_cities?: string[];
}

interface PlanConfirmationWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  onConfirmAndGenerate?: () => void;
  isCompleted?: boolean;
}

function fmtDate(d?: string | null) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return d;
  }
}

export function PlanConfirmationWidget({ onSubmit, onConfirmAndGenerate, widget, isCompleted }: PlanConfirmationWidgetProps) {
  const data = (widget.data || {}) as any;
  const summary: Summary = data.summary || { destination: data.destination, duration: data.duration };
  const inferredFields: string[] = data.inferred_fields || [];
  const fineTune = data.fine_tune as { cluster: string; fields: string[]; label: string } | undefined;
  const visaNote = data.visa_note as string | undefined;
  const { symbol: currencySymbol } = getLocalCurrency();

  const [fineTuneOpen, setFineTuneOpen] = useState(false);

  const handleEdit = (label: string) => {
    onSubmit(`Change my ${label.toLowerCase()}...`, undefined as any);
  };

  const rows: { label: string; value: string; inferredKey?: string }[] = [];
  if (summary.destination) rows.push({ label: 'Destination', value: summary.destination, inferredKey: 'Destination' });
  if (summary.start_date && summary.end_date) {
    rows.push({
      label: 'Dates',
      value: `${fmtDate(summary.start_date)} – ${fmtDate(summary.end_date)}${summary.duration ? ` (${summary.duration})` : ''}`,
      inferredKey: 'Travel dates',
    });
  }
  if (summary.origin) rows.push({ label: 'From', value: summary.origin, inferredKey: 'Departure city' });
  if (summary.travelers) {
    rows.push({
      label: 'Travelers',
      value: `${summary.travelers}${summary.children ? ` + ${summary.children} kids` : ''}`,
      inferredKey: 'Travelers',
    });
  }
  if (summary.visit_purpose) rows.push({ label: 'Purpose', value: summary.visit_purpose, inferredKey: 'Trip purpose' });
  if (summary.budget_inr || summary.budget_tier) {
    rows.push({
      label: 'Budget',
      value: summary.budget_inr
        ? `${currencySymbol}${new Intl.NumberFormat(undefined).format(summary.budget_inr)}${summary.budget_tier ? ` (${summary.budget_tier.replace('_', ' ')})` : ''}`
        : (summary.budget_tier || '').replace('_', ' '),
      inferredKey: 'Budget',
    });
  }
  if (summary.preferred_mode) {
    rows.push({ label: 'Getting there', value: summary.preferred_mode.replace(/_/g, ' '), inferredKey: 'Transport mode' });
  }
  if (summary.star_rating || summary.property_type) {
    rows.push({
      label: 'Stay',
      value: [summary.property_type, summary.star_rating ? `${summary.star_rating}★` : null].filter(Boolean).join(' · '),
      inferredKey: 'Stay preference',
    });
  }
  if (summary.interests?.length) rows.push({ label: 'Interests', value: summary.interests.join(', '), inferredKey: 'Interests' });
  if (summary.nearby_cities?.length) rows.push({ label: 'Also visiting', value: summary.nearby_cities.join(', ') });

  const summaryNode = (
    <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
      <Sparkles size={14} />
      <span>Itinerary creation in progress!</span>
    </div>
  );

  const fineTuneWidget: WidgetData | null = fineTune
    ? {
        type: 'cluster_fine_tune',
        data: {
          cluster: fineTune.cluster,
          fields: fineTune.fields,
          prefilled: {},
          defaults: {},
          recommendation: {},
          step_label: fineTune.label,
        },
      }
    : null;

  return (
    <WidgetContainer
      header={{
        icon: <Sparkles size={14} className="text-ink-900" />,
        title: 'Ready for your plan!',
        subtitle: `Everything's set for ${summary.destination || 'your trip'}.`,
      }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
    >
      <div className="flex flex-col gap-3 bg-gradient-to-r from-[rgb(var(--color-ai)/0.04)] to-violet-50 p-3 rounded-xl border border-[rgb(var(--color-ai)/0.15)]">
        <div className="flex flex-col gap-1">
          {rows.map(row => {
            const inferred = row.inferredKey ? inferredFields.includes(row.inferredKey) : false;
            return (
              <div key={row.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-ink-500">{row.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-ink-800 text-right">{row.value}</span>
                  {inferred && (
                    <span className="rounded-full bg-paper-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-400">
                      inferred
                    </span>
                  )}
                  {!isCompleted && (
                    <button
                      onClick={() => handleEdit(row.label)}
                      className="text-ink-300 hover:text-ink-600 transition-colors"
                      aria-label={`Edit ${row.label}`}
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {visaNote && (
          <div className="flex items-start gap-1.5 rounded-lg bg-paper-0 px-2.5 py-2 text-[11px] text-ink-600">
            <Info size={12} className="mt-0.5 shrink-0 text-ink-400" />
            <span>{visaNote}</span>
          </div>
        )}

        {!isCompleted && fineTuneWidget && (
          <div>
            <button
              onClick={() => setFineTuneOpen(o => !o)}
              className="flex w-full items-center justify-between rounded-lg bg-paper-0 px-2.5 py-2 text-[11px] font-semibold text-ink-500 hover:text-ink-700 transition-colors"
            >
              <span>{fineTune!.label}</span>
              <ChevronDown size={12} className={`transition-transform ${fineTuneOpen ? 'rotate-180' : ''}`} />
            </button>
            {fineTuneOpen && (
              <div className="mt-2">
                <ClusterWidget widget={fineTuneWidget} onSubmit={onSubmit} />
              </div>
            )}
          </div>
        )}

        {!isCompleted && (
          <button
            onClick={onConfirmAndGenerate}
            disabled={!onConfirmAndGenerate}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-ink-900 to-violet-600 py-3 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
          >
            Create My Travel Plan <ArrowRight size={14} />
          </button>
        )}
      </div>
    </WidgetContainer>
  );
}
