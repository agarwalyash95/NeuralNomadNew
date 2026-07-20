import React from 'react';
import type { WidgetData } from '@/services/planner.types';
import { WIDGET_REGISTRY } from './widgetRegistry';

interface WidgetRendererProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  onConfirmAndGenerate?: () => void;
  isCompleted?: boolean;
}

function prettify(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function WidgetRenderer({ widget, onSubmit, onConfirmAndGenerate, isCompleted }: WidgetRendererProps) {
  const WidgetComponent = WIDGET_REGISTRY[widget.type];
  if (!WidgetComponent) {
    // Previously a silent `return null` — an unregistered widget type just
    // vanished with no trace. Surface it instead, so a future registry gap
    // (new backend cluster type shipped before the frontend registry) is
    // visible rather than a mysteriously missing card.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[WidgetRenderer] No component registered for widget type "${widget.type}"`, widget);
    }
    const label = (widget.data as any)?.step_label || prettify(widget.type);
    return (
      <div className="mr-auto mt-1 flex w-full max-w-[320px] items-center gap-1.5 rounded-2xl border border-dashed border-line px-3 py-2 text-[11px] font-medium text-ink-400">
        <span>{label} — unavailable in this view.</span>
      </div>
    );
  }
  return (
    <WidgetComponent
      widget={widget}
      onSubmit={onSubmit}
      onConfirmAndGenerate={onConfirmAndGenerate}
      isCompleted={isCompleted}
    />
  );
}

