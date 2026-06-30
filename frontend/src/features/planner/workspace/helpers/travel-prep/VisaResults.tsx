'use client';

import React from 'react';
import { Loader2, AlertCircle, Globe } from 'lucide-react';
import { VisaInfo } from '@/types/visa';
import VisaDetailsCard from '@/components/travel-prep/visa/VisaDetailsCard';

interface VisaResultsProps {
  visaLoading: boolean;
  visaError: string | null;
  hasSearchedVisa: boolean;
  visaResults: VisaInfo[];
}

export default function VisaResults({
  visaLoading,
  visaError,
  hasSearchedVisa,
  visaResults,
}: VisaResultsProps) {
  if (visaLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 size={24} className="mb-2 animate-spin text-indigo-600" />
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Checking requirements...</p>
      </div>
    );
  }

  if (visaError) {
    return (
      <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600">
        <AlertCircle size={14} className="shrink-0" /> {visaError}
      </div>
    );
  }

  if (!hasSearchedVisa) {
    return (
      <div className="py-8 text-center">
        <Globe size={24} className="mx-auto mb-2 text-slate-200" />
        <p className="text-xs font-semibold text-slate-400">Search to check visa rules</p>
      </div>
    );
  }

  if (visaResults.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center">
        <Globe size={24} className="mx-auto mb-2 text-slate-300" />
        <p className="text-xs font-semibold text-slate-500">No visa information found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visaResults.map((visa) => (
        <VisaDetailsCard key={visa.id} visa={visa} />
      ))}
    </div>
  );
}
