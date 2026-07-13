import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  isSending: boolean;
  isMandatoryComplete: boolean;
  isHighlighted: boolean;
  isCreatingPlan: boolean;
  handleCreatePlan: () => void;
  handleSubmit: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatInput({
  query,
  setQuery,
  isSending,
  isMandatoryComplete,
  isHighlighted,
  isCreatingPlan,
  handleCreatePlan,
  handleSubmit,
  textareaRef,
}: ChatInputProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-paper-0 via-paper-0/95 to-transparent px-6 pb-4 pt-12">
      <div className="relative mx-auto w-full max-w-4xl flex flex-col items-end">
        {/* Create Plan button — relative position, state-based styling */}
        <AnimatePresence>
          {isMandatoryComplete && (
            <motion.button
              key="create-plan-btn"
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88, y: 8 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              onClick={handleCreatePlan}
              disabled={isCreatingPlan}
              title={isHighlighted ? undefined : 'You can create the plan now, or keep refining details'}
              className={cn(
                'mb-2.5 flex items-center gap-2 rounded-xl transition-all duration-300 mr-4',
                isHighlighted
                  ? 'bg-gradient-to-r from-[rgb(var(--color-ai))] to-violet-700 px-5 py-2.5 text-sm font-semibold text-white shadow-hover hover:scale-[1.03]'
                  : 'border border-[rgb(var(--color-ai)/0.3)] bg-paper-2/90 px-4 py-2 text-sm font-medium text-[rgb(var(--color-ai))] shadow-surface backdrop-blur-sm hover:bg-[rgb(var(--color-ai)/0.08)] hover:border-[rgb(var(--color-ai))]',
                isCreatingPlan && 'cursor-wait opacity-75'
              )}
            >
              {isCreatingPlan ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} className={isHighlighted ? 'motion-safe:animate-pulse' : ''} />
              )}
              {isCreatingPlan ? 'Creating...' : 'Create Plan'}
            </motion.button>
          )}
        </AnimatePresence>

        <div className="group relative w-full">
        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // isComposing guards IME input (Japanese/Chinese/Korean) — Enter
            // during composition selects a character, it must not send
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask NeuralNomad — flights, hotels, trains, activities, or a full trip…"
          className="custom-scrollbar min-h-[72px] max-h-[200px] w-full resize-none rounded-[28px] border border-line-strong bg-paper-2 py-5 pl-6 pr-16 text-base text-ink-900 shadow-modal transition-all placeholder:text-ink-400 focus:border-[rgb(var(--color-ai))] focus:bg-paper-2 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-ai)/0.15)]"
          rows={1}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
          }}
        />
        <button
          onClick={handleSubmit}
          className={cn(
            'absolute bottom-4 right-4 rounded-2xl p-2.5 transition-all',
            query.trim().length > 0 && !isSending
              ? 'bg-[rgb(var(--color-ai))] text-white shadow-surface hover:bg-violet-700'
              : 'cursor-not-allowed bg-paper-1 text-ink-400'
          )}
          disabled={query.trim().length === 0 || isSending}
        >
          {isSending ? <Loader2 size={20} className="animate-spin" /> : <ArrowUp size={20} strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  </div>
);
}
