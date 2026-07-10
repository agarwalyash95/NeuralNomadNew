import React, { useState } from 'react';
import { Search, Navigation, MapPin } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';

const POPULAR_DEPARTURES = [
  'Delhi', 'Mumbai', 'London', 'New York', 'Paris', 'Singapore',
  'Tokyo', 'Dubai', 'Sydney', 'Bareilly',
];

interface OriginWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
}

export function OriginWidget({ onSubmit, widget }: OriginWidgetProps) {
  const [city, setCity] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const destination = widget.data?.destination;
  const intent = (widget.data?.intent as string) || 'full_trip';
  const destName = (typeof destination === 'object' && destination && 'name' in (destination as any))
    ? (destination as any).name as string
    : (typeof destination === 'string' ? destination : '');

  let title = 'Departure Location';
  let messagePrefix = 'Departing from';
  let placeholder = 'Enter departure city...';

  if (intent === 'flight_only') {
    title = 'Departure Airport / City';
    messagePrefix = 'Flying from';
    placeholder = 'e.g. Delhi, Mumbai, London...';
  } else if (intent === 'train_only') {
    title = 'Boarding Station';
    messagePrefix = 'Boarding train from';
    placeholder = 'e.g. Delhi Junction, Mumbai Central...';
  } else if (intent === 'cab_only') {
    title = 'Pickup Location';
    messagePrefix = 'Pickup cab from';
    placeholder = 'e.g. Hotel, Airport, Address...';
  }

  const filtered = city.trim().length > 0
    ? POPULAR_DEPARTURES.filter(d => d.toLowerCase().startsWith(city.toLowerCase()))
    : [];

  const handleSelect = (e?: React.FormEvent, selectedCity?: string) => {
    e?.preventDefault();
    const originCity = selectedCity ?? city.trim();
    if (!originCity) return;
    setShowSuggestions(false);
    onSubmit(`${messagePrefix} ${originCity}`, {
      field: 'origin',
      value: { name: originCity },
    });
  };

  return (
    <form
      onSubmit={handleSelect}
      className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-line-strong bg-white p-3 shadow-sm animate-fade-in"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
          <Navigation size={10} /> Transit Route
        </span>
      </div>

      <p className="text-xs text-slate-400">
        Where are you starting your journey to {destName || 'your destination'}?
      </p>

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
          {POPULAR_DEPARTURES.slice(0, 6).map((dest) => (
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
        Confirm Departure Location
      </button>
    </form>
  );
}
