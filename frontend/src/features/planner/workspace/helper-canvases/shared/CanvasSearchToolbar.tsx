'use client';

import React from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn, FOCUS_RING_CLASS } from '@/lib/utils';

interface CanvasSearchToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isSearchFocused: boolean;
  onFocusChange: (focused: boolean) => void;
  activeFilterCount?: number;
  onOpenFilter: () => void;
  onClose?: () => void;
  /** Per-category focus ring, e.g. 'focus:border-cat-food focus:ring-cat-food/15' */
  accentClassName?: string;
}

/**
 * The one toolbar row for every redesigned Helper Canvas: search (already
 * pre-filled with the destination — never repeated as a separate title),
 * Sort & Filter, and Close. Replaces CanvasHeader + SearchSummaryBar +
 * any ad-hoc filter/AI-action rows for these four canvases only —
 * CanvasHeader/SearchSummaryBar stay as-is for every other Helper Canvas.
 */
export default function CanvasSearchToolbar({
  searchQuery,
  onSearchChange,
  isSearchFocused,
  onFocusChange,
  activeFilterCount = 0,
  onOpenFilter,
  onClose,
  accentClassName = 'focus:border-[rgb(var(--color-booking))] focus:ring-[rgb(var(--color-booking)/0.12)]',
}: CanvasSearchToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line/50 bg-paper-1 px-4 py-2.5">
      <div className="relative min-w-0 flex-1">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => onFocusChange(true)}
          onBlur={() => onFocusChange(false)}
          placeholder="Search destination…"
          className={cn(
            'w-full rounded-full border bg-white py-2 pl-8 pr-3 text-[12.5px] font-medium text-ink-900 outline-none focus:ring-2',
            isSearchFocused ? 'border-line-strong shadow-surface' : 'border-line',
            accentClassName,
          )}
          style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
        />
      </div>

      <button
        type="button"
        onClick={onOpenFilter}
        aria-haspopup="dialog"
        className={cn(
          'relative flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[11.5px] font-semibold text-ink-600 hover:bg-paper-0 cursor-pointer',
          FOCUS_RING_CLASS,
        )}
        style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
      >
        <SlidersHorizontal size={13} className="text-ink-400" />
        <span className="hidden sm:inline">Sort &amp; Filter</span>
        {activeFilterCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: 'rgb(var(--color-ai))' }}
          >
            {activeFilterCount}
          </span>
        )}
      </button>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn('flex shrink-0 items-center justify-center rounded-full p-2 text-ink-400 hover:bg-paper-0 hover:text-ink-700 cursor-pointer', FOCUS_RING_CLASS)}
          style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
