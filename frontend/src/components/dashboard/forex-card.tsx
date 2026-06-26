'use client';

import GlassCard from '@/components/ui-custom/glass-card';

export default function ForexCard() {
  return (
    <GlassCard className="p-6">
      <p className="text-sm text-slate-500">Forex Services</p>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="font-medium">Currency Exchange</p>
          <p className="text-sm text-slate-500">Check live rates and exchange currency securely.</p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="font-medium">Travel Cards</p>
          <p className="text-sm text-slate-500">Manage multi-currency travel cards.</p>
        </div>
      </div>
    </GlassCard>
  );
}
