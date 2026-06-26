'use client';

import GlassCard from './glass-card';

interface Props {
  title: string;
  value: string;
  trend?: string;
}

export default function AnimatedStatCard({ title, value, trend }: Props) {
  return (
    <GlassCard className="p-6 transition hover:-translate-y-1 hover:shadow-xl">
      <p className="text-sm text-slate-500">{title}</p>

      <h2 className="mt-3 text-4xl font-bold">{value}</h2>

      {trend && <p className="mt-2 text-sm text-emerald-600">{trend}</p>}
    </GlassCard>
  );
}
