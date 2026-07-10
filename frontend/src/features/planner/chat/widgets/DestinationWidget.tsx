import React, { useState } from 'react';
import { Search, MapPin, Sparkles } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';

const POPULAR_DESTINATIONS = [
  'Paris', 'Tokyo', 'Bali', 'Dubai', 'New York', 'Singapore',
  'London', 'Rome', 'Bangkok', 'Goa',
];

interface DestinationWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
}

export function DestinationWidget({ onSubmit, widget }: DestinationWidgetProps) {
  const [city, setCity] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const intent = (widget?.data?.intent as string) || 'full_trip';

  let title = 'Select Destination';
  let placeholder = 'e.g. Paris, Tokyo, Bali...';
  let messagePrefix = 'I want to go to';

  if (intent === 'flight_only') {
    title = 'Arrival Airport / City';
    placeholder = 'e.g. Mumbai, London, Dubai...';
    messagePrefix = 'Book a flight to';
  } else if (intent === 'train_only') {
    title = 'Destination Station / City';
    placeholder = 'e.g. Delhi, Mumbai, Patna...';
    messagePrefix = 'Book a train to';
  } else if (intent === 'bus_only') {
    title = 'Bus Destination';
    placeholder = 'e.g. Manali, Shimla, Jaipur...';
    messagePrefix = 'Book a bus to';
  } else if (intent === 'cab_only') {
    title = 'Drop Location';
    placeholder = 'e.g. Airport, Hotel, City...';
    messagePrefix = 'Book a cab to';
  } else if (intent === 'hotel_only') {
    title = 'Hotel / Stay Location';
    placeholder = 'e.g. Goa, Paris, Maldives...';
    messagePrefix = 'Find hotels in';
  }

  const filtered = city.trim().length > 0
    ? POPULAR_DESTINATIONS.filter(d => d.toLowerCase().startsWith(city.toLowerCase()))
    : [];

  const handleSelect = (e?: React.FormEvent, selectedCity?: string) => {
    e?.preventDefault();
    const dest = selectedCity ?? city.trim();
    if (!dest) return;
    setShowSuggestions(false);
    onSubmit(`${messagePrefix} ${dest}`, {
      field: 'destination',
      value: { name: dest },
    });
  };

  return (
    <form
      onSubmit={handleSelect}
      className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-line-strong bg-white p-3 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
          <Sparkles size={10} /> AI Analyzing
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          autoFocus
          value={city}
          onChange={(e) => { setCity(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-100 bg-white shadow-lg overflow-hidden">
            {filtered.slice(0, 5).map((dest) => (
              <button
                key={dest}
                type="button"
                onMouseDown={() => handleSelect(undefined, dest)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <MapPin size={13} className="text-slate-400" /> {dest}
              </button>
            ))}
          </div>
        )}
      </div>

      {city.trim().length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_DESTINATIONS.slice(0, 6).map((dest) => (
            <button
              key={dest}
              type="button"
              onClick={() => handleSelect(undefined, dest)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {dest}
            </button>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={!city.trim()}
        className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
      >
        Confirm Location
      </button>
    </form>
  );
}
