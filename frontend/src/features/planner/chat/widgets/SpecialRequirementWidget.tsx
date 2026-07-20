import React, { useState, useEffect } from 'react';
import { HeartHandshake, ChevronDown } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface SpecialRequirementWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

const OPTIONS = [
  { id: 'Wheelchair', label: 'Wheelchair' },
  { id: 'Stroller', label: 'Stroller' },
  { id: 'Elderly', label: 'Elderly care' },
  { id: 'Pets', label: 'Pets' },
  { id: 'Medical', label: 'Medical assist' },
  { id: 'Veg Meals', label: 'Veg meals on flight' },
];

export function SpecialRequirementWidget({ onSubmit, widget, isCompleted }: SpecialRequirementWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;

  const [selected, setSelected] = useState<string[]>(prefilled.accessibility || []);
  const [notes, setNotes] = useState<string>(prefilled.notes || '');
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (!isCompleted) {
      if (prefilled.accessibility) setSelected(prefilled.accessibility);
      if (prefilled.notes) setNotes(prefilled.notes);
    }
  }, [prefilled.accessibility, prefilled.notes, isCompleted]);

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleConfirm = () => {
    const msg = selected.length > 0 ? `Special needs: ${selected.join(', ')}` : 'No special requirements';
    onSubmit(msg, {
      field: 'special_requirements',
      value: { accessibility: selected, notes: notes.trim() || undefined },
    });
  };

  const summaryNode = (
    <span className="font-semibold text-ink-800">
      {selected.length > 0 ? selected.join(', ') : 'None'}
    </span>
  );

  return (
    <WidgetContainer
      header={{ icon: <HeartHandshake size={13} />, title: 'Any special needs?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-wrap gap-1.5">
        {OPTIONS.map(opt => (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              selected.includes(opt.id)
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowNotes(v => !v)}
        className="flex items-center gap-1 text-[10px] font-semibold text-ink-400 hover:text-ink-700 transition-colors"
      >
        <ChevronDown size={11} className={`transition-transform ${showNotes ? 'rotate-180' : ''}`} />
        {showNotes ? 'Hide notes' : 'Add a note'}
      </button>

      {showNotes && (
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. traveling with medical equipment…"
          rows={2}
          className="w-full rounded-xl border border-line bg-paper-0 p-2.5 text-xs text-ink-800 placeholder:text-ink-400 focus:border-ink-900 focus:outline-none focus:ring-1 focus:ring-ink-900/20"
        />
      )}
    </WidgetContainer>
  );
}
