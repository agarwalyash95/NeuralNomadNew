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
      className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-line-strong bg-paper-2 p-3 shadow-surface"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{title}</p>
        <span className="flex items-center gap-1 rounded-full bg-[rgb(var(--color-ai)/0.08)] px-2 py-0.5 text-[10px] font-bold text-[rgb(var(--color-ai))]">
          <Sparkles size={10} /> AI Analyzing
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
        <input
          autoFocus
          value={city}
          onChange={(e) => { setCity(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-line bg-paper-2 py-2 pl-9 pr-4 text-sm text-ink-800 placeholder:text-ink-400 shadow-surface focus:border-[rgb(var(--color-ai))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-ai)/0.2)]"
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-line bg-paper-2 shadow-modal overflow-hidden">
            {filtered.slice(0, 5).map((dest) => (
              <button
                key={dest}
                type="button"
                onMouseDown={() => handleSelect(undefined, dest)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-[rgb(var(--color-ai)/0.08)] hover:text-[rgb(var(--color-ai))] transition-colors"
              >
                <MapPin size={13} className="text-ink-400" /> {dest}
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
              className="rounded-lg border border-line bg-paper-0 px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-[rgb(var(--color-ai)/0.4)] hover:bg-[rgb(var(--color-ai)/0.08)] hover:text-[rgb(var(--color-ai))] transition-colors"
            >
              {dest}
            </button>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={!city.trim()}
        className="mt-1 w-full rounded-xl bg-gradient-to-r from-[rgb(var(--color-ai))] to-violet-700 py-2 text-sm font-semibold text-white shadow-surface transition-all hover:opacity-90 disabled:from-line disabled:to-line disabled:text-ink-400"
      >
        Confirm Location
      </button>
    </form>
  );
}
