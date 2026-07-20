import React, { useState, useEffect } from 'react';
import { Palette, ChevronDown } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface ActivityPreferenceWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

const ACTIVITIES = [
  { id: 'Sightseeing', emoji: '📸' },
  { id: 'Nature', emoji: '🌿' },
  { id: 'Adventure', emoji: '🧗' },
  { id: 'Food Tours', emoji: '🍜' },
  { id: 'Shopping', emoji: '🛍️' },
  { id: 'Museums', emoji: '🏛️' },
  { id: 'Relaxation', emoji: '🧘' },
  { id: 'Wildlife', emoji: '🦁' },
  { id: 'Nightlife', emoji: '🌃' },
  { id: 'Pilgrimage', emoji: '🛕' },
];

export function ActivityPreferenceWidget({ onSubmit, widget, isCompleted }: ActivityPreferenceWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;

  const [activities, setActivities] = useState<string[]>(prefilled.activities || []);
  const [preferredTime, setPreferredTime] = useState<string>(prefilled.time || 'Morning');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isCompleted) {
      if (prefilled.activities) setActivities(prefilled.activities);
      if (prefilled.time) setPreferredTime(prefilled.time);
    }
  }, [prefilled.activities, prefilled.time, isCompleted]);

  const toggle = (act: string) =>
    setActivities(prev => prev.includes(act) ? prev.filter(x => x !== act) : [...prev, act]);

  const handleConfirm = () => {
    onSubmit(
      activities.length > 0
        ? `Activities: ${activities.join(', ')}`
        : 'No specific activity preference',
      { field: 'activity_preferences', value: { activities, time: preferredTime } }
    );
  };

  const summaryNode = (
    <span className="font-semibold text-ink-800">
      {activities.length > 0 ? activities.slice(0, 2).join(', ') + (activities.length > 2 ? ` +${activities.length - 2}` : '') : 'Any'}
    </span>
  );

  return (
    <WidgetContainer
      header={{ icon: <Palette size={13} />, title: 'What do you enjoy?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITIES.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => toggle(a.id)}
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              activities.includes(a.id)
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
            }`}
          >
            <span>{a.emoji}</span> {a.id}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] font-semibold text-ink-400 hover:text-ink-700 transition-colors"
      >
        <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Less' : 'Preferred time of day'}
      </button>

      {expanded && (
        <div className="flex gap-1.5 border-t border-line pt-2">
          {['Morning', 'Afternoon', 'Evening', 'Night'].map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => setPreferredTime(opt)}
              className={`flex-1 rounded-xl border py-1.5 text-[10px] font-semibold transition-all ${
                preferredTime === opt ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </WidgetContainer>
  );
}
