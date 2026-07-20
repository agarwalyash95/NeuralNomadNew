import React, { useState, useEffect } from 'react';
import { ShieldCheck, ChevronDown } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface TravelInsuranceWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

const TIERS = [
  { id: 'basic', label: 'Basic', price: '~₹500' },
  { id: 'standard', label: 'Standard', price: '~₹1,200' },
  { id: 'comprehensive', label: 'Full Cover', price: '~₹2,500' },
  { id: 'none', label: 'Skip', price: 'Free' },
];

const ADD_ONS = ['Adventure Sports', 'Pre-existing Medical', 'Cancel Anytime', 'Rental Car'];

export function TravelInsuranceWidget({ onSubmit, widget, isCompleted }: TravelInsuranceWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;

  const [coverage, setCoverage] = useState<string>(prefilled.coverage || 'standard');
  const [addOns, setAddOns] = useState<string[]>(prefilled.add_ons || []);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isCompleted) {
      if (prefilled.coverage) setCoverage(prefilled.coverage);
      if (prefilled.add_ons) setAddOns(prefilled.add_ons);
    }
  }, [prefilled.coverage, prefilled.add_ons, isCompleted]);

  const toggleAddOn = (a: string) =>
    setAddOns(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  const selected = TIERS.find(t => t.id === coverage);

  const handleConfirm = () => {
    onSubmit(`Insurance: ${selected?.label}${addOns.length ? ` + ${addOns.join(', ')}` : ''}`, {
      field: 'travel_insurance',
      value: { coverage, add_ons: addOns },
    });
  };

  const summaryNode = <span className="font-semibold text-ink-800">{selected?.label} · {selected?.price}</span>;

  return (
    <WidgetContainer
      header={{ icon: <ShieldCheck size={13} />, title: 'Travel insurance?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      <div className="flex gap-1.5">
        {TIERS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setCoverage(t.id)}
            className={`flex flex-1 flex-col items-center rounded-xl border py-2 text-center transition-all ${
              coverage === t.id
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
            }`}
          >
            <span className="text-[11px] font-bold">{t.label}</span>
            <span className={`text-[9px] font-medium ${coverage === t.id ? 'text-white/70' : 'text-ink-400'}`}>{t.price}</span>
          </button>
        ))}
      </div>

      {coverage !== 'none' && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-[10px] font-semibold text-ink-400 hover:text-ink-700 transition-colors"
          >
            <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {expanded ? 'Less' : 'Add-ons'}
          </button>

          {expanded && (
            <div className="flex flex-wrap gap-1.5 border-t border-line pt-2">
              {ADD_ONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleAddOn(opt)}
                  className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                    addOns.includes(opt)
                      ? 'border-ink-900 bg-ink-900 text-white'
                      : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </WidgetContainer>
  );
}
