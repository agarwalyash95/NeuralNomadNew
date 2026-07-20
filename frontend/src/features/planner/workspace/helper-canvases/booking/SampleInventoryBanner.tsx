import React from 'react';
import { Info } from 'lucide-react';

export default function SampleInventoryBanner() {
  return (
    <div role="status" className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-900">
      <Info size={13} /> Sample data for planning only — availability and prices are not live.
    </div>
  );
}
