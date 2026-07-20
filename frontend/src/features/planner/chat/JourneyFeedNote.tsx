import React from 'react';
import { motion } from 'framer-motion';

/**
 * Ambient "Did you know…" note (backend/apps/planner/services/intelligence/
 * journey_feed.py) — occasional delight during planning, never a question,
 * never an action. Deliberately small and muted so it reads as a passing
 * aside, distinct from message bubbles and widget/capability cards.
 */
export function JourneyFeedNote({ fact }: { fact: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="mr-auto ml-1 flex max-w-[80%] items-start gap-1.5 py-0.5 text-[11px] italic text-ink-400"
    >
      <span>💡</span>
      <span>Did you know… {fact}</span>
    </motion.div>
  );
}
