'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

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
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-[#e5dfd2] bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm text-slate-700">
                    I can refine the trip plan, compare routes, or help with logistics.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#e5dfd2] bg-white/75 p-4">
              <div className="group relative">
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
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
                  className={cn(
                    'absolute bottom-2 right-2 rounded-xl p-1.5 transition-all',
                    query.trim().length > 0
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400'
                  )}
                  disabled={query.trim().length === 0}
                >
                  <ArrowUp size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
