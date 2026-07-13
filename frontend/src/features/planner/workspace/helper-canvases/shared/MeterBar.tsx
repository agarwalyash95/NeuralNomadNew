'use client';

import React from 'react';

interface MeterBarProps {
  label: string;
  /** 0–100 */
  fillPercent: number;
  caption?: string;
  colorClassName?: string;
}

/**
 * A single visual fill-bar — the shared way budget, crowd level, Trip Fit
 * score, and difficulty read across every detail panel: a glanceable meter,
 * not an isolated number in its own box. Reused with a category-appropriate
 * color and a pre-computed 0–100 value (crowd/difficulty tiers are mapped
 * to a percentage by the caller).
 */
export default function MeterBar({ label, fillPercent, caption, colorClassName = 'bg-ink-900' }: MeterBarProps) {
  const clamped = Math.max(0, Math.min(100, fillPercent));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-semibold text-ink-600">
        <span>{label}</span>
        {caption && <span className="tabular-nums text-ink-500">{caption}</span>}
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line/50">
        <div
          className={`h-full rounded-full ${colorClassName}`}
          style={{ width: `${clamped}%`, transition: `width var(--motion-bar) var(--ease-out)` }}
        />
      </div>
    </div>
  );
}
