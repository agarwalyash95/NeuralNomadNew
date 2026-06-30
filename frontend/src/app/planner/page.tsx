'use client';

import React, { useState } from 'react';
import PlannerChat from '@/features/planner/chat/PlannerChat';
import PlannerWorkspace from '@/features/planner/workspace/PlannerWorkspace';
import FloatingChat from '@/features/planner/chat/FloatingChat';
import { AnimatePresence, motion } from 'framer-motion';

export type PlannerMode = 'chat' | 'plan';

export default function PlannerPage() {
  const [mode, setMode] = useState<PlannerMode>('chat');

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#f6f4ef]">
      <AnimatePresence mode="wait">
        {mode === 'chat' ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="absolute inset-0"
          >
            <PlannerChat onModeChange={setMode} />
          </motion.div>
        ) : (
          <motion.div
            key="plan"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="absolute inset-0 flex"
          >
            <PlannerWorkspace />
            <FloatingChat />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
