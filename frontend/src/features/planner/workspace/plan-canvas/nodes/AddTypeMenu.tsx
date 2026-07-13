'use client';

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ICON_STYLES } from './NodeWrapper';

export interface AddTypeMenuProps {
  /** Fires with the nodeType to open the matching Helper Canvas for */
  onSelect: (nodeType: string) => void;
  label: string;
  variant?: 'block' | 'pill' | 'icon';
  className?: string;
}

// Every option maps 1:1 to an existing Helper Canvas. Labels only — the icon
// (colored per category) comes from NodeWrapper's ICON_STYLES, the same
// language used on every itinerary node, instead of raw emoji.
const ADD_TYPES: { value: string; label: string }[] = [
  { value: 'attraction', label: 'Attraction' },
  { value: 'food', label: 'Restaurant' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'flight', label: 'Flight' },
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
  { value: 'cab', label: 'Cab' },
];

export default function AddTypeMenu({ onSelect, label, variant = 'pill', className }: AddTypeMenuProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const base =
    variant === 'block'
      ? 'flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-paper-0/60 p-4 text-[12px] font-semibold text-ink-700 hover:bg-white hover:border-[rgb(var(--color-journey)/0.6)] hover:text-ink-900 shadow-surface transition-all cursor-pointer'
      : variant === 'icon'
        ? 'flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-white text-ink-500 hover:border-[rgb(var(--color-journey)/0.5)] hover:bg-paper-0 hover:text-ink-900 shadow-surface transition-all cursor-pointer'
        : 'flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-2 text-[11px] font-semibold text-ink-700 shadow-surface hover:border-[rgb(var(--color-journey)/0.5)] hover:bg-paper-0 hover:text-ink-900 transition-all cursor-pointer';

  return (
    <div className={`relative inline-flex ${variant === 'block' ? 'w-full' : ''} ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={`flex items-center justify-center gap-1.5 transition-all ${base} w-full`}
      >
        <Plus size={variant === 'icon' ? 12 : 13} className="text-[rgb(var(--color-journey))]" strokeWidth={2.5} />
        {variant !== 'icon' && label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute left-0 top-full z-20 mt-1.5 w-48 rounded-2xl border border-line bg-white p-1.5 shadow-modal"
          >
            {ADD_TYPES.map((t) => {
              const style = ICON_STYLES[t.value];
              return (
                <button
                  key={t.value}
                  type="button"
                  role="menuitem"
                  onClick={() => { onSelect(t.value); setOpen(false); }}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12px] font-medium text-ink-700 hover:bg-paper-0"
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${style?.bg ?? 'bg-line'}`}>
                    {style?.icon}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
