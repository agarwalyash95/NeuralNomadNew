'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, Phone, Globe, ChevronDown } from 'lucide-react';
import { todaysHours, todayHoursIndex } from './placeFacts';

interface ReferenceRowsProps {
  openingHours?: string[] | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  website?: string | null;
}

/**
 * The reference tail of every detail panel — today's hours (full week one
 * tap away, inline), address, and contact — at RichHoverCard's exact scale
 * and chip language, just with the hours + directions the hover card can't
 * fit. Replaces the old Hours/Location tabs that hid this behind
 * default-closed panels.
 */
export default function ReferenceRows({ openingHours, address, latitude, longitude, phone, website }: ReferenceRowsProps) {
  const [weekOpen, setWeekOpen] = useState(false);

  const today = todaysHours(openingHours);
  const hasWeek = (openingHours?.length ?? 0) > 1;
  const mapsUrl = latitude != null && longitude != null
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : null;

  if (!today && !address && !mapsUrl && !phone && !website) return null;

  return (
    <div className="space-y-3">
      {today && (
        <div>
          <button
            type="button"
            onClick={() => hasWeek && setWeekOpen((v) => !v)}
            className={`flex w-full items-start gap-2 text-left ${hasWeek ? 'cursor-pointer' : 'cursor-default'}`}
            aria-expanded={weekOpen}
          >
            <Clock size={12} className="mt-0.5 shrink-0 text-ink-400" />
            <p className="flex-1 text-[11px] font-semibold leading-relaxed text-ink-500">
              <span className="font-bold text-ink-900">Today</span> · {today}
            </p>
            {hasWeek && (
              <ChevronDown size={12} className={`mt-0.5 shrink-0 text-ink-400 transition-transform ${weekOpen ? 'rotate-180' : ''}`} />
            )}
          </button>
          <AnimatePresence initial={false}>
            {weekOpen && openingHours && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-0.5 pt-2 pl-[20px]">
                  {openingHours.map((line, i) => (
                    <p key={i} className={`text-[10.5px] leading-relaxed ${i === todayHoursIndex() ? 'font-bold text-ink-900' : 'font-medium text-ink-500'}`}>
                      {line}
                    </p>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {address && <p className="text-[10.5px] font-medium leading-relaxed text-ink-500">{address}</p>}

      {(phone || website || mapsUrl) && (
        <div className="flex flex-wrap items-center gap-2">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-line bg-paper-1 px-2 py-1 text-[10px] font-bold text-ink-700 transition hover:border-line-strong hover:bg-paper-2">
              <MapPin size={10} className="text-ink-400" /> Directions
            </a>
          )}
          {phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-1 rounded-lg border border-line bg-paper-1 px-2 py-1 text-[10px] font-bold text-ink-700 transition hover:border-line-strong hover:bg-paper-2">
              <Phone size={10} className="text-ink-400" /> {phone}
            </a>
          )}
          {website && (
            <a href={website} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg border border-line bg-paper-1 px-2 py-1 text-[10px] font-bold text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">
              <Globe size={10} className="text-blue-500" /> Website
            </a>
          )}
        </div>
      )}
    </div>
  );
}
