import GlassCard from '@/components/ui-custom/glass-card';

export default function TestimonialSection() {
  return (
    <section className="py-20">
      <h2 className="text-3xl font-bold">Loved by Travelers</h2>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <GlassCard className="p-6">
          <p>Best travel planner I have ever used.</p>
        </GlassCard>

        <GlassCard className="p-6">
          <p>Visa and forex insights saved me time.</p>
        </GlassCard>

        <GlassCard className="p-6">
          <p>AI itinerary was surprisingly accurate.</p>
        </GlassCard>
      </div>
    </section>
  );
}
