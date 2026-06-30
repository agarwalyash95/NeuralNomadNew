'use client';

import React from 'react';
import { Loader2, AlertCircle, Store, Banknote } from 'lucide-react';
import { ForexVendor } from '@/types/forex';
import VendorCard from '@/components/travel-prep/forex/VendorCard';

interface ForexResultsProps {
  forexLoading: boolean;
  forexError: string | null;
  hasSearchedForex: boolean;
  forexVendors: ForexVendor[];
  fromCurrency: string;
  toCurrency: string;
  amount: number;
}

export default function ForexResults({
  forexLoading,
  forexError,
  hasSearchedForex,
  forexVendors,
  fromCurrency,
  toCurrency,
  amount,
}: ForexResultsProps) {
  if (forexLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <Loader2 size={24} className="mb-2 animate-spin text-blue-600" />
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Searching vendors...</p>
      </div>
    );
  }

  if (forexError) {
    return (
      <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600">
        <AlertCircle size={14} className="shrink-0" /> {forexError}
      </div>
    );
  }

  if (!hasSearchedForex) {
    return (
      <div className="py-8 text-center">
        <Banknote size={24} className="mx-auto mb-2 text-slate-200" />
        <p className="text-xs font-semibold text-slate-400">Search to see local rates</p>
      </div>
    );
  }

  if (forexVendors.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center">
        <Store size={24} className="mx-auto mb-2 text-slate-300" />
        <p className="text-xs font-semibold text-slate-500">No vendors stock {toCurrency}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {forexVendors.length} vendors found
      </h3>
      {forexVendors.map((vendor) => (
        <VendorCard
          key={vendor.id}
          vendor={vendor}
          fromCurrency={fromCurrency}
          toCurrency={toCurrency}
          amount={amount}
        />
      ))}
    </div>
  );
}
