import React from 'react';
import { ChevronDown, ChevronRight, Sparkles, Milestone, MapPin } from 'lucide-react';
import { ItineraryDay } from '../types';
import { clickableDivProps, FOCUS_RING_CLASS } from '@/lib/utils';

interface DayHeaderNodeProps {
  day: ItineraryDay;
  isCollapsed?: boolean;
  onToggle?: () => void;
  onOptimizeRoute?: () => void;
  timeSavedText?: string;
}

export default function DayHeaderNode({ day, isCollapsed, onToggle, onOptimizeRoute, timeSavedText }: DayHeaderNodeProps) {
  // Cheap micro-stats from data already on the day — doubles as the
  // collapsed-state summary, since a collapsed day previously shrank to
  // just a title with no sense of what it actually holds.
  const activeItems = day.items.filter((i) => !i.isInactive);
  const stopCount = activeItems.length;
  const totalCost = activeItems.reduce((sum, i) => sum + (i.cost?.amount ?? 0), 0);
  const currencySymbol = activeItems.find((i) => i.cost?.currency)?.cost?.currency === 'INR' || !activeItems.some((i) => i.cost?.currency)
    ? '₹'
    : `${activeItems.find((i) => i.cost?.currency)?.cost?.currency} `;
  const totalKm = Object.values(day.transitHints ?? {}).reduce((sum, h) => sum + h.distance_km, 0);

  return (
    <div className="relative py-6 pl-[70px]">
      {/* Main Spine passing through */}
      <div className="absolute bottom-0 left-[38px] top-0 w-1 bg-slate-800" />
      
      <div className="flex items-center justify-between pr-4">
        <div
          className={`flex flex-col gap-0.5 cursor-pointer rounded-lg ${FOCUS_RING_CLASS}`}
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          {...clickableDivProps(onToggle)}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900">Day {day.dayNumber}</h3>
            <span className="text-sm font-semibold text-slate-500">{day.dateStr}</span>
            {day.weather && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 border border-slate-200/80 shadow-3xs" title="Seasonal average from historical data — not a live forecast">
                {day.weather}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-500">{day.title}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <span className="flex items-center gap-0.5"><MapPin size={10} />{stopCount} {stopCount === 1 ? 'stop' : 'stops'}</span>
            {totalCost > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="tabular-nums">{currencySymbol}{Math.round(totalCost).toLocaleString()}</span>
              </>
            )}
            {totalKm > 0.3 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-0.5 tabular-nums"><Milestone size={10} />{Math.round(totalKm)} km</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOptimizeRoute && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOptimizeRoute();
              }}
              title={timeSavedText ? `Optimizing route will save ${timeSavedText} of transit travel time` : "Re-order activities by shortest distance to eliminate back-and-forth travel"}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold shadow-2xs border transition-all cursor-pointer export-hidden ${
                timeSavedText
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-600 text-white motion-safe:animate-pulse'
                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300'
              }`}
            >
              <Sparkles size={12} className={timeSavedText ? 'text-white' : 'text-blue-600'} />
              <span>{timeSavedText ? `Optimize Route (${timeSavedText})` : 'Optimize Route'}</span>
            </button>
          )}

          <button
            onClick={onToggle}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Expand Day ${day.dayNumber}` : `Collapse Day ${day.dayNumber}`}
            className={`rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors export-hidden ${FOCUS_RING_CLASS}`}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

