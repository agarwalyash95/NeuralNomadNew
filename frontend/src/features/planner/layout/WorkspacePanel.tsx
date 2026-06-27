'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlannerStore } from '@/features/planner/store/planner.store';
import PlanCanvas from '@/features/planner/canvas/plan/PlanCanvas';
import CanvasLayoutEngine from '@/features/planner/canvas/CanvasLayoutEngine';

interface WorkspacePanelProps {
  workspaceId: string;
}

export default function WorkspacePanel({ workspaceId }: WorkspacePanelProps) {
  const activeCanvases = usePlannerStore((s) => s.activeCanvases);

  // Filter out plan canvas (it's always primary)
  const executionCanvases = activeCanvases.filter((c) => c.type !== 'plan');
  const hasExecutionCanvas = executionCanvases.length > 0;

  return (
    <div className="flex h-full">
      {/* ─── Plan Canvas (always primary) ──── */}
      <motion.div
        className={`overflow-hidden ${hasExecutionCanvas ? 'w-1/2 border-r border-slate-200/40 dark:border-slate-800/40' : 'w-full'}`}
        layout
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      >
        <PlanCanvas workspaceId={workspaceId} />
      </motion.div>

      {/* ─── Execution Canvas (split view) ─── */}
      <AnimatePresence mode="wait">
        {hasExecutionCanvas && (
          <motion.div
            key="execution"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '50%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <CanvasLayoutEngine
              workspaceId={workspaceId}
              canvases={executionCanvases}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
