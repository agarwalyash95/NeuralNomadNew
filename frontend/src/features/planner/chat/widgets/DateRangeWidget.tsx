import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';

interface DateRangeWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
}

export function DateRangeWidget({ onSubmit, widget }: DateRangeWidgetProps) {
  const [tripType, setTripType] = useState<'round_trip' | 'one_way'>('round_trip');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const quickPicks = [
    { label: 'Next Weekend', startOffset: 6, endOffset: 8 },
    { label: 'Next Week', startOffset: 7, endOffset: 14 },
    { label: 'In 2 Weeks', startOffset: 14, endOffset: 21 },
    { label: 'Next Month', startOffset: 30, endOffset: 37 },
  ];

  const applyQuickPick = (_label: string, startOffset: number, endOffset: number) => {
    const start = new Date();
    start.setDate(start.getDate() + startOffset);
    const end = new Date();
    end.setDate(end.getDate() + endOffset);

    const sStr = start.toISOString().split('T')[0]!;
    const eStr = end.toISOString().split('T')[0]!;
    setStartDate(sStr);
    setEndDate(eStr);
  };

  const dayCount = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) return;
    if (tripType === 'round_trip' && !endDate) return;

    const formattedStart = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedEnd = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    
    const message = tripType === 'one_way'
      ? `Travelling on ${formattedStart}.`
      : `Travelling from ${formattedStart} to ${formattedEnd} (${dayCount} days).`;

    onSubmit(message, {
      field: 'travel_dates',
      value: {
        start_date: startDate,
        end_date: tripType === 'one_way' ? startDate : endDate,
      },
    });
  };

  const intent = (widget.data?.intent as string) || 'full_trip';
  const isTransit = ['flight_only', 'train_only', 'bus_only', 'cab_only', 'transit_only'].includes(intent);

  let startLabel = 'Start Date';
  let endLabel = 'End Date';

  if (intent === 'hotel_only') {
    startLabel = 'Check-in Date';
    endLabel = 'Check-out Date';
  } else if (intent === 'car_rental') {
    startLabel = 'Pickup Date';
    endLabel = 'Return Date';
  } else if (isTransit) {
    startLabel = 'Departure Date';
    endLabel = 'Return Date';
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line-strong bg-paper-2 p-4 shadow-surface animate-fade-in"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Travel Dates</p>
        <span className="flex items-center gap-1 rounded-full bg-[rgb(var(--color-ai)/0.08)] px-2 py-0.5 text-[10px] font-bold text-[rgb(var(--color-ai))]">
          <Calendar size={10} /> Optimize Season
        </span>
      </div>

      {isTransit && (
        <div className="flex rounded-xl bg-paper-0 p-1">
          <button
            type="button"
            onClick={() => setTripType('one_way')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              tripType === 'one_way'
                ? 'bg-paper-2 text-ink-900 shadow-surface'
                : 'text-ink-500 hover:text-ink-900'
            }`}
          >
            One-Way
          </button>
          <button
            type="button"
            onClick={() => setTripType('round_trip')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              tripType === 'round_trip'
                ? 'bg-paper-2 text-ink-900 shadow-surface'
                : 'text-ink-500 hover:text-ink-900'
            }`}
          >
            Round-Trip
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {quickPicks.map((qp) => (
          <button
            key={qp.label}
            type="button"
            onClick={() => applyQuickPick(qp.label, qp.startOffset, qp.endOffset)}
            className="rounded-lg border border-line bg-paper-0 px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-[rgb(var(--color-ai)/0.4)] hover:bg-[rgb(var(--color-ai)/0.08)] hover:text-[rgb(var(--color-ai))] transition-colors"
          >
            {qp.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-semibold uppercase text-ink-500">{startLabel}</label>
          <input
            type="date"
            required
            min={todayStr}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper-0 px-3 py-2 text-sm text-ink-700 shadow-surface focus:border-[rgb(var(--color-ai))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-ai)/0.2)]"
          />
        </div>
        {tripType === 'round_trip' && (
          <div className="flex-1">
            <label className="text-[10px] font-semibold uppercase text-ink-500">{endLabel}</label>
            <input
              type="date"
              required
              value={endDate}
              min={startDate || todayStr}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-paper-0 px-3 py-2 text-sm text-ink-700 shadow-surface focus:border-[rgb(var(--color-ai))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-ai)/0.2)]"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={tripType === 'one_way' ? !startDate : (!startDate || !endDate)}
        className="mt-1 w-full rounded-xl bg-gradient-to-r from-[rgb(var(--color-ai))] to-violet-700 py-2 text-sm font-semibold text-white shadow-surface transition-all hover:opacity-90 disabled:from-line disabled:to-line disabled:text-ink-400"
      >
        Confirm Dates
      </button>
    </form>
  );
}
