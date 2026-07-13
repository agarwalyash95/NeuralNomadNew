'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface FitChecklistProps {
  items: string[];
  accentClassName?: string;
}

/**
 * A slim outlined checkmark tinted to the panel's category color, at the
 * same type scale as the rest of the detail panel (RichHoverCard's chip/
 * text sizing) rather than its own larger display type.
 */
export default function FitChecklist({ items, accentClassName = 'text-ink-900' }: FitChecklistProps) {
  return (
    <div className="space-y-2">
      {items.map((text, i) => (
        <div key={i} className="flex items-start gap-2">
          <Check size={12} strokeWidth={2.75} className={`mt-0.5 shrink-0 ${accentClassName}`} />
          <p className="text-[11.5px] font-medium leading-snug text-ink-700">{text}</p>
        </div>
      ))}
    </div>
  );
}
