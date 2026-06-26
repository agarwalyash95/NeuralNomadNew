'use client';

import GlassCard from '@/components/ui-custom/glass-card';

import { useDashboard } from '@/hooks/use-dashboard';

export default function UpcomingTripCard() {
  const { trip, loading } = useDashboard();

  if (loading) {
    return <GlassCard className="p-6">Loading Trip...</GlassCard>;
  }

  if (!trip) {
    return (
      <GlassCard className="p-6">
        <h2 className="text-xl font-semibold">No Upcoming Trips</h2>

        <p className="mt-2 text-slate-500">Start planning your next adventure.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <p className="text-sm text-slate-500">Upcoming Trip</p>

      <h2 className="mt-3 text-2xl font-bold">{trip.destination}</h2>

      <p className="mt-2 text-slate-500">
        {trip.start_date} - {trip.end_date}
      </p>

      <div className="mt-4 rounded-xl bg-blue-50 p-3 text-blue-700">Status: {trip.status}</div>
    </GlassCard>
  );
}
