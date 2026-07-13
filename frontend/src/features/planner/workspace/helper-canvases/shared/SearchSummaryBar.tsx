'use client';

import React from 'react';
import { Edit2 } from 'lucide-react';

interface SearchSummaryBarProps {
  /** Primary line (e.g. "Delhi → Manali") */
  primary: string;
  /** Secondary line (e.g. "Oct 15 • 4 travellers • Economy") */
  secondary?: string;
  /** Accent color class for edit icon on hover */
  accentColor?: string;
  onClick: () => void;
  children?: React.ReactNode;
}

/**
 * Collapsed search state bar — click to expand full search form.
 * Used at top of all booking canvases.
 */
export default function SearchSummaryBar({
  primary,
  secondary,
  accentColor = 'group-hover:text-blue-600',
  onClick,
  children,
}: SearchSummaryBarProps) {
  return (
    <div className="border-b border-line bg-paper-1 p-4">
      <button
        onClick={onClick}
        className="group w-full rounded-xl border border-line bg-paper-2 p-3 text-left transition-all hover:border-line-strong hover:shadow-md"
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-900 truncate">{primary}</p>
            {secondary && (
              <p className="mt-1 text-xs text-ink-500 truncate">{secondary}</p>
            )}
          </div>
          <Edit2 size={16} className={`shrink-0 ml-2 text-ink-400 transition-colors ${accentColor}`} />
        </div>
      </button>
      {/* Quick filter tags slot */}
      {children}
    </div>
  );
}
