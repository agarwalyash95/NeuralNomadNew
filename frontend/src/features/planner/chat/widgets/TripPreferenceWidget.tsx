import React, { useState, useEffect } from 'react';
import { Compass, ChevronDown } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface TripPreferenceWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

const TRIP_TYPES = [
  { id: 'Leisure', emoji: '🌴' },
  { id: 'Adventure', emoji: '🧗' },
  { id: 'Culture', emoji: '🏛️' },
  { id: 'Nature', emoji: '🌿' },
  { id: 'Romantic', emoji: '💑' },
  { id: 'Pilgrimage', emoji: '🛕' },
  { id: 'Wellness', emoji: '🧘' },
  { id: 'Shopping', emoji: '🛍️' },
];

export function TripPreferenceWidget({ onSubmit, widget, isCompleted }: TripPreferenceWidgetProps) {
  const data = widget.data || {};
  const prefilled = (data.prefilled as any) || {};

  const [type, setType] = useState<string>(prefilled.type || 'Leisure');
  const [pace, setPace] = useState<string>(prefilled.pace || 'Balanced');
  const [intensity, setIntensity] = useState<string>(prefilled.intensity || 'Moderate');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isCompleted) {
      if (prefilled.type) setType(prefilled.type);
      if (prefilled.pace) setPace(prefilled.pace);
      if (prefilled.intensity) setIntensity(prefilled.intensity);
    }
  }, [prefilled.type, prefilled.pace, prefilled.intensity, isCompleted]);

  const handleConfirm = () => {
    onSubmit(`Trip style: ${type}, ${pace} pace`, {
      field: 'trip_preferences',
      value: { pace, type, intensity },
    });
  };

  const summaryNode = <span className="font-semibold text-ink-800">{type} · {pace}</span>;

  return (
    <WidgetContainer
      header={{ icon: <Compass size={13} />, title: 'What kind of trip?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      {/* Trip type — emoji chips */}
      <div className="flex flex-wrap gap-1.5">
        {TRIP_TYPES.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setType(t.id)}
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              type === t.id
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
            }`}
          >
            <span>{t.emoji}</span> {t.id}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] font-semibold text-ink-400 hover:text-ink-700 transition-colors"
      >
        <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Less' : 'Pace & intensity'}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-2">
          <div>
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-ink-400">Pace</span>
            <div className="flex gap-1.5">
              {['Relaxed', 'Balanced', 'Fast-Paced'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPace(opt)}
                  className={`flex-1 rounded-xl border py-1.5 text-[11px] font-semibold transition-all ${
                    pace === opt ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-ink-400">Activity Level</span>
            <div className="flex gap-1.5">
              {['Light', 'Moderate', 'Action-Packed'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setIntensity(opt)}
                  className={`flex-1 rounded-xl border py-1.5 text-[11px] font-semibold transition-all ${
                    intensity === opt ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </WidgetContainer>
  );
}
