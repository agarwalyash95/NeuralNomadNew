import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { ChatMessage } from '@/services/planner.types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { WidgetRenderer } from './WidgetRenderer';

interface MessageListProps {
  messages: ChatMessage[];
  lastAssistantMessageId?: string;
  isSending: boolean;
  error: string | null;
  intentDisplay?: { icon: React.ReactNode; label: string } | null;
  visitPurpose?: string | null;
  PURPOSE_LABELS: Record<string, string>;
  openExplanations: Record<string, boolean>;
  setOpenExplanations: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSubmitWidget: (message: string, structuredValue: any) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}

export function MessageList({
  messages,
  lastAssistantMessageId,
  isSending,
  error,
  intentDisplay,
  visitPurpose,
  PURPOSE_LABELS,
  openExplanations,
  setOpenExplanations,
  onSubmitWidget,
  bottomRef,
}: MessageListProps) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-3">
      {/* Intent + Purpose badge strip */}
      {intentDisplay && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-1 flex items-center gap-2 flex-wrap"
        >
          <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
            {intentDisplay.icon}
            <span className="font-bold text-slate-700">{intentDisplay.label}</span>
          </span>
          {visitPurpose && PURPOSE_LABELS[visitPurpose] && (
            <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11px] font-semibold text-indigo-600">
              {PURPOSE_LABELS[visitPurpose]}
            </span>
          )}
        </motion.div>
      )}

      {messages.map((message) => {
        const isAssistant = message.role === 'assistant';
        const hasConfidence = isAssistant && message.metadata && typeof message.metadata.confidence_score === 'number';
        const score = hasConfidence ? (message.metadata?.confidence_score as number) : null;
        const explanation = hasConfidence ? (message.metadata?.confidence_explanation as string) : null;
        const isLastAssistant = message.id === lastAssistantMessageId;

        // 1. Badge Node — trip-detail completeness (deterministic slot fill, not model confidence)
        const badgeNode = isLastAssistant && hasConfidence && score !== null ? (
          <div className="mr-auto ml-1 mt-2 -mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <Sparkles size={11} className="text-indigo-500" />
            <span>Trip details</span>
            <span className="inline-flex items-center justify-center rounded-full border border-indigo-100/60 bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-indigo-600 shadow-sm">
              {score}% complete
            </span>
            {explanation && (
              <button
                type="button"
                onClick={() => setOpenExplanations(prev => ({ ...prev, [message.id]: !prev[message.id] }))}
                className="ml-1 cursor-pointer text-[10px] font-semibold text-indigo-500 underline transition-all hover:text-indigo-600"
              >
                {openExplanations[message.id] ? 'Hide' : 'See what’s missing'}
              </button>
            )}
          </div>
        ) : undefined;

        // 2. Explanation Node (AI Coach Tips)
        const explanationNode = isAssistant && openExplanations[message.id] && explanation ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mr-auto w-full max-w-[82%] rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 text-xs text-indigo-800 backdrop-blur-sm"
          >
            <div className="flex items-start gap-2">
              <span className="text-sm">💡</span>
              <p className="leading-relaxed">
                <span className="font-bold text-indigo-700">Trip Planner Coach: </span>
                {explanation}
              </p>
            </div>
          </motion.div>
        ) : undefined;

        // 3. Widget Node
        const widgetNode = isLastAssistant && !isSending && Boolean(message.widgets && message.widgets.length > 0) ? (
          <AnimatePresence>
            <motion.div
              key={message.id + '-widget'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2"
            >
              <WidgetRenderer widget={message.widgets![0]!} onSubmit={onSubmitWidget} />
            </motion.div>
          </AnimatePresence>
        ) : undefined;

        return (
          <MessageBubble
            key={message.id}
            id={message.id}
            role={message.role}
            content={message.message}
            badge={badgeNode}
            explanation={explanationNode}
            widget={widgetNode}
          />
        );
      })}

      {/* Typing indicator */}
      {isSending && <TypingIndicator />}

      {/* Error */}
      {error && (
        <div className="mr-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
