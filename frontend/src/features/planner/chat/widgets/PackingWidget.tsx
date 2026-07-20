import React, { useState } from 'react';
import { Briefcase, Check, ChevronDown } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface PackingWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

const CATEGORIES = [
  { label: 'Documents', emoji: '📄', items: ['Passport / ID', 'Visa Printout', 'Insurance', 'Bookings'] },
  { label: 'Clothing', emoji: '👕', items: ['Casual Wear', 'Warm Layers', 'Swimwear', 'Footwear'] },
  { label: 'Health', emoji: '💊', items: ['Prescription Meds', 'Sunscreen', 'Insect Repellent', 'First Aid'] },
  { label: 'Tech', emoji: '🔌', items: ['Adapter', 'Power Bank', 'Earphones', 'Camera'] },
  { label: 'Essentials', emoji: '🎒', items: ['Cash / Card', 'Water Bottle', 'Travel Pillow', 'Locks'] },
];

export function PackingWidget({ onSubmit, widget, isCompleted }: PackingWidgetProps) {
  const data = (widget.data || {}) as any;
  const allItems = CATEGORIES.flatMap(c => c.items);
  const suggested: string[] = data.suggested_items || allItems;

  const [checked, setChecked] = useState<string[]>(suggested);
  const [openCat, setOpenCat] = useState<string | null>('Documents');

  const toggle = (item: string) =>
    setChecked(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);

  const handleConfirm = () => {
    onSubmit(`Packing list: ${checked.length} items ready`, {
      field: 'packing_list',
      value: { items: checked },
    });
  };

  const summaryNode = <span className="font-semibold text-ink-800">{checked.length} items packed</span>;

  return (
    <WidgetContainer
      header={{ icon: <Briefcase size={13} />, title: 'Packing checklist' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-col gap-1">
        {CATEGORIES.map(cat => {
          const isOpen = openCat === cat.label;
          const catChecked = cat.items.filter(i => checked.includes(i)).length;
          return (
            <div key={cat.label} className="rounded-xl border border-line overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenCat(isOpen ? null : cat.label)}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-paper-1 transition-colors"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-700">
                  <span>{cat.emoji}</span> {cat.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-ink-400">{catChecked}/{cat.items.length}</span>
                  <ChevronDown size={11} className={`text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {isOpen && (
                <div className="flex flex-col gap-0.5 border-t border-line bg-paper-0 px-3 py-2">
                  {cat.items.map(item => (
                    <label key={item} className="flex cursor-pointer items-center gap-2 py-1">
                      <div
                        onClick={() => toggle(item)}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                          checked.includes(item) ? 'border-ink-900 bg-ink-900' : 'border-line bg-paper-0'
                        }`}
                      >
                        {checked.includes(item) && <Check size={9} className="text-white" />}
                      </div>
                      <span
                        onClick={() => toggle(item)}
                        className={`text-xs transition-colors ${checked.includes(item) ? 'text-ink-700' : 'text-ink-400 line-through'}`}
                      >
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </WidgetContainer>
  );
}
