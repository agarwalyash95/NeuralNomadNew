'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface DecisionStat {
  icon?: LucideIcon;
  text: string;
  /** Optional tone override, e.g. emerald for "Open now" — defaults to ink. */
  toneClassName?: string;
}

interface DecisionBandProps {
  stats: DecisionStat[];
  /** Optional slim intensity meter (e.g. Trip Fit, Adventure Meter) rendered
   *  beneath the stats — same compact scale as the stats, not its own card. */
  meter?: {
    label: string;
    headline: string;
    caption?: string;
    filled: number;
    total: number;
    accentBgClassName: string;
    accentTextClassName: string;
  } | null;
}

/**
 * The exact rating/price/hours inline-badge row from RichHoverCard, reused
 * here at the same type scale — the detail page's decision facts should
 * read as that row expanded, not as a separate "stat card" system with its
 * own display typography.
 */
export default function DecisionBand({ stats, meter }: DecisionBandProps) {
  if (stats.length === 0 && !meter) return null;

  return (
    <div>
      {stats.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {stats.map(({ icon: Icon, text, toneClassName }, i) => (
            <span key={i} className={`flex items-center gap-1 text-[12px] font-bold ${toneClassName ?? 'text-ink-900'}`}>
              {Icon && <Icon size={12} className={toneClassName ?? 'text-ink-400'} />}
              {text}
            </span>
          ))}
        </div>
      )}

      {meter && (
        <div className={stats.length > 0 ? 'mt-3' : ''}>
          <div className="mb-1 flex items-baseline justify-between">
            <p className="text-[10px] font-semibold text-ink-400">{meter.label}</p>
            <p className={`text-[11px] font-bold ${meter.accentTextClassName}`}>{meter.headline}</p>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: meter.total }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < meter.filled ? meter.accentBgClassName : 'bg-line'}`} />
            ))}
          </div>
          {meter.caption && <p className="mt-1.5 text-[11px] font-medium text-ink-500">{meter.caption}</p>}
        </div>
      )}
    </div>
  );
}
