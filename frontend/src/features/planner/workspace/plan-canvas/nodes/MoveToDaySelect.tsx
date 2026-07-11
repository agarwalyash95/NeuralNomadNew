import React from 'react';
import { CornerDownRight } from 'lucide-react';

export interface DayOption {
  id: string;
  label: string;
}

interface MoveToDaySelectProps {
  options: DayOption[];
  currentDayId: string;
  onMove: (dayId: string) => void;
  className?: string;
}

/**
 * MoveToDaySelect — the accessible/mobile path for relocating a block that
 * doesn't depend on drag gestures. A native <select> also handles keyboard
 * nav and touch pickers for free — no floating-menu positioning to build.
 * Doubles as the only way to move an item ACROSS cities, since drag-drop
 * across a city boundary is intentionally rejected (splicing days across
 * different itineraries mid-drag risks corrupting more than it fixes).
 */
export default function MoveToDaySelect({ options, currentDayId, onMove, className }: MoveToDaySelectProps) {
  const choices = options.filter((o) => o.id !== currentDayId);
  if (choices.length === 0) return null;

  return (
    <div className={`relative inline-flex items-center ${className ?? ''}`} onClick={(e) => e.stopPropagation()}>
      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) onMove(e.target.value);
          e.target.value = '';
        }}
        title="Move to a different day"
        aria-label="Move to a different day"
        className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-2 pr-6 text-[9px] font-bold text-slate-400 shadow-xs transition-all hover:border-slate-300 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <option value="" disabled>Move to…</option>
        {choices.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      <CornerDownRight size={11} className="pointer-events-none absolute right-1.5 text-slate-400" />
    </div>
  );
}
