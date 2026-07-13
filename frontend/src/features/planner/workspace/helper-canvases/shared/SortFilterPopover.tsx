'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn, FOCUS_RING_CLASS } from '@/lib/utils';

interface SortFilterPopoverProps {
  open: boolean;
  onClose: () => void;
  onReset?: () => void;
  showReset?: boolean;
  children: React.ReactNode;
}

/**
 * Sort/filter surface for the redesigned Helper Canvases — an anchored
 * popover on desktop, a bottom sheet on mobile (via the already-available
 * `useIsMobile` hook). Must be rendered inside a `relative` wrapper that
 * hugs `CanvasSearchToolbar` exactly (desktop positions via `top-full`),
 * the same technique RestaurantsCanvas's own filter dropdown already used
 * before this redesign. Content (Sort + each canvas's real filter fields)
 * is supplied by the caller — this only owns the shell/chrome/animation.
 */
export default function SortFilterPopover({ open, onClose, onReset, showReset, children }: SortFilterPopoverProps) {
  const isMobile = useIsMobile();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn('z-40', isMobile ? 'fixed inset-0 bg-black/30' : 'absolute inset-0')}
            onClick={onClose}
          />
          <motion.div
            key="panel"
            initial={isMobile ? { y: '100%' } : { opacity: 0, y: -6, scale: 0.98 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            role="dialog"
            aria-label="Sort and filter"
            className={cn(
              'z-50 flex flex-col overflow-hidden border border-line bg-white shadow-modal',
              isMobile
                ? 'fixed inset-x-0 bottom-0 max-h-[80vh] rounded-t-3xl'
                : 'absolute right-0 top-full mt-2 max-h-[70vh] w-80 rounded-2xl',
            )}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line/60 px-4 py-3">
              <h3 className="text-[13px] font-bold text-ink-900">Sort &amp; Filter</h3>
              <div className="flex items-center gap-1">
                {showReset && onReset && (
                  <button
                    type="button"
                    onClick={onReset}
                    className={cn('flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-ink-500 hover:bg-paper-0 hover:text-ink-700 cursor-pointer', FOCUS_RING_CLASS)}
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close sort and filter"
                  className={cn('rounded-full p-1.5 text-ink-400 hover:bg-paper-0 hover:text-ink-700 cursor-pointer', FOCUS_RING_CLASS)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
