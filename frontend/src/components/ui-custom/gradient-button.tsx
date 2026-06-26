'use client';

import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export default function GradientButton({ children, className, ...props }: GradientButtonProps) {
  return (
    <button
      className={cn(
        `
        inline-flex
        items-center
        justify-center
        rounded-2xl
        px-6
        py-3
        font-medium
        text-white
        transition-all
        duration-300
        bg-gradient-to-r
        from-blue-600
        via-violet-600
        to-purple-600
        hover:scale-[1.02]
        hover:shadow-xl
        active:scale-[0.98]
        `,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
