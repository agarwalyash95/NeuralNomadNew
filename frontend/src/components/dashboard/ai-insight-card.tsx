import GlassCard from '@/components/ui-custom/glass-card';

export default function AIInsightCard() {
  return (
    <GlassCard className="p-6">
      <p className="text-sm text-slate-500">AI Insights</p>

      <p className="mt-4 text-slate-700">
        Your dashboard is now connected to live wallet, trip, visa, and notification data. Insights will appear here shortly.
      </p>
    </GlassCard>
  );
}
