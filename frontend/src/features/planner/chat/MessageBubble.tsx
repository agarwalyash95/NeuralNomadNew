import React from 'react';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  badge?: React.ReactNode;
  explanation?: React.ReactNode;
  widget?: React.ReactNode;
}

export function MessageBubble({
  role,
  content,
  badge,
  explanation,
  widget,
}: MessageBubbleProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      {badge}

      <div
        className={cn(
          'max-w-[88%] rounded-[22px] px-4 py-3.5 text-[13.5px] shadow-[0_10px_30px_rgba(15,23,42,0.06)] lg:max-w-[78%]',
          role === 'user'
            ? 'ml-auto bg-gradient-to-br from-[rgb(var(--color-ai))] to-violet-700 !text-white'
            : 'mr-auto border border-line/70 bg-paper-2 whitespace-pre-wrap leading-relaxed text-ink-800'
        )}
      >
        {content}
      </div>

      {explanation}
      {widget}
    </div>
  );
}
