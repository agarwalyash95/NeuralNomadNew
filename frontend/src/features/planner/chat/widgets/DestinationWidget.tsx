import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';
import { referenceService } from '@/services/reference.service';

const QUICK_PICKS = ['Goa', 'Manali', 'Jaipur', 'Bali', 'Dubai', 'Bangkok', 'Kerala', 'Ladakh'];

const ALL_DESTINATIONS = [
  'Goa', 'Manali', 'Jaipur', 'Kerala', 'Ladakh', 'Shimla', 'Andaman', 'Rishikesh',
  'Varanasi', 'Coorg', 'Dubai', 'Bangkok', 'Bali', 'Singapore', 'Paris', 'Tokyo',
  'Maldives', 'Darjeeling', 'Mussoorie', 'Agra', 'Hampi', 'London', 'New York',
];

interface DestinationWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

export function DestinationWidget({ onSubmit, widget, isCompleted }: DestinationWidgetProps) {
  const data = widget.data || {};
  const intent = (data.intent as string) || 'full_trip';
  const prefilledDestination = (data.current_destination as string) || '';
  const prefilledOrigin = (data.current_origin as string) || '';
  const requiresOrigin = ['flight_only', 'train_only', 'bus_only', 'cab_only'].includes(intent);

  const [destination, setDestination] = useState(prefilledDestination);
  const [origin, setOrigin] = useState(prefilledOrigin);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!isCompleted) {
      if (prefilledDestination) setDestination(prefilledDestination);
      if (prefilledOrigin) setOrigin(prefilledOrigin);
    }
  }, [prefilledDestination, prefilledOrigin, isCompleted]);

  useEffect(() => {
    const query = destination.trim();
    if (query.length < 2 || isCompleted) {
      setCitySuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const cities = await referenceService.searchCities(query);
        if (!cancelled) setCitySuggestions(cities.slice(0, 6).map(city => `${city.name}${city.country_name ? `, ${city.country_name}` : ''}`));
      } catch {
        if (!cancelled) setCitySuggestions([]);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [destination, isCompleted]);

  const filtered = citySuggestions.length > 0
    ? citySuggestions
    : destination.trim().length > 1
      ? ALL_DESTINATIONS.filter(d => d.toLowerCase().includes(destination.toLowerCase())).slice(0, 5)
      : [];

  const intentTitles: Record<string, string> = {
    flight_only: 'Flight Route',
    train_only: 'Train Route',
    bus_only: 'Bus Route',
    cab_only: 'Cab Route',
    hotel_only: 'Hotel Location',
  };
  const title = intentTitles[intent] || 'Where to?';

  const handleConfirm = () => {
    if (!destination.trim()) return;
    if (requiresOrigin && !origin.trim()) return;
    const msg = origin.trim()
      ? `I want to go to ${destination.trim()} from ${origin.trim()}`
      : `I want to go to ${destination.trim()}`;
    onSubmit(msg, {
      field: 'destination_submit',
      value: { destination: destination.trim(), origin: origin.trim() || undefined },
    });
  };

  const summaryNode = <span className="font-semibold text-ink-800">{origin ? `${origin} → ${destination}` : destination}</span>;

  return (
    <WidgetContainer
      header={{ icon: <MapPin size={13} />, title }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={destination.trim() && (!requiresOrigin || origin.trim()) ? handleConfirm : undefined}
    >
      {/* Input row */}
      <div className="relative flex items-center gap-2 rounded-xl border border-line bg-paper-0 px-3 py-2 focus-within:border-ink-900 transition-colors">
        {requiresOrigin && (
          <>
            <input
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              placeholder="From"
              className="w-0 flex-1 border-none bg-transparent text-xs font-semibold text-ink-800 placeholder:text-ink-400 focus:outline-none"
            />
            <span className="text-ink-300">→</span>
          </>
        )}
        <input
          autoFocus={!prefilledDestination}
          value={destination}
          onChange={e => { setDestination(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={requiresOrigin ? 'To' : 'City, country or region…'}
          className="w-0 flex-1 border-none bg-transparent text-xs font-semibold text-ink-800 placeholder:text-ink-400 focus:outline-none"
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-line bg-paper-2 shadow-lg">
            {filtered.map(dest => (
              <button
                key={dest}
                type="button"
                onMouseDown={e => { e.preventDefault(); setDestination(dest); setShowSuggestions(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-ink-700 hover:bg-paper-1 transition-colors"
              >
                <MapPin size={11} className="text-ink-400" /> {dest}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick picks — only when empty */}
      {!destination.trim() && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PICKS.map(dest => (
            <button
              key={dest}
              type="button"
              onClick={() => setDestination(dest)}
              className="rounded-full border border-line bg-paper-0 px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-ink-900 hover:text-ink-900 transition-colors"
            >
              {dest}
            </button>
          ))}
        </div>
      )}
    </WidgetContainer>
  );
}
