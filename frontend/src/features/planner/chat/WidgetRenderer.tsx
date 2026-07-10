import React from 'react';
import type { WidgetData } from '@/services/planner.types';
import { WIDGET_REGISTRY } from './widgetRegistry';

interface WidgetRendererProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
}

export function WidgetRenderer({ widget, onSubmit }: WidgetRendererProps) {
  const WidgetComponent = WIDGET_REGISTRY[widget.type];
  if (!WidgetComponent) return null;
  return <WidgetComponent widget={widget} onSubmit={onSubmit} />;
}
