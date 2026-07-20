import React, { useState, useEffect } from 'react';
import { Sparkles, Plane, Train as TrainIcon, Bus, Car, Navigation, Ship } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface TransportSelectionWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

const MODES = [
  { id: 'ai', label: 'Best option', icon: <Sparkles size={13} /> },
  { id: 'flight', label: 'Flight', icon: <Plane size={13} /> },
  { id: 'train', label: 'Train', icon: <TrainIcon size={13} /> },
  { id: 'bus', label: 'Bus', icon: <Bus size={13} /> },
  { id: 'cab', label: 'Cab', icon: <Navigation size={13} /> },
  { id: 'self_drive', label: 'Self Drive', icon: <Car size={13} /> },
  { id: 'ferry', label: 'Ferry', icon: <Ship size={13} /> },
];

export function TransportSelectionWidget({ onSubmit, widget, isCompleted }: TransportSelectionWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;

  const [mode, setMode] = useState<string>(prefilled.mode || 'ai');

  useEffect(() => {
    if (!isCompleted && prefilled.mode) setMode(prefilled.mode);
  }, [prefilled.mode, isCompleted]);

  const selected = MODES.find(m => m.id === mode);

  const handleConfirm = () => {
    onSubmit(`Travel by ${selected?.label}`, {
      field: 'transport_selection',
      value: { mode },
    });
  };

  const summaryNode = (
    <span className="flex items-center gap-1 font-semibold text-ink-800">
      {selected?.icon} {selected?.label}
    </span>
  );

  return (
    <WidgetContainer
      header={{ icon: <Car size={13} />, title: 'How to travel?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-wrap gap-1.5">
        {MODES.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
              mode === m.id
                ? 'border-ink-900 bg-ink-900 text-white shadow-sm'
                : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
            }`}
          >
            <span className={mode === m.id ? 'text-white' : 'text-ink-500'}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>
    </WidgetContainer>
  );
}
