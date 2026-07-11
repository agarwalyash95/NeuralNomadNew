import React, { useState } from 'react';
import { Plane, Car, BedDouble, Utensils, Zap, Compass, Train, Bus } from 'lucide-react';

interface NodeWrapperProps {
  type: string;
  time?: string;
  endTime?: string;
  children: React.ReactNode;
  iconBgColor?: string;
  isLast?: boolean;
  /** Enables inline time editing on the time gutter — omitted (e.g. transit's
   *  own layout doesn't use this wrapper) leaves the plain text display. */
  onTimeChange?: (field: 'start' | 'end', value: string) => void;
}

const HHMM = /^\d{2}:\d{2}$/;

function formatDuration(start?: string, end?: string): string | null {
  if (!start || !end || !HHMM.test(start) || !HHMM.test(end)) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh! * 60 + em!) - (sh! * 60 + sm!);
  if (mins < 0) mins += 24 * 60; // crosses midnight
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

export default function NodeWrapper({ type, time, endTime, children, iconBgColor, isLast, onTimeChange }: NodeWrapperProps) {
  const [editingField, setEditingField] = useState<'start' | 'end' | null>(null);
  const duration = formatDuration(time, endTime);

  const getIcon = () => {
    switch (type) {
      case 'flight':
        return <Plane size={14} className="text-white" fill="currentColor" />;
      case 'taxi':
        return <Car size={14} className="text-white" fill="currentColor" />;
      case 'hotel':
        return <BedDouble size={14} className="text-white" fill="currentColor" />;
      case 'food':
        return <Utensils size={14} className="text-white" fill="currentColor" />;
      case 'activity':
        return <Zap size={14} className="text-white" fill="currentColor" />;
      case 'attraction':
        return <Compass size={14} className="text-white" />;
      case 'train':
        return <Train size={14} className="text-white" fill="currentColor" />;
      case 'bus':
        return <Bus size={14} className="text-white" fill="currentColor" />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    if (iconBgColor) return iconBgColor;
    switch (type) {
      case 'flight':
        return 'bg-indigo-500';
      case 'taxi':
        return 'bg-amber-500';
      case 'hotel':
        return 'bg-violet-500';
      case 'food':
        return 'bg-orange-500';
      case 'activity':
        return 'bg-rose-500';
      case 'attraction':
        return 'bg-emerald-600';
      case 'train':
        return 'bg-blue-500';
      case 'bus':
        return 'bg-pink-500';
      default:
        return 'bg-slate-400';
    }
  };

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
          className="w-[62px] rounded border border-blue-300 bg-white px-0.5 text-[10px] font-bold text-slate-800 outline-none focus:border-blue-500"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditingField(field); }}
        className={`${className} cursor-pointer rounded px-0.5 hover:bg-blue-50 hover:text-blue-700 export-hidden`}
        title={`Click to set the ${field === 'start' ? 'start' : 'end'} time`}
      >
        {value || (field === 'start' ? 'Set time' : '+ end')}
      </button>
    );
  };

  return (
    <div className="relative py-2 pl-[144px] pr-4">
      {/* Main Spine passing through continuously */}
      <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />

      {/* Sub Spine passing through the items */}
      <div className={`absolute left-[120px] top-0 w-[1.5px] bg-slate-200 ${isLast ? 'bottom-1/2' : 'bottom-0'}`} />

      {/* Time column (between Main and Sub spine) */}
      <div className="absolute left-[64px] top-[26px] w-[40px] text-right">
        {renderTimeValue('start', time, 'text-[11px] font-bold text-slate-800')}
        {renderTimeValue('end', endTime, 'text-[10px] font-semibold text-slate-500')}
        {duration && <p className="text-[9px] font-semibold text-slate-400 export-hidden">{duration}</p>}
      </div>

      {/* Activity Icon on Sub Spine */}
      <div
        className={`absolute left-[108px] top-[26px] z-10 flex h-6 w-6 items-center justify-center rounded-full border-[2px] border-white shadow-sm ${getBgColor()}`}
      >
        {getIcon()}
      </div>

      <div className="w-full">{children}</div>
    </div>
  );
}
