'use client';

import GlassCard from '@/components/ui-custom/glass-card';

import { useDashboard } from '@/hooks/use-dashboard';

export default function TravelAlertCard() {
  const { notifications, loading } = useDashboard();

  return (
    <GlassCard className="p-6">
      <p className="text-sm text-slate-500">Travel Alerts</p>

      <div className="mt-4">
        {loading ? (
          <p>Loading alerts...</p>
        ) : (
          <>
            <h3 className="text-3xl font-bold">{notifications}</h3>

            <p className="mt-2 text-slate-500">unread travel notifications</p>
          </>
        )}
      </div>
    </GlassCard>
  );
}
