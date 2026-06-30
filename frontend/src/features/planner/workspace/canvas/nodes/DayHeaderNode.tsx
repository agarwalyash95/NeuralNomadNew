import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ItineraryDay } from '../mockData';

interface DayHeaderNodeProps {
  day: ItineraryDay;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function DayHeaderNode({ day, isCollapsed, onToggle }: DayHeaderNodeProps) {
  return (
    <div className="relative py-6 pl-[70px]">
      {/* Main Spine passing through */}
      <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />
      
      <div className="flex items-center justify-between pr-4">
        <div className="flex flex-col gap-0.5 cursor-pointer" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900">Day {day.dayNumber}</h3>
            <span className="text-sm font-semibold text-slate-500">{day.dateStr}</span>
          </div>
          <p className="text-xs font-semibold text-slate-500">{day.title}</p>
        </div>
        
        <button 
          onClick={onToggle}
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
    </div>
  );
}
