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
  /** 'floating' (default) is the full-screen absolute-positioned bottom bar
   * with a gradient fade; 'docked' is a static, compact layout that fits
   * inside DockedChat's own bordered footer without an absolute overlay. */
  variant?: 'floating' | 'docked';
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
  variant = 'floating',
}: ChatInputProps) {
  const isDocked = variant === 'docked';

  const createPlanButton = (
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
            'mb-2 flex items-center gap-2 rounded-xl transition-all duration-300',
            isDocked ? 'self-end' : 'mr-4',
            isHighlighted
              ? 'bg-gradient-to-r from-[rgb(var(--color-ai))] to-violet-700 px-4 py-2 text-xs font-semibold text-white shadow-hover hover:scale-[1.03]'
              : 'border border-[rgb(var(--color-ai)/0.3)] bg-paper-2/90 px-3.5 py-1.5 text-xs font-medium text-[rgb(var(--color-ai))] shadow-surface backdrop-blur-sm hover:bg-[rgb(var(--color-ai)/0.08)] hover:border-[rgb(var(--color-ai))]',
            isCreatingPlan && 'cursor-wait opacity-75'
          )}
        >
          {isCreatingPlan ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} className={isHighlighted ? 'motion-safe:animate-pulse' : ''} />
          )}
          {isCreatingPlan ? 'Creating...' : 'Create Plan'}
        </motion.button>
      )}
    </AnimatePresence>
  );

  const composer = (
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
        placeholder={isDocked ? 'Ask about this itinerary...' : 'Ask NeuralNomad — flights, hotels, trains, activities, or a full trip…'}
        className={cn(
          'custom-scrollbar w-full resize-none border transition-all placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-ai)/0.15)]',
          isDocked
            ? 'min-h-[52px] max-h-[150px] rounded-[24px] border-line-strong bg-paper-2 py-3 pl-4 pr-12 text-sm text-ink-900 shadow-surface focus:border-[rgb(var(--color-ai))]'
            : 'min-h-[72px] max-h-[200px] rounded-[28px] border-line-strong/80 bg-paper-2/95 py-5 pl-6 pr-16 text-base text-ink-900 shadow-[0_15px_45px_rgba(15,23,42,0.08)] focus:border-[rgb(var(--color-ai))] focus:bg-paper-2'
        )}
        rows={1}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          const max = isDocked ? 150 : 200;
          target.style.height = 'auto';
          target.style.height = `${Math.min(target.scrollHeight, max)}px`;
        }}
      />
      <button
        onClick={handleSubmit}
        className={cn(
          'absolute rounded-2xl transition-all',
          isDocked ? 'bottom-2 right-2 p-1.5' : 'bottom-4 right-4 p-2.5',
          query.trim().length > 0 && !isSending
            ? 'bg-[rgb(var(--color-ai))] text-white shadow-surface hover:bg-violet-700'
            : 'cursor-not-allowed bg-paper-1 text-ink-400'
        )}
        disabled={query.trim().length === 0 || isSending}
      >
        {isSending ? (
          <Loader2 size={isDocked ? 16 : 20} className="animate-spin" />
        ) : (
          <ArrowUp size={isDocked ? 16 : 20} strokeWidth={2.5} />
        )}
      </button>
    </div>
  );

  if (isDocked) {
    return (
      <div className="flex flex-col items-end gap-0">
        {createPlanButton}
        {composer}
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-paper-0 via-paper-0/95 to-transparent px-6 pb-4 pt-12">
      <div className="relative mx-auto flex w-full max-w-4xl flex-col items-end">
        {createPlanButton}
        {composer}
      </div>
    </div>
  );
}
