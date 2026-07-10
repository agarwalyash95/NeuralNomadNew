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
      className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line-strong bg-white p-4 shadow-sm animate-fade-in"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Travel Dates</p>
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
          <Calendar size={10} /> Optimize Season
        </span>
      </div>

      {isTransit && (
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTripType('one_way')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              tripType === 'one_way'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            One-Way
          </button>
          <button
            type="button"
            onClick={() => setTripType('round_trip')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              tripType === 'round_trip'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
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
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            {qp.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-semibold uppercase text-slate-500">{startLabel}</label>
          <input
            type="date"
            required
            min={todayStr}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        {tripType === 'round_trip' && (
          <div className="flex-1">
            <label className="text-[10px] font-semibold uppercase text-slate-500">{endLabel}</label>
            <input
              type="date"
              required
              value={endDate}
              min={startDate || todayStr}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={tripType === 'one_way' ? !startDate : (!startDate || !endDate)}
        className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
      >
        Confirm Dates
      </button>
    </form>
  );
}
