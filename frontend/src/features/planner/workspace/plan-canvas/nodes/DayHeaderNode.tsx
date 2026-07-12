import React from 'react';
import { ChevronDown, ChevronRight, Sparkles, Milestone, MapPin, CloudSun } from 'lucide-react';
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
  const activeItems = day.items.filter((i) => !i.isInactive);
  const stopCount = activeItems.length;
  const totalCost = activeItems.reduce((sum, i) => sum + (i.cost?.amount ?? 0), 0);
  const currencySymbol =
    activeItems.find((i) => i.cost?.currency)?.cost?.currency === 'INR' ||
    !activeItems.some((i) => i.cost?.currency)
      ? '₹'
      : `${activeItems.find((i) => i.cost?.currency)?.cost?.currency} `;
  const totalKm = Object.values(day.transitHints ?? {}).reduce((sum, h) => sum + h.distance_km, 0);

  return (
    <div className="relative py-5 pl-[48px]" id={`day-${day.dayNumber}`}>
      {/* Spine — continues through */}
      <div className="absolute bottom-0 left-[20px] top-0 w-px bg-line/60" />

      {/* M1: Day waypoint — small ring on the spine, so each day has a visual node */}
      <div
        className="absolute left-[14px] top-[26px] z-10 flex h-[12px] w-[12px] items-center justify-center rounded-full bg-paper-1 border border-line/80"
        aria-hidden="true"
      >
        <div className="h-[5px] w-[5px] rounded-full bg-ink-400/60" />
      </div>

      <div className="flex items-start justify-between pr-4">
        {/* Clickable day info — left side */}
        <div
          className={`flex flex-col gap-0.5 cursor-pointer rounded-xl ${FOCUS_RING_CLASS}`}
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          {...clickableDivProps(onToggle)}
        >
          {/* Information hierarchy #2: Current day */}
          {/* "Day N" — micro-label */}
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-ink-400">
            Day {day.dayNumber}
          </p>

          {/* Day title — the story */}
          <p className="text-[14px] font-semibold text-ink-900 leading-snug">
            {day.title || day.dateStr}
          </p>
          {day.title && day.dateStr && (
            <p className="text-[11px] font-medium text-ink-500">{day.dateStr}</p>
          )}

          {/* Micro-stats row — icon + number pairs */}
          <div className="mt-1 flex items-center gap-2.5 flex-wrap">
            {/* Stops */}
            <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-400">
              <MapPin size={10} className="text-ink-400/70" />
              {stopCount} {stopCount === 1 ? 'stop' : 'stops'}
            </span>

            {/* Cost */}
            {totalCost > 0 && (
              <>
                <span className="text-line/60">·</span>
                <span className="text-[10px] font-semibold tabular-nums text-ink-400">
                  {currencySymbol}{Math.round(totalCost).toLocaleString()}
                </span>
              </>
            )}

            {/* Distance */}
            {totalKm > 0.3 && (
              <>
                <span className="text-line/60">·</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold tabular-nums text-ink-400">
                  <Milestone size={10} className="text-ink-400/70" />
                  {Math.round(totalKm)} km
                </span>
              </>
            )}

            {/* Weather chip — visual first */}
            {day.weather && (
              <>
                <span className="text-line/60">·</span>
                <span
                  className="flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50/70 px-2 py-0.5 text-[9px] font-semibold text-sky-700"
                  title="Seasonal average from historical data — not a live forecast"
                >
                  <CloudSun size={9} className="text-sky-400" />
                  {day.weather} Avg
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 mt-0.5 shrink-0">
          {/* Optimize route — amber semantic (AI action) */}
          {onOptimizeRoute && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOptimizeRoute();
              }}
              title={
                timeSavedText
                  ? `Optimizing will ${timeSavedText} of travel time`
                  : 'Re-order stops by shortest distance'
              }
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] font-semibold border transition-all cursor-pointer export-hidden ${
                timeSavedText
                  // C5: No animate-pulse — creates anxiety across multiple days simultaneously
                  ? 'bg-amber-50 border-amber-200 text-amber-700'
                  : 'bg-paper-1 border-line text-ink-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
              }`}
              style={{ transition: `all var(--motion-card) var(--ease-out)` }}
            >
              <Sparkles
                size={11}
                className={timeSavedText ? 'text-amber-600' : 'text-ink-400'}
              />
              {/* L3: timeSavedText is already "saves ~Xm" — don't prepend "Save" */}
              <span>{timeSavedText ?? 'Optimize'}</span>
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={onToggle}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Expand Day ${day.dayNumber}` : `Collapse Day ${day.dayNumber}`}
            className={`rounded-xl p-2 text-ink-400 hover:bg-paper-1 hover:text-ink-700 transition-colors export-hidden ${FOCUS_RING_CLASS}`}
            style={{ transition: `all var(--motion-hover) var(--ease-out)`, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isCollapsed
              ? <ChevronRight size={15} />
              : <ChevronDown size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
