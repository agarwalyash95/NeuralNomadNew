'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface QuickFilterBarProps {
  label?: string;
  tags: string[];
  selected: string[];
  activeColor?: string;
  activeBorder?: string;
  hoverColor?: string;
  onToggle: (tag: string) => void;
}

/**
 * Pill-style quick filter row — used below search summary bar
 * and at top of explore canvases.
 */
export default function QuickFilterBar({
  label = 'Quick Filters',
  tags,
  selected,
  activeColor = 'border-blue-600 bg-blue-600 text-white shadow-sm',
  hoverColor = 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
  onToggle,
}: QuickFilterBarProps) {
  return (
    <div className="mt-3">
      {label && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => onToggle(tag)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              selected.includes(tag) ? activeColor : hoverColor
            }`}
          >
            {selected.includes(tag) && <Check size={11} className="mr-1 inline" />}
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
