'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { FOCUS_RING_CLASS } from '@/lib/utils';
import { AI_ATTRACTION_QUICK_ACTIONS, type AIAttractionActionId } from './services/sightPresentation';
import { AI_ACTIVITY_QUICK_ACTIONS, type AIActivityActionId } from './services/sightPresentation';

type Tab = 'attractions' | 'activities';
type AnyActionId = AIAttractionActionId | AIActivityActionId;

interface AttractionAIActionsRowProps {
  activeTab: Tab;
  active: AnyActionId | null;
  onToggle: (action: AnyActionId) => void;
}

/**
 * Inline AI refinement chips — contextually swaps between attraction and
 * activity actions based on the active tab. Uses emerald for attractions
 * (route/scenic intent) and rose for activities (booking/effort intent) —
 * completely distinct from the restaurant canvas's violet chips.
 */
export default function AttractionAIActionsRow({ activeTab, active, onToggle }: AttractionAIActionsRowProps) {
  const actions =
    activeTab === 'attractions'
      ? AI_ATTRACTION_QUICK_ACTIONS
      : AI_ACTIVITY_QUICK_ACTIONS;

  const activeColor =
    activeTab === 'attractions'
      ? {
          active: 'border-emerald-600 bg-emerald-600 text-white shadow-sm',
          inactive: 'border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100/70',
        }
      : {
          active: 'border-rose-500 bg-rose-500 text-white shadow-sm',
          inactive: 'border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100/70',
        };

  const iconColor = activeTab === 'attractions' ? 'text-emerald-600' : 'text-rose-500';

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      <span className={`flex shrink-0 items-center gap-1 pr-0.5 ${iconColor}`}>
        <Sparkles size={12} className="fill-current" />
      </span>
      {actions.map(({ id, label, emoji }) => {
        const isActive = active === id;
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => onToggle(id as AnyActionId)}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            aria-pressed={isActive}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${FOCUS_RING_CLASS} ${
              isActive ? activeColor.active : activeColor.inactive
            }`}
          >
            <span>{emoji}</span>
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}
