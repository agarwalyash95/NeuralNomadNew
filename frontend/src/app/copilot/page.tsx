'use client';

import AppShell from '@/components/ui-custom/app-shell';
import GlassCard from '@/components/ui-custom/glass-card';

export default function CopilotPage() {
  return (
    <AppShell>
      <GlassCard className="p-6">
        <h1 className="text-2xl font-bold">AI Travel Copilot</h1>

        <textarea
          placeholder="Plan a 10-day Japan trip under ₹1.5 lakh..."
          className="
            mt-6
            h-64
            w-full
            rounded-xl
            border
            p-4
          "
        />
      </GlassCard>
    </AppShell>
  );
}
