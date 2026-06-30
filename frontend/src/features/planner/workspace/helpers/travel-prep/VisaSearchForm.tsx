'use client';

import React, { FormEvent } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';

interface VisaSearchFormProps {
  visaQuery: string;
  visaLoading: boolean;
  onVisaQueryChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export default function VisaSearchForm({
  visaQuery,
  visaLoading,
  onVisaQueryChange,
  onSubmit,
}: VisaSearchFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="rounded-2xl border border-[#ddd7ca] bg-white p-3 transition-colors focus-within:border-indigo-500">
        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
          Destination country
        </label>
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-slate-400" />
          <input
            type="text"
            value={visaQuery}
            onChange={(e) => onVisaQueryChange(e.target.value)}
            placeholder="Japan, UAE, Switzerland..."
            className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={visaLoading || !visaQuery.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 disabled:opacity-50"
      >
        {visaLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        Check requirements
      </button>
    </form>
  );
}
