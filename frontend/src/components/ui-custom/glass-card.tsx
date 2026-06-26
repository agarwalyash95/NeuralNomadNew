import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export default function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div
      className={cn(
        `
        rounded-3xl
        border
        border-white/30
        bg-white/70
        backdrop-blur-xl
        shadow-lg
        `,
        className
      )}
    >
      {children}
    </div>
  );
}
