'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, ArrowUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { plannerService } from '@/services/planner.service';
import type { ChatMessage } from '@/services/planner.types';
import { ChatWidget } from './ChatWidgets';

export interface FloatingChatProps {
  workspaceId: string | null;
}

export default function FloatingChat({ workspaceId }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && workspaceId) {
      plannerService.listMessages(workspaceId)
        .then(res => setMessages(res))
        .catch(err => console.error('Failed to load messages:', err));
    }
  }, [isOpen, workspaceId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = async (overrideMessage?: string, structuredValue?: any) => {
    const message = typeof overrideMessage === 'string' ? overrideMessage : query.trim();
    if ((!message && !structuredValue) || isSending || !workspaceId) return;

    setIsSending(true);
    if (typeof overrideMessage !== 'string') setQuery('');

    // Optimistic user message
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      message: message,
      widgets: [],
      commands: [],
      created_at: new Date().toISOString()
    }]);

    try {
      const response = await plannerService.sendMessage(workspaceId, message, structuredValue);
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        response.user_message,
        response.assistant_message
      ]);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setQuery(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="group absolute bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800/10 bg-slate-900 text-white shadow-lg transition-colors hover:bg-slate-800"
          >
            <MessageSquare size={22} className="transition-transform group-hover:scale-110" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute bottom-6 right-6 z-50 flex h-[80vh] max-h-[600px] w-[380px] flex-col overflow-hidden rounded-[28px] border border-[#d9d4c7] bg-[#fbfaf7]/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-[#e5dfd2] bg-white/70 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <MessageSquare size={16} />
                </div>
                <h3 className="font-semibold text-slate-800">NeuralNomad</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#fbfaf7_0%,#f8f6f0_100%)] p-5">
              {messages.length === 0 && !isSending && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-[#e5dfd2] bg-white px-4 py-3 shadow-sm">
                    <p className="text-sm text-slate-700">
                      I can refine the trip plan, compare routes, or help with logistics.
                    </p>
                  </div>
                </div>
              )}
              {messages.map((message) => (
                <div key={message.id} className={cn('flex flex-col gap-2', message.role === 'user' ? 'items-end' : 'items-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 shadow-sm text-sm whitespace-pre-wrap',
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-md'
                      : 'border border-[#e5dfd2] bg-white text-slate-700 rounded-tl-md'
                  )}>
                    {message.message}
                  </div>
                  {Boolean(message.widgets && message.widgets.length > 0) && (
                    <div className="flex flex-col gap-2 w-full">
                      {message.widgets!.map((widget, i) => (
                        <ChatWidget key={i} widget={widget} onSubmit={handleSubmit} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="mr-auto w-fit rounded-2xl rounded-tl-md border border-[#e5dfd2] bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">NeuralNomad is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-[#e5dfd2] bg-white/75 p-4">
              <div className="group relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Ask about this itinerary..."
                  className="custom-scrollbar min-h-[52px] max-h-[150px] w-full resize-none rounded-[24px] border border-[#d9d4c7] bg-white py-3 pl-4 pr-12 text-sm text-slate-900 shadow-sm transition-all placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                  }}
                />
                <button
                  onClick={() => handleSubmit()}
                  className={cn(
                    'absolute bottom-2 right-2 rounded-xl p-1.5 transition-all',
                    query.trim().length > 0 && !isSending
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  )}
                  disabled={query.trim().length === 0 || isSending}
                >
                  {isSending ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
