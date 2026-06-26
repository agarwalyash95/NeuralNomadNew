'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { SeasonalInsight } from '@/services/homepage.service';

interface SmartInsightsBarProps {
  insight: SeasonalInsight | null;
}

export default function SmartInsightsBar({ insight }: SmartInsightsBarProps) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nn_insights_dismissed') === '1';
    }
    return false;
  });

  if (dismissed || !insight) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('nn_insights_dismissed', '1');
  };

  return (
    <div className="relative rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 px-5 py-3 flex items-center justify-between gap-4">
      <p className="text-sm text-slate-700 font-medium leading-relaxed flex-1">
        {insight.tip_text}
      </p>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-blue-100 transition-colors"
        aria-label="Dismiss insight"
      >
        <X size={14} />
      </button>
    </div>
  );
}
