'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { usePlannerStore } from '@/features/planner/store/planner.store';
import type { CanvasType, CanvasLifecycleState } from '@/services/planner.types';
import { CANVAS_COLORS } from '@/services/planner.types';

interface CanvasHeaderProps {
  canvasType: CanvasType;
  label: string;
  lifecycleState: CanvasLifecycleState;
}

export default function CanvasHeader({ canvasType, label, lifecycleState }: CanvasHeaderProps) {
  const { closeCanvas, setCanvasState } = usePlannerStore();
  const colors = CANVAS_COLORS[canvasType];

  const toggleFocus = () => {
    setCanvasState(
      canvasType,
      lifecycleState === 'focused' ? 'expanded' : 'focused'
    );
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/40 dark:border-slate-800/40 flex-shrink-0"
      style={{ borderBottomColor: `${colors.accent}20` }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: colors.accent }}
        />
        <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </h3>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleFocus}
          className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-all"
          title={lifecycleState === 'focused' ? 'Minimize' : 'Maximize'}
        >
          {lifecycleState === 'focused' ? (
            <Minimize2 size={12} />
          ) : (
            <Maximize2 size={12} />
          )}
        </button>
        <button
          onClick={() => closeCanvas(canvasType)}
          className="flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
          title="Close canvas"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
