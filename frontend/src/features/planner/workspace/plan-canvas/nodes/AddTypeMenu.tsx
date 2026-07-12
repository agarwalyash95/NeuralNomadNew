import React from 'react';
import { Plus } from 'lucide-react';

export interface AddTypeMenuProps {
  /** Fires with the nodeType to open the matching Helper Canvas for */
  onSelect: (nodeType: string) => void;
  label: string;
  variant?: 'block' | 'pill' | 'icon';
  className?: string;
}

// Every option maps 1:1 to an existing Helper Canvas
const ADD_TYPES: { value: string; label: string }[] = [
  { value: 'attraction', label: '🏛️ Attraction' },
  { value: 'food', label: '🍽️ Restaurant' },
  { value: 'hotel', label: '🏨 Hotel' },
  { value: 'flight', label: '✈️ Flight' },
  { value: 'train', label: '🚆 Train' },
  { value: 'bus', label: '🚌 Bus' },
  { value: 'cab', label: '🚕 Cab' },
];

export default function AddTypeMenu({ onSelect, label, variant = 'pill', className }: AddTypeMenuProps) {
  // Premium travel system variables
  const base =
    variant === 'block'
      ? 'flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-paper-0/60 p-4 text-[12px] font-semibold text-ink-700 hover:bg-white hover:border-[rgb(var(--color-journey)/0.6)] hover:text-ink-900 shadow-surface transition-all cursor-pointer'
      : variant === 'icon'
        ? 'flex h-7 w-7 items-center justify-center rounded-full border border-line-strong bg-white text-ink-500 hover:border-[rgb(var(--color-journey)/0.5)] hover:bg-paper-0 hover:text-ink-900 shadow-surface transition-all cursor-pointer'
        : 'flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-2 text-[11px] font-semibold text-ink-700 shadow-surface hover:border-[rgb(var(--color-journey)/0.5)] hover:bg-paper-0 hover:text-ink-900 transition-all cursor-pointer';

  return (
    <div className={`relative inline-flex ${variant === 'block' ? 'w-full' : ''} ${className ?? ''}`}>
      <div className={`pointer-events-none flex items-center justify-center gap-1.5 transition-all ${base} w-full`}>
        <Plus size={variant === 'icon' ? 12 : 13} className="text-[rgb(var(--color-journey))]" strokeWidth={2.5} />
        {variant !== 'icon' && label}
      </div>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
          e.target.value = '';
        }}
        aria-label={label}
        title={label}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        <option value="" disabled>{label}</option>
        {ADD_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
    </div>
  );
}
