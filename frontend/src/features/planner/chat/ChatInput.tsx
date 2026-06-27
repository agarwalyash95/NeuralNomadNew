'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="px-4 py-3 border-t border-slate-100/80 dark:border-slate-800/40 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-end gap-2 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 rounded-2xl px-4 py-2.5 focus-within:border-blue-300 dark:focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30 transition-all">
          <Sparkles size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0 mb-0.5" />

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about your trip..."
            disabled={disabled}
            rows={1}
            className="flex-1 bg-transparent text-[13px] text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none resize-none min-h-[20px] max-h-[120px] leading-relaxed"
          />

          <motion.button
            type="submit"
            disabled={!value.trim() || disabled}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center w-7 h-7 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity flex-shrink-0"
          >
            <Send size={13} />
          </motion.button>
        </div>
      </form>

      <p className="text-[9px] text-center text-slate-300 dark:text-slate-600 mt-2">
        AI responses may be inaccurate. Verify important details.
      </p>
    </div>
  );
}
