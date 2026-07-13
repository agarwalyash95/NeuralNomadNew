'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUp, Loader2, Sparkles, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversation } from './hooks/useConversation';
import { WidgetRenderer } from './WidgetRenderer';

export interface DockedChatProps {
  workspaceId: string | null;
  onOpenHelper?: (type: string) => void;
  /** Files a route-optimization proposal instead of a vague chat prompt */
  onOptimizeRoutes?: () => void;
}

/**
 * DockedChat — the SAME conversation thread that built this trip, in a
 * compact docked presentation. One session (useConversation), one widget
 * registry; only the shell differs from the full-screen chat.
 */
export default function DockedChat({ workspaceId, onOpenHelper, onOptimizeRoutes }: DockedChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    query,
    setQuery,
    messages,
    isSending,
    error,
    lastAssistantMessageId,
    handleSubmit,
  } = useConversation({ workspaceId });

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

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
                  <p className="text-caption">
                    The same thread that built this plan
                  </p>
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
              {messages.length === 0 && !isSending && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-line bg-paper-2 px-4 py-3 shadow-surface">
                    <p className="text-body">
                      I can refine the trip plan, compare routes, or help with logistics.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((message) => {
                const isLastAssistant = message.id === lastAssistantMessageId;
                return (
                  <div
                    key={message.id}
                    className={cn(
                      'flex flex-col gap-2',
                      message.role === 'user' ? 'items-end' : 'items-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-body shadow-surface',
                        message.role === 'user'
                          ? 'rounded-tr-md bg-gradient-to-br from-[rgb(var(--color-ai))] to-violet-700 !text-white'
                          : 'rounded-tl-md border border-line bg-paper-2'
                      )}
                    >
                      {message.message}
                    </div>
                    {isLastAssistant && !isSending && Boolean(message.widgets?.length) && (
                      <div className="flex w-full flex-col gap-2">
                        <WidgetRenderer widget={message.widgets![0]!} onSubmit={handleSubmit} />
                      </div>
                    )}
                  </div>
                );
              })}

              {isSending && (
                <div className="flex justify-start">
                  <div className="mr-auto w-fit rounded-2xl rounded-tl-md border border-line bg-paper-2 px-4 py-3 shadow-surface">
                    <div className="flex items-center gap-2 text-ink-400">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-body !text-ink-400">NeuralNomad is thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mr-auto rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body !text-red-700">
                  {error}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="border-t border-line bg-paper-2/75 p-4">
              <div className="group relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask about this itinerary..."
                  className="custom-scrollbar min-h-[52px] max-h-[150px] w-full resize-none rounded-[24px] border border-line-strong bg-paper-2 py-3 pl-4 pr-12 text-body !text-ink-900 shadow-surface transition-all duration-[var(--motion-hover)] ease-[var(--ease-out)] placeholder:text-ink-400 focus:border-[rgb(var(--color-ai))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-ai)/0.15)]"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                  }}
                />
                <button
                  onClick={() => handleSubmit()}
                  aria-label="Send message"
                  className={cn(
                    'absolute bottom-2 right-2 rounded-xl p-1.5 transition-all duration-[var(--motion-hover)] ease-[var(--ease-out)]',
                    query.trim().length > 0 && !isSending
                      ? 'bg-[rgb(var(--color-ai))] text-white shadow-surface hover:bg-violet-700'
                      : 'cursor-not-allowed bg-paper-1 text-ink-400'
                  )}
                  disabled={query.trim().length === 0 || isSending}
                >
                  {isSending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ArrowUp size={18} strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
