'use client';

import React, { useEffect, useState } from 'react';
import PlannerChat from '@/features/planner/chat/PlannerChat';
import PlannerWorkspace from '@/features/planner/workspace/PlannerWorkspace';
import { AnimatePresence, motion } from 'framer-motion';

export type PlannerMode = 'chat' | 'plan';

export default function PlannerPage() {
  const [mode, setMode] = useState<PlannerMode>('chat');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    const startNewPlan = () => {
      setMode('chat');
      setWorkspaceId(null);
    };

    const openWorkspace = (e: Event) => {
      const { workspaceId: wid, hasPlan } = (e as CustomEvent).detail;
      if (wid) setWorkspaceId(wid);
      setMode(hasPlan ? 'plan' : 'chat');
    };

    window.addEventListener('planner:new-plan', startNewPlan);
    window.addEventListener('planner:open-workspace', openWorkspace);
    return () => {
      window.removeEventListener('planner:new-plan', startNewPlan);
      window.removeEventListener('planner:open-workspace', openWorkspace);
    };
  }, []);

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
            <PlannerChat
              workspaceId={workspaceId}
              onModeChange={(newMode, newWorkspaceId) => {
                if (newWorkspaceId) setWorkspaceId(newWorkspaceId);
                setMode(newMode);
              }}
            />
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
            <PlannerWorkspace workspaceId={workspaceId} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
