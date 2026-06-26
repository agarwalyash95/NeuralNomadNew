'use client';

import AppShell from '@/components/ui-custom/app-shell';
import Hero from '@/components/home/hero';
import SmartInsightsBar from '@/components/home/smart-insights-bar';
import MoodDestinationSection from '@/components/home/mood-destination-section';
import AIFeaturesStrip from '@/components/home/ai-features-strip';
import { useHomepage } from '@/hooks/use-homepage';

export default function HomePage() {
  const {
    moods,
    destinations,
    insight,
    features,
    activeMood,
    loading,
    filterByMood,
    recordView,
  } = useHomepage();

  return (
    <AppShell>
      {/* Compact Hero with mood chips */}
      <Hero moods={moods} activeMood={activeMood} onMoodClick={filterByMood} destinations={destinations} />

      <div className="mx-auto max-w-7xl px-6 space-y-2">
        {/* Slim seasonal insight ribbon */}
        <SmartInsightsBar insight={insight} />

        {/* Mood pills + destination cards (combined) */}
        <MoodDestinationSection
          moods={moods}
          destinations={destinations}
          activeMood={activeMood}
          loading={loading}
          onMoodChange={filterByMood}
          onView={recordView}
        />

        {/* AI feature tiles */}
        <AIFeaturesStrip features={features} />

        {/* Minimal CTA footer */}
        <section className="py-12 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Ready to plan your next adventure?</h2>
          <p className="mt-2 text-slate-500">Explore the world and find your perfect destination.</p>
          <a
            href="/attractions"
            className="mt-6 inline-block rounded-2xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors shadow-lg"
          >
            Explore Destinations →
          </a>
        </section>
      </div>
    </AppShell>
  );
}
