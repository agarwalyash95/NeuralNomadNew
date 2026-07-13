'use client';

import React from 'react';

interface DetailCTAFooterProps {
  label: string;
  onClick: () => void;
  metricLabel?: string;
  accentClassName?: string;
}

/**
 * One compact row: reason on the left, button on the right. A full-width
 * stacked CTA bar previously ate a fixed quarter of the footer for no
 * reason a single line couldn't say — this matches RichHoverCard's scale
 * (small text, tight padding) instead of introducing its own oversized
 * chrome.
 */
export default function DetailCTAFooter({ label, onClick, metricLabel, accentClassName = 'text-ink-900' }: DetailCTAFooterProps) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-paper-1/95 px-5 py-2.5 backdrop-blur-sm">
      {metricLabel ? (
        <p className={`min-w-0 truncate text-[11px] font-bold ${accentClassName}`}>{metricLabel}</p>
      ) : <span />}
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 cursor-pointer rounded-lg bg-ink-900 px-4 py-2 text-[12px] font-bold tracking-tight text-white transition-all hover:opacity-90 active:scale-[0.97]"
      >
        {label}
      </button>
    </div>
  );
}
