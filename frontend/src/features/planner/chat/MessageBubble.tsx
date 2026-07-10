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
          'max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm',
          role === 'user'
            ? 'ml-auto bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
            : 'mr-auto border border-[#e5dfd2] bg-white text-slate-700 whitespace-pre-wrap leading-relaxed'
        )}
      >
        {content}
      </div>

      {explanation}
      {widget}
    </div>
  );
}
