'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, VolumeX, MapPinned, IndianRupee, Clock } from 'lucide-react';
import { FOCUS_RING_CLASS } from '@/lib/utils';
import { AI_QUICK_ACTIONS, type AIQuickActionId } from './services/mealPresentation';

interface AIQuickActionsRowProps {
  active: AIQuickActionId | null;
  onToggle: (action: AIQuickActionId) => void;
}

const ICONS: Record<AIQuickActionId, React.ElementType> = {
  quieter: VolumeX,
  authentic: MapPinned,
  cheaper: IndianRupee,
  open_now: Clock,
};

/**
 * Contextual AI refinements, inline with the results rather than a floating
 * action button — each chip re-sorts/filters the already-computed
 * recommendation list for a specific intent (see mealPresentation.ts).
 * Purple is used here deliberately: this is the one row of controls that's
 * actually AI-directed, everywhere else stays neutral.
 */
export default function AIQuickActionsRow({ active, onToggle }: AIQuickActionsRowProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <span className="flex shrink-0 items-center gap-1 pr-0.5 text-violet-600">
        <Sparkles size={12} className="fill-current" />
      </span>
      {AI_QUICK_ACTIONS.map(({ id, label }) => {
        const Icon = ICONS[id];
        const isActive = active === id;
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => onToggle(id)}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            aria-pressed={isActive}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${FOCUS_RING_CLASS} ${
              isActive
                ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                : 'border-violet-200 bg-violet-50/60 text-violet-700 hover:bg-violet-100/70'
            }`}
          >
            <Icon size={12} />
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}
