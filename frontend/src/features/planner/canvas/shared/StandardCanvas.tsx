'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import type { CanvasType } from '@/services/planner.types';
import { CANVAS_COLORS } from '@/services/planner.types';

// ─── Standard Canvas Shell ──────────────────────────

interface StandardCanvasProps {
  canvasType: CanvasType;
  children: React.ReactNode;
  searchBar?: React.ReactNode;
}

export function StandardCanvas({ canvasType, children, searchBar }: StandardCanvasProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {searchBar && (
        <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200/30 dark:border-slate-800/30">
          {searchBar}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
        {children}
      </div>
    </div>
  );
}

// ─── Canvas Search Bar ──────────────────────────────

interface CanvasSearchBarProps {
  canvasType: CanvasType;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: () => void;
  filters?: React.ReactNode;
}

export function CanvasSearchBar({
  canvasType,
  placeholder = 'Search...',
  value = '',
  onChange,
  onSearch,
  filters,
}: CanvasSearchBarProps) {
  const colors = CANVAS_COLORS[canvasType];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 flex-1 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/40 rounded-xl px-3 py-2 focus-within:border-opacity-60 transition-all"
          style={{ '--tw-ring-color': `${colors.accent}30` } as React.CSSProperties}
        >
          <Search size={13} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
          />
        </div>
        {filters && (
          <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200/60 dark:border-slate-700/40 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all">
            <SlidersHorizontal size={13} />
          </button>
        )}
      </div>
      {filters}
    </div>
  );
}

// ─── Result Card ────────────────────────────────────

interface ResultCardProps {
  canvasType: CanvasType;
  title: string;
  subtitle?: string;
  price?: string;
  rating?: number;
  tags?: string[];
  badge?: string;
  isRecommended?: boolean;
  reason?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function ResultCard({
  canvasType,
  title,
  subtitle,
  price,
  rating,
  tags,
  badge,
  isRecommended,
  reason,
  onClick,
  children,
}: ResultCardProps) {
  const colors = CANVAS_COLORS[canvasType];

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className="group p-3.5 rounded-xl bg-white/70 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-700/30 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md hover:shadow-slate-200/30 dark:hover:shadow-slate-900/30 cursor-pointer transition-all"
    >
      {/* Recommended badge */}
      {isRecommended && (
        <div
          className="flex items-center gap-1 mb-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md w-fit"
          style={{ color: colors.accent, backgroundColor: colors.bg }}
        >
          ★ Recommended
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {subtitle}
            </p>
          )}

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* AI Reason */}
          {reason && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed italic">
              💡 {reason}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {price && (
            <span
              className="text-sm font-bold"
              style={{ color: colors.accent }}
            >
              {price}
            </span>
          )}
          {rating && (
            <div className="flex items-center gap-0.5 text-[10px] text-amber-500">
              {'★'.repeat(Math.round(rating))}
              <span className="text-slate-400 ml-0.5">{rating.toFixed(1)}</span>
            </div>
          )}
          {badge && (
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
      </div>

      {children}
    </motion.div>
  );
}

// ─── Add to Trip Button ─────────────────────────────

interface AddToTripButtonProps {
  canvasType: CanvasType;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function AddToTripButton({
  canvasType,
  label = 'Add to Trip',
  onClick,
  disabled,
}: AddToTripButtonProps) {
  const colors = CANVAS_COLORS[canvasType];

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="mt-2 w-full py-2 rounded-xl text-[11px] font-semibold text-white disabled:opacity-40 transition-all"
      style={{ backgroundColor: colors.accent }}
    >
      {label}
    </motion.button>
  );
}

// ─── Empty Canvas State ─────────────────────────────

interface EmptyCanvasStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function EmptyCanvasState({ icon, title, description }: EmptyCanvasStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center py-16 px-4"
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/60 mb-3">
        {icon}
      </div>
      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
        {title}
      </h4>
      <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 max-w-[220px] leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
