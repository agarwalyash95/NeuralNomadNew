import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/services/planner.types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { WidgetRenderer } from './WidgetRenderer';
import { JourneyFeedNote } from './JourneyFeedNote';
import { CapabilityRenderer, type CapabilityData } from './capabilities/CapabilityCards';

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
  onConfirmAndGenerate: () => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  /** Pinning (docs/conversation-capability-layer.md §2.5) — optional; omit to render capability cards without pin controls. */
  pinnedKeys?: Set<string>;
  onTogglePin?: (capability: CapabilityData) => void;
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
  onConfirmAndGenerate,
  bottomRef,
  pinnedKeys,
  onTogglePin,
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
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-3 py-1 text-[11px] font-semibold text-ink-500 shadow-surface">
            {intentDisplay.icon}
            <span className="font-bold text-ink-700">{intentDisplay.label}</span>
          </span>
          {visitPurpose && PURPOSE_LABELS[visitPurpose] && (
            <span className="rounded-full border border-[rgb(var(--color-ai)/0.2)] bg-[rgb(var(--color-ai)/0.08)] px-3 py-1 text-[11px] font-semibold text-[rgb(var(--color-ai))]">
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
        const factors = hasConfidence
          ? ((message.metadata?.confidence_factors as { label: string; state: string }[] | undefined) || [])
          : [];
        const pendingClusters = hasConfidence
          ? ((message.metadata?.pending_clusters as string[] | undefined) || [])
          : [];
        const isLastAssistant = message.id === lastAssistantMessageId;

        // 1. Badge Node — trip-detail completeness (deterministic slot fill, not model confidence)
        const badgeNode = isLastAssistant && hasConfidence && score !== null ? (
          <div className="mr-auto ml-1 mt-2 -mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
            <Sparkles size={11} className="text-[rgb(var(--color-ai))]" />
            <span>Trip details</span>
            <span className="inline-flex items-center justify-center rounded-full border border-[rgb(var(--color-ai)/0.2)] bg-[rgb(var(--color-ai)/0.08)] px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-[rgb(var(--color-ai))] shadow-surface">
              {score}% complete
            </span>
            {pendingClusters.length > 0 && (
              <span className="text-ink-400 normal-case tracking-normal">
                · {pendingClusters.length} step{pendingClusters.length === 1 ? '' : 's'} left
              </span>
            )}
            {(explanation || factors.length > 0) && (
              <button
                type="button"
                onClick={() => setOpenExplanations(prev => ({ ...prev, [message.id]: !prev[message.id] }))}
                className="ml-1 cursor-pointer text-[10px] font-semibold text-[rgb(var(--color-ai))] underline transition-all hover:opacity-80"
              >
                {openExplanations[message.id] ? 'Hide' : 'See what’s missing'}
              </button>
            )}
          </div>
        ) : undefined;

        // 2. Explanation Node (AI Coach Tip + ✓/• factor checklist)
        const explanationNode = isAssistant && openExplanations[message.id] && (explanation || factors.length > 0) ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mr-auto w-full max-w-[82%] rounded-xl border border-[rgb(var(--color-ai)/0.2)] bg-[rgb(var(--color-ai)/0.05)] p-3 text-xs text-ink-700 backdrop-blur-sm"
          >
            {explanation && (
              <div className="flex items-start gap-2">
                <span className="text-sm">💡</span>
                <p className="leading-relaxed">
                  <span className="font-bold text-[rgb(var(--color-ai))]">Trip Planner Coach: </span>
                  {explanation}
                </p>
              </div>
            )}
            {factors.length > 0 && (
              <div className={cn('flex flex-wrap gap-x-3 gap-y-1.5', explanation && 'mt-2 border-t border-line/60 pt-2')}>
                {factors.map(f => (
                  <span
                    key={f.label}
                    className={cn(
                      'flex items-center gap-1 text-[11px] font-semibold',
                      f.state === 'confirmed' && 'text-emerald-600',
                      f.state === 'inferred' && 'text-amber-600',
                      f.state === 'missing' && 'text-ink-400'
                    )}
                  >
                    {f.state === 'confirmed' ? <Check size={11} /> : <Circle size={6} className="fill-current" />}
                    {f.label}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ) : undefined;

        // 3. Widget Node
        const widgetNode = !isSending && Boolean(message.widgets && message.widgets.length > 0) ? (
          <AnimatePresence>
            <motion.div
              key={message.id + '-widget-container'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3"
            >
              {message.widgets?.map((wd, wIdx) => (
                <WidgetRenderer
                  key={`${message.id}-widget-${wIdx}`}
                  widget={wd}
                  onSubmit={onSubmitWidget}
                  onConfirmAndGenerate={onConfirmAndGenerate}
                  isCompleted={!isLastAssistant}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        ) : undefined;

        // 4. Capability Node — browse/live results (search/weather/forex/etc),
        // additive alongside the widget above; never gated to "last message
        // only" since results are worth keeping visible in the transcript.
        // "trip_progress" is deliberately excluded here — it used to
        // reappear as a fresh inline card on every cluster/slot turn
        // ("Your trip so far" showing up repeatedly through the whole
        // conversation). It now lives in a single persistent horizontal
        // strip above the message list (see TripProgressStrip) that just
        // updates in place instead of accumulating in the chat history.
        const capabilities = ((message.metadata as any)?.capabilities as CapabilityData[] | undefined)?.filter(
          (c) => c.cap !== 'trip_progress'
        );
        const capabilityNode =
          isAssistant && capabilities && capabilities.length > 0 ? (
            <CapabilityRenderer capabilities={capabilities} pinnedKeys={pinnedKeys} onTogglePin={onTogglePin} />
          ) : undefined;

        // 5. Journey Feed — ambient "Did you know…" note (never a question,
        // never an action); only on the last assistant turn so it doesn't
        // clutter history on re-render.
        const journeyFact = (message.metadata as any)?.journey_fact as { fact: string } | undefined;
        const journeyFactNode =
          isAssistant && isLastAssistant && journeyFact?.fact ? <JourneyFeedNote fact={journeyFact.fact} /> : undefined;

        return (
          <MessageBubble
            key={message.id}
            id={message.id}
            role={message.role}
            content={message.message}
            badge={badgeNode}
            explanation={explanationNode}
            widget={
              widgetNode || capabilityNode || journeyFactNode ? (
                <>
                  {capabilityNode}
                  {widgetNode}
                  {journeyFactNode}
                </>
              ) : undefined
            }
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
