import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WidgetHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  aiConfidence?: number;
  aiRecommendation?: string;
  stepLabel?: string;
  stepHint?: string;
}

export interface WidgetContainerProps {
  header: WidgetHeaderProps;
  isCompleted?: boolean;
  onEdit?: () => void;
  onConfirm?: () => void;
  onSkip?: () => void;
  summaryNode?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function WidgetContainer({
  header,
  isCompleted,
  onEdit,
  onConfirm,
  onSkip,
  summaryNode,
  children,
  className,
}: WidgetContainerProps) {
  // Completed state — minimal pill summary
  if (isCompleted && summaryNode) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mr-auto mt-1 flex w-full max-w-[320px] items-center justify-between gap-2 rounded-2xl border border-line/60 bg-paper-1/80 px-3 py-2 shadow-sm animate-fade-in"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-600">
          {header.icon && <span className="text-ink-400">{header.icon}</span>}
          <span className="text-ink-400">{header.title}:</span>
          <span className="text-ink-800">{summaryNode}</span>
        </div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-400 transition-colors hover:bg-paper-2 hover:text-ink-700"
          >
            <Edit2 size={8} />
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'mr-auto mt-1.5 flex w-full max-w-[320px] flex-col gap-2.5 rounded-2xl border border-line/70 bg-paper-2 p-3 shadow-sm',
        className
      )}
    >
      {/* Minimal header — just icon + title, no subtitle/confidence clutter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-ink-700">
          {header.icon && <span className="text-ink-500">{header.icon}</span>}
          <span>{header.title}</span>
        </div>
        {/* Only show AI recommendation as a tiny inline hint, not a full banner */}
        {header.aiRecommendation && (
          <span className="flex items-center gap-0.5 text-[9px] font-semibold text-ink-400">
            <Sparkles size={8} className="text-violet-400" />
            AI pick
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2">{children}</div>

      {/* Actions — skip on left, confirm on right */}
      {!isCompleted && (onConfirm || onSkip) && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {onSkip ? (
            <button
              onClick={onSkip}
              className="text-[10px] font-semibold text-ink-400 transition-colors hover:text-ink-600"
            >
              Skip
            </button>
          ) : (
            <div />
          )}
          {onConfirm && (
            <button
              onClick={onConfirm}
              className="flex items-center gap-1 rounded-xl bg-ink-900 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-ink-700 active:scale-95"
            >
              <Check size={11} /> Done
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
