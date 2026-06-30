'use client';

import React from 'react';
import SearchResults from '@/components/bookings/search-results';

interface BookingResultsProps {
  loading: boolean;
  results: any[];
}

export default function BookingResults({ loading, results }: BookingResultsProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Searching live inventory...</p>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-slate-800">Results</h3>
      <div className="custom-scrollbar max-h-[400px] overflow-y-auto pr-1">
        <SearchResults results={results} />
      </div>
    </div>
  );
}
