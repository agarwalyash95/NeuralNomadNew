import GlassCard from '@/components/ui-custom/glass-card';

export default function AICopilotCard() {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2">
        🤖
        <h2 className="text-xl font-bold">AI Copilot</h2>
      </div>

      <p className="mt-4 text-slate-600">
        AI Copilot integration is ready. Chat-based trip planning will be enabled in the next phase.
      </p>

      <button
        disabled
        className="
          mt-6
          rounded-xl
          bg-slate-400
          px-4
          py-2
          text-white
          cursor-not-allowed
        "
      >
        Coming Soon
      </button>
    </GlassCard>
  );
}
