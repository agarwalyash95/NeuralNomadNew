import GlassCard from './glass-card';

interface TripCardProps {
  title: string;
  budget: string;
}

export default function TripCard({ title, budget }: TripCardProps) {
  return (
    <GlassCard className="p-6">
      <h3 className="text-xl font-semibold">{title}</h3>

      <p className="mt-4 text-slate-500">Estimated Budget</p>

      <p className="text-2xl font-bold text-blue-600">{budget}</p>
    </GlassCard>
  );
}
