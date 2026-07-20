import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';
import { localDateToISO, parseLocalISODate, todayLocalISO } from '@/lib/utils';

interface TravelDateWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

const QUICK_PICKS = [
  { label: 'This weekend', startOffset: 5, endOffset: 7 },
  { label: 'Next week', startOffset: 7, endOffset: 14 },
  { label: 'In 2 weeks', startOffset: 14, endOffset: 21 },
  { label: 'Next month', startOffset: 30, endOffset: 37 },
];

export function DateRangeWidget({ onSubmit, widget, isCompleted }: TravelDateWidgetProps) {
  const data = widget.data || {};
  const prefilledStart = (data.start_date as string) || '';
  const prefilledEnd = (data.end_date as string) || '';
  const intent = (data.intent as string) || 'full_trip';
  const isTransit = ['flight_only', 'train_only', 'bus_only', 'cab_only', 'transit_only'].includes(intent);

  const [startDate, setStartDate] = useState(prefilledStart);
  const [endDate, setEndDate] = useState(prefilledEnd);

  useEffect(() => {
    if (!isCompleted) {
      if (prefilledStart) setStartDate(prefilledStart);
      if (prefilledEnd) setEndDate(prefilledEnd);
    }
  }, [prefilledStart, prefilledEnd, isCompleted]);

  const todayStr = todayLocalISO();

  const applyQuick = (startOffset: number, endOffset: number) => {
    const s = new Date(); s.setDate(s.getDate() + startOffset);
    const e = new Date(); e.setDate(e.getDate() + endOffset);
    setStartDate(localDateToISO(s));
    setEndDate(localDateToISO(e));
  };

  const dayCount = startDate && endDate
    ? Math.round(((parseLocalISODate(endDate)?.getTime() ?? 0) - (parseLocalISODate(startDate)?.getTime() ?? 0)) / 86400000)
    : null;

  const handleConfirm = () => {
    if (!startDate || !endDate) return;
    const fmt = (d: string) => parseLocalISODate(d)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) ?? d;
    onSubmit(`${fmt(startDate)} – ${fmt(endDate)} (${dayCount} days)`, {
      field: 'travel_dates',
      value: { start_date: startDate, end_date: endDate, flexible: false },
    });
  };

  const startLabel = intent === 'hotel_only' ? 'Check-in' : isTransit ? 'Departure' : 'From';
  const endLabel = intent === 'hotel_only' ? 'Check-out' : isTransit ? 'Return' : 'To';

  const summaryNode = startDate && endDate
    ? <span className="font-semibold text-ink-800">{parseLocalISODate(startDate)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – {parseLocalISODate(endDate)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {dayCount}d</span>
    : null;

  return (
    <WidgetContainer
      header={{ icon: <Calendar size={13} />, title: 'When?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={startDate && endDate ? handleConfirm : undefined}
    >
      {/* Quick picks */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PICKS.map(qp => (
          <button
            key={qp.label}
            type="button"
            onClick={() => applyQuick(qp.startOffset, qp.endOffset)}
            className="rounded-full border border-line bg-paper-0 px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-ink-900 hover:text-ink-900 transition-colors"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Date inputs */}
      <div className="flex items-center gap-2 rounded-xl border border-line bg-paper-0 px-3 py-2 focus-within:border-ink-900 transition-colors">
        <div className="flex flex-1 flex-col">
          <span className="text-[9px] font-bold uppercase tracking-wider text-ink-400">{startLabel}</span>
          <input
            type="date"
            min={todayStr}
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border-none bg-transparent p-0 text-xs font-semibold text-ink-800 focus:outline-none cursor-pointer"
          />
        </div>
        <div className="h-5 w-px bg-line" />
        <div className="flex flex-1 flex-col">
          <span className="text-[9px] font-bold uppercase tracking-wider text-ink-400">{endLabel}</span>
          <input
            type="date"
            min={startDate || todayStr}
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border-none bg-transparent p-0 text-xs font-semibold text-ink-800 focus:outline-none cursor-pointer"
          />
        </div>
        {dayCount !== null && dayCount > 0 && (
          <span className="shrink-0 rounded-full bg-paper-1 px-2 py-0.5 text-[10px] font-bold text-ink-500">{dayCount}d</span>
        )}
      </div>
    </WidgetContainer>
  );
}
