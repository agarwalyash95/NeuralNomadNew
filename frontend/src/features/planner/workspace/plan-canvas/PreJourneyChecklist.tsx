import React from 'react';
import { Plus, CheckCircle, Clock } from 'lucide-react';
import { MockTripData } from './mockData';

interface PreJourneyChecklistProps {
  data: MockTripData['checklist'];
  onChecklistClick: (type: string) => void;
}

export default function PreJourneyChecklist({ data, onChecklistClick }: PreJourneyChecklistProps) {
  const completedCount = (data || []).filter(i => i.status === 'Completed').length;
  const totalCount = data?.length || 0;

  return (
    <div className="mb-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
            <CheckCircle size={15} className="text-emerald-500" />
            Pre-Journey Checklist
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200">
            {completedCount}/{totalCount} Completed
          </span>
        </div>
        <button className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-xs border border-slate-200/80 transition-colors hover:bg-slate-50 hover:text-slate-900 cursor-pointer">
          <Plus size={12} /> Add Task
        </button>
      </div>

      <div className="grid gap-2.5 md:grid-cols-3">
        {(data || []).map((item) => (
          <div
            key={item.id}
            onClick={() => onChecklistClick(item.type)}
            className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-white/90 p-2.5 shadow-2xs backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200"
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  item.status === 'Completed'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
                    : 'border-amber-200 bg-amber-50 text-amber-600 group-hover:bg-amber-100'
                }`}
              >
                {item.status === 'Completed' ? <CheckCircle size={16} /> : <Clock size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{item.label}</p>
                <div className="mt-0.5 flex items-center justify-between">
                  <span
                    className={`text-[10px] font-extrabold ${
                      item.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {item.status}
                  </span>
                  <span className="text-[9px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Details →</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
