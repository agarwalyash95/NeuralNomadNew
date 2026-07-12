'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin } from 'lucide-react';
import type { TripContext } from '../../types';

interface ExperienceProgressCardProps {
  tripContext: TripContext;
  compact: boolean;
}

// ── Journey stop shape ─────────────────────────────────────────────────────
interface JourneyStop {
  title: string;
  status: 'done' | 'current' | 'upcoming' | 'explore';
}

function buildJourney(tripContext: TripContext): JourneyStop[] {
  const stops: JourneyStop[] = [];
  const titles = tripContext.activeDayItemTitles || [];
  const current = tripContext.activeNodeTitle;

  if (titles.length === 0 && !current) {
    return [{ title: 'Start exploring', status: 'explore' }];
  }

  let foundCurrent = false;
  for (const title of titles) {
    if (current && title.trim().toLowerCase() === current.trim().toLowerCase()) {
      foundCurrent = true;
      stops.push({ title, status: 'current' });
    } else if (foundCurrent) {
      stops.push({ title, status: 'upcoming' });
    } else {
      stops.push({ title, status: 'done' });
    }
  }

  // If active node isn't in the day titles (floating context), inject it
  if (!foundCurrent && current) {
    stops.push({ title: current, status: 'current' });
  }

  stops.push({ title: 'Explore more', status: 'explore' });
  return stops;
}

// ── Dot per stop ───────────────────────────────────────────────────────────
function StopDot({ stop, compact }: { stop: JourneyStop; compact: boolean }) {
  const config = {
    done: {
      dot: 'w-2 h-2 rounded-full bg-slate-300',
      label: 'text-slate-400 line-through',
    },
    current: {
      dot: 'w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shadow-sm shadow-emerald-400',
      label: 'text-emerald-700 font-bold',
    },
    upcoming: {
      dot: 'w-2 h-2 rounded-full border-2 border-slate-300 bg-white',
      label: 'text-slate-500',
    },
    explore: {
      dot: 'w-2 h-2 rounded-full border-2 border-dashed border-emerald-300 bg-transparent',
      label: 'text-emerald-500 font-semibold italic',
    },
  }[stop.status];

  if (compact) {
    return (
      <div
        className={`shrink-0 ${config.dot}`}
        title={stop.title}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <div className={`shrink-0 ${config.dot}`} />
      {stop.status === 'current' && (
        <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-600 whitespace-nowrap">
          You are here
        </span>
      )}
      <p
        className={`text-[10px] text-center leading-tight max-w-[64px] truncate ${config.label}`}
        title={stop.title}
      >
        {stop.title}
      </p>
    </div>
  );
}

// ── Connector line ─────────────────────────────────────────────────────────
function Connector({ done }: { done: boolean }) {
  return (
    <div
      className={`h-px flex-1 min-w-[12px] max-w-[40px] ${
        done ? 'bg-slate-300' : 'bg-gradient-to-r from-slate-300 to-slate-200 border-dashed border-t border-slate-200'
      }`}
    />
  );
}

/**
 * ExperienceProgressCard — the day-journey strip unique to the Attractions tab.
 *
 * Shows a horizontal timeline: ✓ completed stops → ● current context →
 * ○ remaining planned stops → + Explore more.
 *
 * Collapses to a single dot-trail when `compact` is true (user has scrolled
 * past the hero into the list).
 */
export default function ExperienceProgressCard({ tripContext, compact }: ExperienceProgressCardProps) {
  const stops = buildJourney(tripContext);
  const dayLabel = tripContext.activeNodeDayLabel || "Today's Route";
  const upcomingCount = stops.filter((s) => s.status === 'upcoming').length;
  const destination = tripContext.activeNodeCityName || tripContext.destination;

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="mx-4 mb-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-surface"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-emerald-500">
            <MapPin size={13} className="fill-emerald-100" />
          </span>
          <AnimatePresence mode="wait">
            {compact ? (
              <motion.span
                key="compact"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="text-[11px] font-semibold text-slate-700"
              >
                {dayLabel}
                {upcomingCount > 0 && (
                  <span className="ml-1.5 text-emerald-600">· {upcomingCount} stop{upcomingCount > 1 ? 's' : ''} remaining</span>
                )}
              </motion.span>
            ) : (
              <motion.span
                key="full"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-[11px] font-semibold text-slate-700"
              >
                {dayLabel} · <span className="text-slate-400">{destination}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {!compact && upcomingCount > 0 && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            {upcomingCount} ahead
          </span>
        )}
      </div>

      {/* Journey strip */}
      <div className="pb-3 px-4">
        {compact ? (
          // Compact: just a dot trail
          <div className="flex items-center gap-1.5">
            {stops.map((stop, i) => (
              <React.Fragment key={i}>
                <StopDot stop={stop} compact />
                {i < stops.length - 1 && (
                  <div className="h-px w-3 bg-slate-200" />
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          // Full: dots + labels + connecting lines
          <div className="flex items-start gap-0">
            {stops.map((stop, i) => (
              <React.Fragment key={i}>
                <StopDot stop={stop} compact={false} />
                {i < stops.length - 1 && (
                  <div className="flex items-center self-start pt-1.5">
                    <Connector done={stop.status === 'done'} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
