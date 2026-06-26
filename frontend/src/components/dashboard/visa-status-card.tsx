'use client';

import GlassCard from '@/components/ui-custom/glass-card';

import { useDashboard } from '@/hooks/use-dashboard';

export default function VisaStatusCard() {
  const { visa, loading } = useDashboard();

  if (loading) {
    return <GlassCard className="p-6">Loading Visa Status...</GlassCard>;
  }

  return (
    <GlassCard className="p-6">
      <p className="text-sm text-slate-500">Visa Information</p>

      <h2 className="mt-3 text-xl font-semibold">{visa?.country || 'No Visa Data'}</h2>

      <div className="mt-4 inline-flex rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
        {visa?.visa_type || 'Available'}
      </div>
    </GlassCard>
  );
}
