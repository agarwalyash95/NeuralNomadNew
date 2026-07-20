import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface MultiCityWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

export function MultiCityWidget({ onSubmit, widget, isCompleted }: MultiCityWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;

  const [destinations, setDestinations] = useState<string[]>(
    Array.isArray(prefilled.destinations) && prefilled.destinations.length > 0 
      ? prefilled.destinations 
      : ['', '']
  );

  useEffect(() => {
    if (!isCompleted && Array.isArray(prefilled.destinations)) {
      setDestinations(prefilled.destinations);
    }
  }, [prefilled.destinations, isCompleted]);

  const handleConfirm = () => {
    const valid = destinations.filter(d => d.trim());
    if (valid.length < 2) return;

    onSubmit(`Multi-city trip: ${valid.join(' → ')}`, {
      field: 'multi_city',
      value: {
        destinations: valid,
      },
    });
  };

  const addDestination = () => {
    setDestinations([...destinations, '']);
  };

  const removeDestination = (index: number) => {
    setDestinations(destinations.filter((_, i) => i !== index));
  };

  const updateDestination = (index: number, value: string) => {
    const newDests = [...destinations];
    newDests[index] = value;
    setDestinations(newDests);
  };

  const validCount = destinations.filter(d => d.trim()).length;

  const summaryNode = (
    <div className="flex flex-col gap-1.5">
      {destinations.filter(d => d.trim()).map((d, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <MapPin size={12} className={i === 0 ? "text-emerald-500" : "text-ink-400"} />
          <span className="font-semibold text-ink-800">{d}</span>
        </div>
      ))}
    </div>
  );

  return (
    <WidgetContainer
      header={{
        icon: <MapPin size={14} />,
        title: 'Multi-City Trip',
        subtitle: 'Add your destinations in order',
        aiRecommendation: Array.isArray(prefilled.destinations) ? 'AI Route Planned' : undefined,
      }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={validCount >= 2 ? handleConfirm : undefined}
    >
      <div className="flex flex-col gap-3 relative">
        <div className="absolute left-[11px] top-6 bottom-6 w-[2px] bg-line z-0"></div>
        {destinations.map((dest, i) => (
          <div key={i} className="flex items-center gap-2 relative z-10">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper-2 border border-line text-[10px] font-bold text-ink-500">
              {i + 1}
            </div>
            <input
              value={dest}
              onChange={(e) => updateDestination(i, e.target.value)}
              placeholder={`Destination ${i + 1}`}
              className="w-full rounded-xl border border-line bg-paper-0 py-2 pl-3 pr-4 text-sm text-ink-800 shadow-sm focus:border-ink-900 focus:outline-none focus:ring-2 focus:ring-ink-900/20"
            />
            {destinations.length > 2 && (
              <button
                type="button"
                onClick={() => removeDestination(i)}
                className="p-2 text-ink-400 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}

        {destinations.length < 6 && (
          <button
            type="button"
            onClick={addDestination}
            className="ml-8 mr-auto flex items-center gap-1 text-xs font-semibold text-ink-900 hover:opacity-80 transition-opacity"
          >
            <Plus size={14} /> Add another city
          </button>
        )}
      </div>
    </WidgetContainer>
  );
}
