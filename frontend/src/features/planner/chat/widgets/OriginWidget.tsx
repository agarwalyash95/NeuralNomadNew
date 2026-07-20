import React, { useState } from 'react';
import { Search, Navigation, MapPin } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

/**
 * Legacy widget — the WidgetOrchestrator ladder no longer emits
 * `origin_search` as its own step (origin is now one field inside the
 * `cluster_party` card), but old persisted messages still carry this type,
 * so it stays registered. Restyled onto the shared WidgetContainer for
 * visual consistency with the rest of the widget set.
 */

const POPULAR_DEPARTURES = [
  'Delhi', 'Mumbai', 'London', 'New York', 'Paris', 'Singapore',
  'Tokyo', 'Dubai', 'Sydney', 'Bareilly',
];

interface OriginWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

export function OriginWidget({ onSubmit, widget, isCompleted }: OriginWidgetProps) {
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

  const summaryNode = city.trim() ? <span className="font-semibold text-ink-800">{city.trim()}</span> : null;

  return (
    <WidgetContainer
      header={{ icon: <Navigation size={13} />, title }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
    >
      <form onSubmit={handleSelect} className="flex flex-col gap-2.5">
        <p className="text-xs text-ink-500">
          Where are you starting your journey to {destName || 'your destination'}?
        </p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={14} />
          <input
            autoFocus
            value={city}
            onChange={(e) => { setCity(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={placeholder}
            className="w-full rounded-lg border border-line bg-paper-0 py-1.5 pl-8 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-[rgb(var(--color-ai))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-ai)/0.15)]"
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
                className="rounded-lg border border-line bg-paper-0 px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-[rgb(var(--color-ai)/0.3)] hover:bg-[rgb(var(--color-ai)/0.08)] hover:text-[rgb(var(--color-ai))] transition-colors"
              >
                {dest}
              </button>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={!city.trim()}
          className="mt-0.5 w-full rounded-xl bg-ink-900 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-ink-700 disabled:bg-paper-1 disabled:text-ink-400"
        >
          Confirm Departure Location
        </button>
      </form>
    </WidgetContainer>
  );
}
