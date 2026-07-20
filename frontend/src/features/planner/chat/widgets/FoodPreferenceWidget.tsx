import React, { useState, useEffect } from 'react';
import { Utensils, ChevronDown } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface FoodPreferenceWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

export function FoodPreferenceWidget({ onSubmit, widget, isCompleted }: FoodPreferenceWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;

  const [dietary, setDietary] = useState<string>(prefilled.dietary || 'No Restrictions');
  const [cuisines, setCuisines] = useState<string[]>(prefilled.cuisines || []);
  const [ambiance, setAmbiance] = useState<string>(prefilled.ambiance || 'Casual');
  const [spiceLevel, setSpiceLevel] = useState<string>(prefilled.spice_level || 'Medium');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isCompleted) {
      if (prefilled.dietary) setDietary(prefilled.dietary);
      if (prefilled.cuisines) setCuisines(prefilled.cuisines);
      if (prefilled.ambiance) setAmbiance(prefilled.ambiance);
      if (prefilled.spice_level) setSpiceLevel(prefilled.spice_level);
    }
  }, [prefilled.dietary, prefilled.cuisines, prefilled.ambiance, prefilled.spice_level, isCompleted]);

  const toggleCuisine = (c: string) =>
    setCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const handleConfirm = () => {
    onSubmit(`Food: ${dietary}, ${spiceLevel} spice`, {
      field: 'food_preferences',
      value: { dietary, cuisines, ambiance, spice_level: spiceLevel },
    });
  };

  const summaryNode = <span className="font-semibold text-ink-800">{dietary} · {spiceLevel} spice</span>;

  return (
    <WidgetContainer
      header={{ icon: <Utensils size={13} />, title: 'Food preferences?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      {/* Primary: dietary */}
      <div className="flex flex-wrap gap-1.5">
        {['Vegetarian', 'Vegan', 'Jain', 'Halal', 'No Restrictions'].map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => setDietary(opt)}
            className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              dietary === opt ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] font-semibold text-ink-400 hover:text-ink-700 transition-colors"
      >
        <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        {expanded ? 'Less' : 'Cuisine, spice & ambiance'}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-2">
          <div>
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-ink-400">Spice Level</span>
            <div className="flex gap-1.5">
              {['Mild', 'Medium', 'Spicy', 'Extra Spicy'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSpiceLevel(opt)}
                  className={`flex-1 rounded-xl border py-1 text-[10px] font-semibold transition-all ${
                    spiceLevel === opt ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-ink-400">Cuisines</span>
            <div className="flex flex-wrap gap-1.5">
              {['Local', 'North Indian', 'South Indian', 'Asian', 'Continental', 'Street Food', 'Dhaba'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleCuisine(opt)}
                  className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    cuisines.includes(opt) ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-ink-400">Ambiance</span>
            <div className="flex flex-wrap gap-1.5">
              {['Casual', 'Fine Dining', 'Romantic', 'Family', 'Rooftop'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAmbiance(opt)}
                  className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    ambiance === opt ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
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
