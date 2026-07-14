'use client';

/**
 * Trip Intelligence Timeline (T7.2)
 *
 * A horizontal scrollable time-strip rendered per-day just below the day
 * header. Each marker is a real computed or insight-derived event — never a
 * mock. Data comes from the plan's ItineraryDay + PlanInsights from the
 * live-computed insight engine.
 */

import React, { useMemo } from 'react';
import { Clock, Utensils, BedDouble, AlertTriangle, Info, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ItineraryDay } from './plan-canvas/types';
import type { PlanInsight } from '@/services/planner.types';

interface TimelineEvent {
  time: string;
  label: string;
  icon: React.ReactNode;
  color: 'amber' | 'emerald' | 'blue' | 'ink';
}

interface TripIntelligenceTimelineProps {
  day: ItineraryDay;
  insights: PlanInsight[];
  className?: string;
}

function toMins(t: string | undefined | null): number | null {
  if (!t) return null;
  const parts = t.split(':');
  const h = parseInt(parts[0] ?? '0', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function fmtTime(t: string | undefined | null): string {
  if (!t) return '';
  const parts = t.split(':');
  return `${parts[0]}:${parts[1]}`;
}

export function TripIntelligenceTimeline({ day, insights, className }: TripIntelligenceTimelineProps) {
  const events = useMemo<TimelineEvent[]>(() => {
    const collected: TimelineEvent[] = [];

    for (const item of day.items) {
      if (item.isInactive) continue;
      const st = item.startTime;
      if (!st) continue;

      if (item.type === 'hotel') {
        collected.push({ time: fmtTime(st), label: `Check-in: ${item.title}`, icon: <BedDouble size={10} />, color: 'blue' });
      } else if (item.type === 'food') {
        collected.push({ time: fmtTime(st), label: item.title, icon: <Utensils size={10} />, color: 'emerald' });
      } else if (item.type === 'attraction' || item.type === 'activity') {
        collected.push({ time: fmtTime(st), label: item.title, icon: <MapPin size={10} />, color: 'ink' });
      }
    }

    for (const ins of insights) {
      if (ins.day_number !== day.dayNumber) continue;
      collected.push({
        time: '',
        label: ins.message.length > 55 ? ins.message.slice(0, 52) + '…' : ins.message,
        icon: ins.severity === 'warning' ? <AlertTriangle size={10} /> : <Info size={10} />,
        color: ins.severity === 'warning' ? 'amber' : 'blue',
      });
    }

    return collected.sort((a, b) => {
      const am = toMins(a.time), bm = toMins(b.time);
      if (am === null && bm === null) return 0;
      if (am === null) return 1;
      if (bm === null) return -1;
      return am - bm;
    });
  }, [day, insights]);

  if (events.length === 0) return null;

  const colorMap: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    ink: 'border-line bg-paper-2 text-ink-600',
  };

  return (
    <div className={cn('w-full overflow-x-auto scrollbar-hide pb-1 px-3', className)}>
      <div className="flex items-center gap-1.5 min-w-max">
        <span className="shrink-0 flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-ink-300 pr-1">
          <Clock size={8} />
          Day intel
        </span>
        {events.map((ev, i) => (
          <div
            key={i}
            className={cn(
              'shrink-0 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8.5px] font-semibold whitespace-nowrap',
              colorMap[ev.color],
            )}
          >
            {ev.icon}
            {ev.time && <span className="font-bold">{ev.time}</span>}
            <span>{ev.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
