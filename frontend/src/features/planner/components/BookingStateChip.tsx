'use client';

import React from 'react';
import { CheckCircle2, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BlockStatus } from '../workspace/plan-canvas/types';

/**
 * BookingStateChip — the one "is this actually booked?" grammar, separate
 * from ProvenanceBadge (which is about price *trust*, not commitment state).
 * A block can be booked with an estimated cost basis, or priced with a
 * verified one — the two questions are independent.
 *
 * 'planned'/'idea' render nothing — that's the default, expected state for
 * most of a trip and doesn't need a badge. Only the states worth calling
 * out (locked-in quote, real commitment) get one, matching the rest of the
 * product's absence-over-invention grammar.
 */

const CONFIG: Partial<Record<BlockStatus, { label: string; icon: React.ElementType; className: string }>> = {
  priced: {
    label: 'Priced',
    icon: Tag,
    className: 'border-sky-300 bg-sky-50 text-sky-700',
  },
  booked: {
    label: 'Booked',
    icon: CheckCircle2,
    className: 'border-emerald-600 bg-emerald-600 text-white',
  },
};

interface BookingStateChipProps {
  status?: BlockStatus | null;
  className?: string;
}

export function BookingStateChip({ status, className }: BookingStateChipProps) {
  if (!status) return null;
  const config = CONFIG[status];
  if (!config) return null;
  const Icon = config.icon;

  return (
    <span
      title={config.label === 'Booked' ? 'This item is booked and committed' : 'Price is locked in — ready to book'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        config.className,
        className
      )}
    >
      <Icon size={10} strokeWidth={2.5} />
      {config.label}
    </span>
  );
}

/** Left-edge accent for booked nodes on the timeline — a subtle, permanent
 *  "this is locked in" signal beyond the badge itself. */
export function bookedAccentClass(status?: BlockStatus | null): string {
  return status === 'booked' ? 'border-l-[3px] border-l-emerald-500' : '';
}
