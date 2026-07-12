import React, { useState } from 'react';
import { Plane, Car, BedDouble, Utensils, Zap, Compass, Train, Bus } from 'lucide-react';

interface NodeWrapperProps {
  type: string;
  time?: string;
  endTime?: string;
  children: React.ReactNode;
  iconBgColor?: string;
  isLast?: boolean;
  onTimeChange?: (field: 'start' | 'end', value: string) => void;
}

const HHMM = /^\d{2}:\d{2}$/;

function formatDuration(start?: string, end?: string): string | null {
  if (!start || !end || !HHMM.test(start) || !HHMM.test(end)) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh! * 60 + em!) - (sh! * 60 + sm!);
  if (mins < 0) mins += 24 * 60;
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

/** Category-specific icon backgrounds — warm, distinct, not generic grey */
const ICON_STYLES: Record<string, { bg: string; icon: React.ReactNode }> = {
  flight:     { bg: 'bg-violet-100',  icon: <Plane     size={12} className="text-violet-600" fill="currentColor" /> },
  train:      { bg: 'bg-blue-100',    icon: <Train     size={12} className="text-blue-600" fill="currentColor" /> },
  bus:        { bg: 'bg-sky-100',     icon: <Bus       size={12} className="text-sky-600" fill="currentColor" /> },
  taxi:       { bg: 'bg-amber-100',   icon: <Car       size={12} className="text-amber-600" fill="currentColor" /> },
  cab:        { bg: 'bg-amber-100',   icon: <Car       size={12} className="text-amber-600" fill="currentColor" /> },
  hotel:      { bg: 'bg-indigo-100',  icon: <BedDouble size={12} className="text-indigo-600" fill="currentColor" /> },
  food:       { bg: 'bg-orange-100',  icon: <Utensils  size={12} className="text-orange-600" /> },
  activity:   { bg: 'bg-emerald-100', icon: <Zap       size={12} className="text-emerald-600" fill="currentColor" /> },
  attraction: { bg: 'bg-teal-100',    icon: <Compass   size={12} className="text-teal-600" /> },
};

export default function NodeWrapper({ type, time, endTime, children, iconBgColor, isLast, onTimeChange }: NodeWrapperProps) {
  const [editingField, setEditingField] = useState<'start' | 'end' | null>(null);
  const duration = formatDuration(time, endTime);

  const iconStyle = ICON_STYLES[type] ?? {
    bg: 'bg-slate-100',
    icon: null,
  };
  const dotBg = iconBgColor ?? iconStyle.bg;

  const renderTimeValue = (field: 'start' | 'end', value: string | undefined, className: string) => {
    if (!onTimeChange) {
      return value ? <p className={className}>{value}</p> : null;
    }
    if (editingField === field) {
      return (
        <input
          type="time"
          autoFocus
          defaultValue={value && HHMM.test(value) ? value : ''}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => {
            setEditingField(null);
            if (e.target.value && e.target.value !== value) onTimeChange(field, e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditingField(null);
          }}
          className="w-[62px] rounded-lg border border-[rgb(var(--color-booking)/0.4)] bg-white px-0.5 text-[10px] font-semibold text-ink-800 outline-none focus:border-[rgb(var(--color-booking))]"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditingField(field); }}
        className={`${className} cursor-pointer rounded-lg px-0.5 py-0.5 hover:bg-paper-0 hover:text-ink-900 export-hidden min-w-[44px] min-h-[32px] flex items-center justify-center`}
        style={{ transition: `background var(--motion-hover) var(--ease-out)` }}
        title={`Click to set the ${field === 'start' ? 'start' : 'end'} time`}
      >
        {value || (field === 'start' ? 'Set time' : '+ end')}
      </button>
    );
  };

  return (
    <div className="relative py-3 pl-[112px] pr-4">

      {/* ── Main journey spine — soft, thin, receding ─────────────────── */}
      <div className="absolute bottom-0 left-[20px] top-0 w-px bg-line/60" />

      {/* ── Sub spine — dashed, softer ───────────────────────────────── */}
      <div
        className={`absolute left-[91px] top-0 w-px ${isLast ? 'bottom-1/2' : 'bottom-0'}`}
        style={{
          backgroundImage: 'repeating-linear-gradient(to bottom, rgb(var(--line)/0.4) 0, rgb(var(--line)/0.4) 4px, transparent 4px, transparent 8px)',
          background: 'none',
          borderLeft: '1px dashed rgb(var(--line) / 0.35)',
        }}
      />

      {/* ── Time column ──────────────────────────────────────────────── */}
      <div className="absolute left-[32px] top-[22px] w-[44px] text-right">
        {renderTimeValue('start', time, 'text-[11px] font-semibold tabular-nums text-ink-700 block')}
        {renderTimeValue('end', endTime, 'text-[10px] font-medium tabular-nums text-ink-400 block')}
        {duration && (
          <p className="text-[9px] font-medium text-ink-400/70 tabular-nums export-hidden mt-0.5">{duration}</p>
        )}
      </div>

      {/* ── Category icon dot on sub-spine ───────────────────────────── */}
      <div
        className={`absolute left-[80px] top-[22px] z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full shadow-surface ${dotBg}`}
        style={{ boxShadow: '0 0 0 3px rgb(var(--paper-1)), var(--shadow-surface)' }}
      >
        {iconStyle.icon}
      </div>

      <div className="w-full">{children}</div>
    </div>
  );
}
