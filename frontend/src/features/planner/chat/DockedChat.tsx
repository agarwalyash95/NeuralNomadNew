'use client';

import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Bot } from 'lucide-react';
import { useConversation } from './hooks/useConversation';
import { useChatScroll } from './hooks/useChatScroll';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TripProgressStrip } from './TripProgressStrip';
import { usePinnedCapabilities } from './capabilities/usePinnedCapabilities';
import { PinnedRail } from './capabilities/PinnedRail';
import { PlanningSummaryCard } from './widgets';
import PlanLoadingScreen from './PlanLoadingScreen';

export interface DockedChatProps {
  workspaceId: string | null;
  onOpenHelper?: (type: string) => void;
  /** Files a route-optimization proposal instead of a vague chat prompt */
  onOptimizeRoutes?: () => void;
}

/**
 * DockedChat — the SAME conversation thread that built this trip, in a
 * compact docked presentation. One session (useConversation), one widget
 * registry, and now the SAME message/input components as the full-screen
 * chat (MessageList/ChatInput) — only the FAB/panel shell differs. Fixes
 * the prior hand-rolled bubble/composer duplication, which meant this
 * surface never got the confidence checklist, Journey Feed notes, or
 * multi-widget rendering that landed in MessageList.
 */
export default function DockedChat({ workspaceId, onOpenHelper, onOptimizeRoutes }: DockedChatProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    query,
    setQuery,
    workspace,
    messages,
    readyForPlan,
    isSending,
    isCreatingPlan,
    generationJob,
    suggestedReplies,
    tripProgress,
    error,
    confidenceScore,
    visitPurpose,
    openExplanations,
    setOpenExplanations,
    lastAssistantMessageId,
    handleSubmit,
    handleCreatePlan,
    handleConfirmAndGenerate,
    handleRetryGeneration,
  } = useConversation({ workspaceId });
  const { pinned, pinnedKeys, togglePin } = usePinnedCapabilities();
  const bottomRef = useChatScroll([messages, isSending]);

  const destination = workspace?.draft_state?.destination_text;
  const startD = workspace?.draft_state?.start_date ? new Date(workspace.draft_state.start_date) : undefined;
  const endD = workspace?.draft_state?.end_date ? new Date(workspace.draft_state.end_date) : undefined;
  const durationDays = startD && endD ? Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)) + 1) : undefined;
  const travelersCount = (workspace?.draft_state?.adults || 1) + (workspace?.draft_state?.children || 0);
  const budgetText = workspace?.draft_state?.metadata?.budget_inr
    ? `₹${workspace.draft_state.metadata.budget_inr.toLocaleString()}`
    : workspace?.draft_state?.budget_tier;

  const isMandatoryComplete = readyForPlan;
  const isHighlighted = isMandatoryComplete && confidenceScore >= 85;

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            aria-label="Open trip conversation"
            className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[rgb(var(--color-ai))] to-violet-700 text-white shadow-modal transition-transform duration-[var(--motion-hover)] ease-[var(--ease-out)] hover:scale-105"
          >
            <Sparkles size={24} className="transition-transform duration-[var(--motion-hover)] ease-[var(--ease-out)] group-hover:scale-110" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed bottom-0 right-0 top-16 z-50 flex w-[400px] max-w-full flex-col overflow-hidden border-l border-line bg-paper-1 shadow-modal"
          >
            <div className="flex items-center justify-between border-b border-line bg-paper-2/70 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-[rgb(var(--color-ai))] to-violet-700 text-white shadow-surface">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="text-title">Trip conversation</h3>
                  <p className="text-caption">The same thread that built this plan</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close trip conversation"
                className="rounded-xl p-1.5 text-ink-400 transition-colors duration-[var(--motion-hover)] ease-[var(--ease-out)] hover:bg-paper-1 hover:text-ink-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick refine actions */}
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-b border-line/70 bg-paper-2/40 px-3 py-2">
              {[
                { label: '⚡ Optimize Routes', action: 'optimize' },
                { label: '🍽️ Local Foodie Spots', panel: 'restaurants' },
                { label: '🏄 Add Activities', panel: 'activities' },
                { label: '🏨 Change Hotel', panel: 'hotel' },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => {
                    if (chip.action === 'optimize' && onOptimizeRoutes) {
                      onOptimizeRoutes();
                      setIsOpen(false);
                    } else if (chip.panel && onOpenHelper) {
                      onOpenHelper(chip.panel);
                      setIsOpen(false);
                    }
                  }}
                  className="shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-[rgb(var(--color-ai)/0.3)] bg-[rgb(var(--color-ai)/0.08)] px-2.5 py-1 text-caption font-bold !text-[rgb(var(--color-ai))] shadow-surface transition-all duration-[var(--motion-hover)] ease-[var(--ease-out)] hover:border-[rgb(var(--color-ai))] hover:bg-[rgb(var(--color-ai))] hover:!text-white"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Thread */}
            <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
              <TripProgressStrip tripProgress={tripProgress} />
              <PinnedRail pinned={pinned} onTogglePin={togglePin} />

              <PlanningSummaryCard workspace={workspace} />

              {isCreatingPlan && (
                <PlanLoadingScreen
                  job={generationJob}
                  destination={destination}
                  durationDays={durationDays}
                  travelersCount={travelersCount}
                  budgetText={budgetText}
                  inline={true}
                  onRetry={handleRetryGeneration}
                />
              )}

              {messages.length === 0 && !isSending && !isCreatingPlan && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-line bg-paper-2 px-4 py-3 shadow-surface">
                    <p className="text-body">I can refine the trip plan, compare routes, or help with logistics.</p>
                  </div>
                </div>
              )}

              {messages.length > 0 && (
                <MessageList
                  messages={messages}
                  lastAssistantMessageId={lastAssistantMessageId}
                  isSending={isSending}
                  error={error}
                  intentDisplay={null}
                  visitPurpose={visitPurpose}
                  PURPOSE_LABELS={{}}
                  openExplanations={openExplanations}
                  setOpenExplanations={setOpenExplanations}
                  onSubmitWidget={handleSubmit}
                  onConfirmAndGenerate={handleConfirmAndGenerate}
                  bottomRef={bottomRef}
                  pinnedKeys={pinnedKeys}
                  onTogglePin={togglePin}
                />
              )}
            </div>

            {/* Proactive next-step chips */}
            {suggestedReplies.length > 0 && !isSending && (
              <div className="flex w-full flex-wrap items-center gap-2 border-t border-line/70 bg-paper-2/40 px-4 pt-2">
                {suggestedReplies.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => (chip.startsWith('Create my plan') ? handleCreatePlan() : handleSubmit(chip))}
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold transition-all active:scale-95 cursor-pointer ${
                      chip.startsWith('Create my plan')
                        ? 'border-[rgb(var(--color-ai)/0.3)] bg-gradient-to-r from-[rgb(var(--color-ai))] to-violet-700 text-white shadow-surface hover:shadow-hover'
                        : 'border-line-strong bg-paper-2 text-ink-700 hover:border-[rgb(var(--color-ai)/0.4)] hover:bg-[rgb(var(--color-ai)/0.08)] hover:text-[rgb(var(--color-ai))]'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Composer (relative, not absolute — the docked panel is already a fixed-height flex column) */}
            <div className="relative border-t border-line bg-paper-2/75 p-4">
              <ChatInput
                query={query}
                setQuery={setQuery}
                isSending={isSending}
                isMandatoryComplete={isMandatoryComplete}
                isHighlighted={isHighlighted}
                isCreatingPlan={isCreatingPlan}
                handleCreatePlan={handleCreatePlan}
                handleSubmit={handleSubmit}
                textareaRef={textareaRef}
                variant="docked"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
