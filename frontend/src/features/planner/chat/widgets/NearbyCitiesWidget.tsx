import React, { useState } from 'react';
import { Sparkles, MapPin, Navigation, Clock, Plus, Check } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface NearbyCitiesWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
}

export function NearbyCitiesWidget({ widget, onSubmit }: NearbyCitiesWidgetProps) {
  const suggestions = (widget.data.suggestions as Array<{
    city: string;
    distance: string;
    why_visit: string;
    recommended_duration: string;
    image_url?: string | null;
  }>) || [];

  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handleToggle = (city: string) => {
    if (submitted) return;
    setSelectedCities(prev =>
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const handleAddSelected = () => {
    if (selectedCities.length === 0 || submitted) return;
    setSubmitted(true);
    const citiesStr = selectedCities.join(', ');
    const msg = selectedCities.length === 1
      ? `Add ${citiesStr} to my trip as an excursion.`
      : `Add these excursions to my trip: ${citiesStr}.`;
    onSubmit(msg, { field: 'add_nearby_city', value: { cities: selectedCities } });
  };

  const handleSkip = () => {
    setSubmitted(true);
    onSubmit("No extra excursions, keep it to the main destination.", {
      field: 'add_nearby_city',
      value: { cities: [] },
    });
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="mr-auto mt-2 flex w-full max-w-md flex-col gap-3 rounded-2xl border border-line-strong bg-paper-2 p-4 shadow-surface">
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">Recommended Excursions</p>
          <p className="mt-0.5 text-[10px] text-ink-400">Add nearby cities to make it a multi-city trip</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-ink-900/10 px-2 py-0.5 text-[10px] font-bold text-ink-900">
          <Sparkles size={10} className="motion-safe:animate-pulse" /> AI Curated
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {suggestions.map((item, idx) => {
          const isSelected = selectedCities.includes(item.city);
          return (
            <div
              key={idx}
              onClick={() => handleToggle(item.city)}
              {...clickableDivProps(() => handleToggle(item.city))}
              aria-pressed={isSelected}
              className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${FOCUS_RING_CLASS} ${isSelected
                  ? 'border-[rgb(var(--color-ai)/0.3)] bg-[rgb(var(--color-ai)/0.06)] shadow-surface'
                  : 'border-line bg-paper-1/60 hover:border-line-strong hover:bg-paper-1'
                } ${submitted ? 'pointer-events-none opacity-70' : ''}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                readOnly
                disabled={submitted}
                className="mt-0.5 h-4 w-4 rounded border-line-strong accent-ink-900"
              />
              {item.image_url && (
                <div
                  role="img"
                  aria-label={item.city}
                  className="h-12 w-12 shrink-0 rounded-lg bg-paper-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${item.image_url})` }}
                />
              )}
              <div className="flex-1">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink-800">
                  <MapPin size={13} className="text-ink-900" /> {item.city}
                </h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase text-ink-400">
                  <span className="flex items-center gap-1"><Navigation size={10} /> {item.distance}</span>
                  <span className="text-ink-400">•</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {item.recommended_duration}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{item.why_visit}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={handleSkip}
          disabled={submitted}
          className="flex-1 rounded-xl border border-line py-2.5 text-xs font-semibold text-ink-500 hover:bg-paper-1 transition-colors disabled:opacity-50"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleAddSelected}
          disabled={selectedCities.length === 0 || submitted}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${selectedCities.length === 0 || submitted
              ? 'bg-paper-0 text-ink-400 cursor-not-allowed border border-line'
              : 'bg-gradient-to-r from-ink-900 to-violet-700 text-white hover:opacity-90 shadow-surface'}`}
        >
          {submitted ? <><Check size={15} /> Added</> : <><Plus size={15} /> Add ({selectedCities.length})</>}
        </button>
      </div>
    </div>
  );
}
