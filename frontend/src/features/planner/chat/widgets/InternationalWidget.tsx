import React, { useState, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';
import { WidgetContainer } from './shared/WidgetContainer';

interface InternationalWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  isCompleted?: boolean;
}

export function InternationalWidget({ onSubmit, widget, isCompleted }: InternationalWidgetProps) {
  const data = (widget.data || {}) as any;
  const prefilled = (data.prefilled || {}) as any;

  const [visaStatus, setVisaStatus] = useState<string>(prefilled.visa_status || 'Need Visa');
  const [passportReady, setPassportReady] = useState<boolean>(prefilled.passport_ready ?? true);
  const [forexNeeded, setForexNeeded] = useState<string>(prefilled.forex_needed || 'Card Only');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isCompleted) {
      if (prefilled.visa_status) setVisaStatus(prefilled.visa_status);
      if (prefilled.passport_ready !== undefined) setPassportReady(prefilled.passport_ready);
      if (prefilled.forex_needed) setForexNeeded(prefilled.forex_needed);
    }
  }, [prefilled.visa_status, prefilled.passport_ready, prefilled.forex_needed, isCompleted]);

  const handleConfirm = () => {
    onSubmit(`Visa: ${visaStatus}, Forex: ${forexNeeded}`, {
      field: 'international_details',
      value: { passport_ready: passportReady, visa_status: visaStatus, forex_needed: forexNeeded },
    });
  };

  const summaryNode = <span className="font-semibold text-ink-800">Visa: {visaStatus}</span>;

  return (
    <WidgetContainer
      header={{ icon: <Globe size={13} />, title: 'International prep?' }}
      isCompleted={isCompleted}
      summaryNode={summaryNode}
      onConfirm={handleConfirm}
    >
      <div className="flex flex-wrap gap-1.5">
        {['Already Have', 'Need Visa', 'Visa on Arrival', 'Not Required'].map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => setVisaStatus(opt)}
            className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              visaStatus === opt
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
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
        {expanded ? 'Less' : 'Passport & forex'}
      </button>

      {expanded && (
        <div className="flex flex-col gap-2.5 border-t border-line pt-2">
          <label className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-700">Passport valid (6+ months)?</span>
            <input
              type="checkbox"
              checked={passportReady}
              onChange={e => setPassportReady(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-ink-900"
            />
          </label>
          <div>
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-ink-400">Forex</span>
            <div className="flex gap-1.5">
              {['Cash & Card', 'Card Only', 'Already Sorted'].map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setForexNeeded(opt)}
                  className={`flex-1 rounded-xl border py-1.5 text-[10px] font-semibold transition-all ${
                    forexNeeded === opt ? 'border-ink-900 bg-ink-900 text-white' : 'border-line bg-paper-0 text-ink-600 hover:bg-paper-1'
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
