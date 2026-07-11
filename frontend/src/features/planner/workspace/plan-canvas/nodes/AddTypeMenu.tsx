import React from 'react';
import { Plus } from 'lucide-react';

export interface AddTypeMenuProps {
  /** Fires with the nodeType to open the matching Helper Canvas for */
  onSelect: (nodeType: string) => void;
  label: string;
  variant?: 'block' | 'pill' | 'icon';
  className?: string;
}

// Every option maps 1:1 to an existing Helper Canvas (openPanelForType in
// PlannerWorkspace.tsx) — no "Transport" catch-all, since flight/train/bus/cab
// are four different canvases today and a generic option would have to guess
// which one to open.
const ADD_TYPES: { value: string; label: string }[] = [
  { value: 'attraction', label: '🏛️ Attraction' },
  { value: 'food', label: '🍽️ Restaurant' },
  { value: 'hotel', label: '🏨 Hotel' },
  { value: 'flight', label: '✈️ Flight' },
  { value: 'train', label: '🚆 Train' },
  { value: 'bus', label: '🚌 Bus' },
  { value: 'cab', label: '🚕 Cab' },
];

/**
 * AddTypeMenu — replaces the old hardcoded-to-'activity' add buttons. A
 * native <select> as the trigger: free keyboard nav and a touch-friendly
 * picker, no custom popover/outside-click code to get wrong.
 */
export default function AddTypeMenu({ onSelect, label, variant = 'pill', className }: AddTypeMenuProps) {
  const base =
    variant === 'block'
      ? 'flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200/80 bg-white/40 p-4 text-xs font-bold text-slate-500 hover:bg-slate-55 hover:border-slate-300 hover:text-slate-700 shadow-2xs'
      : variant === 'icon'
        ? 'flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white/70 text-slate-400 opacity-50 hover:opacity-100 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 shadow-2xs'
        : 'flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700';

  return (
    <div className={`relative inline-flex ${variant === 'block' ? 'w-full' : ''} ${className ?? ''}`}>
      <div className={`pointer-events-none flex items-center justify-center gap-1.5 transition-all ${base} w-full`}>
        <Plus size={variant === 'icon' ? 12 : 14} />
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
