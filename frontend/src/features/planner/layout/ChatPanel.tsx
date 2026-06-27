'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Bot, User } from 'lucide-react';
import { useMessages, useSendMessage } from '@/hooks/use-planner';
import ChatInput from '@/features/planner/chat/ChatInput';
import WidgetRenderer from '@/features/planner/chat/WidgetRenderer';
import type { ChatMessage } from '@/services/planner.types';
import { usePlannerStore } from '@/features/planner/store/planner.store';

interface ChatPanelProps {
  workspaceId: string;
}

export default function ChatPanel({ workspaceId }: ChatPanelProps) {
  const { data: messages, isLoading } = useMessages(workspaceId);
  const sendMutation = useSendMessage(workspaceId);
  const isSending = usePlannerStore((s) => s.isSending);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleSend = (message: string) => {
    sendMutation.mutate(message);
  };

  return (
    <div className="flex flex-col h-full bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
      {/* ─── Header ──────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100/80 dark:border-slate-800/40">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 shadow-sm">
          <Sparkles className="text-white" size={13} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">AI Planner</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Your travel assistant</p>
        </div>
      </div>

      {/* ─── Messages ────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar"
      >
        {/* Welcome message if no messages */}
        {!isLoading && (!messages || messages.length === 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-12 px-4"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/30 dark:to-blue-900/30 mb-4">
              <Bot className="text-violet-500" size={22} />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Let&apos;s build your trip
            </h3>
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 max-w-[240px] leading-relaxed">
              Tell me where you want to go, your dates, budget, and preferences. I&apos;ll create your perfect journey.
            </p>
          </motion.div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-lg w-3/4 animate-pulse" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-lg w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Message list */}
        <AnimatePresence initial={false}>
          {messages?.map((msg: ChatMessage, idx: number) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.02 }}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`
                  flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 mt-0.5
                  ${msg.role === 'user'
                    ? 'bg-slate-900 dark:bg-white'
                    : 'bg-gradient-to-br from-violet-500 to-blue-500'
                  }
                `}
              >
                {msg.role === 'user' ? (
                  <User size={12} className="text-white dark:text-slate-900" />
                ) : (
                  <Bot size={12} className="text-white" />
                )}
              </div>

              {/* Message bubble */}
              <div
                className={`
                  max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-br-md'
                    : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 rounded-bl-md'
                  }
                `}
              >
                <p className="whitespace-pre-wrap">{msg.message}</p>

                {/* Widgets */}
                {msg.widgets && msg.widgets.length > 0 && (
                  <div className="mt-2.5 space-y-2">
                    {msg.widgets.map((widget, wIdx) => (
                      <WidgetRenderer
                        key={wIdx}
                        widget={widget}
                        workspaceId={workspaceId}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isSending && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2.5"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex-shrink-0">
              <Bot size={12} className="text-white" />
            </div>
            <div className="bg-slate-100/80 dark:bg-slate-800/60 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ─── Input ───────────────────────────── */}
      <ChatInput onSend={handleSend} disabled={isSending} />
    </div>
  );
}
