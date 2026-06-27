'use client';

import React, { Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { canvasRegistry } from './canvas.registry';
import CanvasHeader from './CanvasHeader';
import type { CanvasType, CanvasLifecycleState } from '@/services/planner.types';

interface ActiveCanvas {
  type: CanvasType;
  state: CanvasLifecycleState;
}

interface CanvasLayoutEngineProps {
  workspaceId: string;
  canvases: ActiveCanvas[];
}

/**
 * Manages the lifecycle and layout of execution canvases.
 * Renders the most recently activated canvas in the split view.
 */
export default function CanvasLayoutEngine({ workspaceId, canvases }: CanvasLayoutEngineProps) {
  // Show the last canvas (most recently activated)
  const activeCanvas = canvases[canvases.length - 1];

  if (!activeCanvas) return null;

  const definition = canvasRegistry[activeCanvas.type];
  if (!definition) return null;

  const CanvasComponent = definition.component;

  return (
    <div className="flex flex-col h-full">
      <CanvasHeader
        canvasType={activeCanvas.type}
        label={definition.label}
        lifecycleState={activeCanvas.state}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeCanvas.type}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="flex-1 overflow-hidden"
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full">
                <motion.div
                  className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            }
          >
            <CanvasComponent workspaceId={workspaceId} />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
