import React from 'react';
import { ChevronDown, Plus, CheckCircle, Clock } from 'lucide-react';
import { mockTripData } from './mockData';

interface PreJourneyChecklistProps {
  onChecklistClick: (type: string) => void;
}

export default function PreJourneyChecklist({ onChecklistClick }: PreJourneyChecklistProps) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <button className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition-colors hover:text-slate-800">
          <CheckCircle size={14} className="text-emerald-500" />
          Pre-journey checklist
          <ChevronDown size={14} />
        </button>
        <button className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-[#faf8f2] hover:text-slate-800">
          <Plus size={12} /> Add task
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {mockTripData.checklist.map((item) => (
          <div
            key={item.id}
            onClick={() => onChecklistClick(item.type)}
            className="cursor-pointer rounded-[16px] border border-[#e2ddd2] bg-white p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                  item.status === 'Completed'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                    : 'border-amber-200 bg-amber-50 text-amber-600'
                }`}
              >
                {item.status === 'Completed' ? <CheckCircle size={16} /> : <Clock size={16} />}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">{item.label}</p>
                <p
                  className={`mt-0.5 text-[10px] font-semibold ${
                    item.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {item.status}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
