import React from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { ItineraryDay } from '../mockData';

interface DayHeaderNodeProps {
  day: ItineraryDay;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onOptimizeRoute?: () => void;
}

export default function DayHeaderNode({ day, isCollapsed, onToggle, onOptimizeRoute }: DayHeaderNodeProps) {
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
        
        <div className="flex items-center gap-2">
          {onOptimizeRoute && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOptimizeRoute();
              }}
              title="Re-order activities by shortest distance to eliminate back-and-forth travel"
              className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50/80 px-2.5 py-1 text-[11px] font-bold text-blue-700 shadow-2xs hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer"
            >
              <Sparkles size={12} className="text-blue-600" />
              <span>Optimize Route</span>
            </button>
          )}

          <button 
            onClick={onToggle}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

