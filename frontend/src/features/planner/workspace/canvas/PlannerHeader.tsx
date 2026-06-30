import React from 'react';
import { Share, Download, MoreVertical, CreditCard, Loader2 } from 'lucide-react';
import { mockTripData } from './mockData';

interface PlannerHeaderProps {
  onExport?: () => void;
  isExporting?: boolean;
}

export default function PlannerHeader({ onExport, isExporting }: PlannerHeaderProps) {
  return (
    <div className="mb-4 rounded-[16px] border border-[#e2ddd2] bg-white px-4 py-3 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold tracking-[0.2em] text-white shadow-sm">
            JP
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Trip overview</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
              {mockTripData.title}
            </h1>
            <p className="mt-1 text-xs text-slate-500">{mockTripData.stats}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100">
            <CreditCard size={14} />
            Book
          </button>
          <button className="flex items-center gap-1.5 rounded-lg border border-[#ddd7ca] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-[#faf8f2]">
            <Share size={14} />
            Share
          </button>
          <button 
            onClick={onExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg border border-[#ddd7ca] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-[#faf8f2] disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
          <button className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-[#faf8f2] hover:text-slate-700">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
