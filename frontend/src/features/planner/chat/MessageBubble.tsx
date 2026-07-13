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
          'max-w-[82%] rounded-2xl px-4 py-3 text-body shadow-surface',
          role === 'user'
            ? 'ml-auto bg-gradient-to-br from-[rgb(var(--color-ai))] to-violet-700 !text-white'
            : 'mr-auto border border-line bg-paper-2 whitespace-pre-wrap leading-relaxed'
        )}
      >
        {content}
      </div>

      {explanation}
      {widget}
    </div>
  );
}
