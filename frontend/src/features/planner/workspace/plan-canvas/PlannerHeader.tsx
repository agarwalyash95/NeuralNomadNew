'use client';

import React, { useEffect, useState } from 'react';
import {
  Download, MoreVertical, CreditCard, Loader2, Route, Bookmark, BookmarkCheck,
  Calendar, Users, Pencil, Ticket, Undo2, Redo2, Gauge,
  List, Map as MapViewIcon,
} from 'lucide-react';
import { MockTripData } from './types';
import TransportPreferencesPanel from '@/features/planner/components/TransportPreferencesPanel';

export type CanvasViewMode = 'details' | 'map';

interface PlannerHeaderProps {
  data: MockTripData;
  onExport?: () => void;
  isExporting?: boolean;
  isSavingCloud?: boolean;
  onBook?: () => void;
  onViewPasses?: () => void;
  onOptimizeRoutes?: () => void;
  onSave?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
  onRenameTitle?: (title: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  viewMode?: CanvasViewMode;
  onViewModeChange?: (mode: CanvasViewMode) => void;
}

export default function PlannerHeader({
  data, onExport, isExporting, isSavingCloud, onBook, onViewPasses,
  onOptimizeRoutes, onSave, isSaving, isSaved, onRenameTitle,
  onUndo, onRedo, canUndo, canRedo,
  viewMode, onViewModeChange,
}: PlannerHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(data.title);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMenuOpen]);

  const hasBookedItems = data.cities.some(city => {
    if (city.transitToNext?.status === 'Confirmed') return true;
    return city.days.some(day => day.items.some(item => item.status === 'Confirmed'));
  });

  const dateRange = data.startDate && data.endDate ? `${data.startDate} → ${data.endDate}` : null;

  const commitTitle = () => {
    setIsEditingTitle(false);
    const next = titleDraft.trim();
    if (next && next !== data.title) onRenameTitle?.(next);
    else setTitleDraft(data.title);
  };

  return (
    <div className="mb-2 rounded-2xl bg-white px-4 py-3 shadow-surface">

      {/* ── Row 1: Trip title + actions ─────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {/* Title — editorial chapter-title weight */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {isEditingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle();
                if (e.key === 'Escape') { setTitleDraft(data.title); setIsEditingTitle(false); }
              }}
              className="min-w-0 flex-1 rounded-xl border border-line-strong bg-paper-0 px-3 py-1.5 text-[18px] font-bold tracking-tight text-ink-900 outline-none focus:border-[rgb(var(--color-booking))]"
              maxLength={120}
            />
          ) : (
            <button
              onClick={() => { setTitleDraft(data.title); setIsEditingTitle(true); }}
              className="group flex min-w-0 flex-1 items-center gap-2 text-left cursor-text export-hidden"
              title="Rename trip"
            >
              {/* Information hierarchy #1: Destination */}
              <h1 className="truncate text-[20px] font-bold tracking-tight text-ink-900 leading-tight">
                {data.title}
              </h1>
              <Pencil size={12} className="shrink-0 text-ink-400 opacity-0 transition group-hover:opacity-100" />
            </button>
          )}

          {/* Date chip */}
          {dateRange && (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper-0 px-2.5 py-1 text-caption font-semibold !text-ink-600 sm:flex">
              <Calendar size={10} className="text-ink-400" />
              {dateRange}
            </span>
          )}

          {/* Travelers chip */}
          {data.travelers != null && data.travelers > 0 && (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper-0 px-2.5 py-1 text-caption font-semibold !text-ink-600 md:flex">
              <Users size={10} className="text-ink-400" />
              {data.travelers}
            </span>
          )}

          {isSavingCloud && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-paper-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-500">
              <Loader2 size={9} className="animate-spin" /> Saving
            </span>
          )}
        </div>

        {/* Actions — right side */}
        <div className="flex shrink-0 items-center gap-1.5 export-hidden">
          {/* Undo/Redo */}
          {(onUndo || onRedo) && (
            <div className="flex items-center overflow-hidden rounded-xl border border-line bg-paper-0">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className="cursor-pointer p-2 text-ink-500 transition hover:bg-paper-1 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
                style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={13} />
              </button>
              <div className="h-4 w-px bg-line" />
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className="cursor-pointer p-2 text-ink-500 transition hover:bg-paper-1 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
                style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 size={13} />
              </button>
            </div>
          )}

          {/* Save — ghost outlined, emerald when saved */}
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving || isSaved}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-caption font-semibold transition-all active:scale-95 ${
                isSaved
                  ? 'cursor-default border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'cursor-pointer border-line bg-white text-ink-700 hover:bg-paper-0 hover:shadow-surface disabled:opacity-60'
              }`}
              style={{ transition: `all var(--motion-card) var(--ease-out)` }}
              title={isSaved ? 'Plan saved' : 'Save this plan'}
            >
              {isSaving
                ? <Loader2 size={11} className="animate-spin" />
                : isSaved
                  ? <BookmarkCheck size={11} />
                  : <Bookmark size={11} />}
              <span>{isSaving ? 'Saving…' : isSaved ? 'Saved' : 'Save'}</span>
            </button>
          )}

          {/* Book — primary dark button (NOT blue) */}
          <button
            onClick={onBook}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-ink-900 px-3 py-1.5 text-caption font-semibold !text-paper-1 shadow-surface transition-all hover:shadow-hover hover:opacity-90 active:scale-95"
            style={{ transition: `all var(--motion-card) var(--ease-out)` }}
          >
            <CreditCard size={11} />
            <span>Book</span>
          </button>

          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="More actions"
              className="cursor-pointer rounded-xl border border-line bg-white p-1.5 text-ink-500 transition hover:bg-paper-0 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-booking))] focus-visible:ring-offset-1"
              style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
              title="More Actions"
            >
              <MoreVertical size={14} />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-2 w-48 rounded-2xl border border-line bg-white p-1.5 shadow-modal animate-in fade-in duration-150"
                >
                  {hasBookedItems && (
                    <button
                      role="menuitem"
                      onClick={() => { onViewPasses?.(); setIsMenuOpen(false); }}
                      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-medium text-emerald-700 transition hover:bg-emerald-50"
                      style={{ transition: `background var(--motion-hover) var(--ease-out)` }}
                    >
                      <Ticket size={13} className="text-emerald-500" />
                      <span>View Passes</span>
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => { onOptimizeRoutes?.(); setIsMenuOpen(false); }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-medium text-ink-700 transition hover:bg-paper-0"
                    style={{ transition: `background var(--motion-hover) var(--ease-out)` }}
                  >
                    <Route size={13} className="text-ink-400" />
                    <span>Optimize Routes</span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setIsPrefsOpen(true); setIsMenuOpen(false); }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-medium text-ink-700 transition hover:bg-paper-0"
                    style={{ transition: `background var(--motion-hover) var(--ease-out)` }}
                  >
                    <Gauge size={13} className="text-ink-400" />
                    <span>Transport Preferences</span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { onExport?.(); setIsMenuOpen(false); }}
                    disabled={isExporting}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-medium text-ink-700 transition hover:bg-paper-0 disabled:opacity-50"
                    style={{ transition: `background var(--motion-hover) var(--ease-out)` }}
                  >
                    {isExporting
                      ? <Loader2 size={13} className="animate-spin text-ink-400" />
                      : <Download size={13} className="text-ink-400" />}
                    <span>{isExporting ? 'Exporting…' : 'Export PDF'}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* View switcher — Details / Map segmented control, rightmost. Kept
              in the top row (rather than the nav row below) so the city/day
              chip row keeps its full width for chips and canvas content. */}
          {onViewModeChange && (
            <div
              role="tablist"
              aria-label="Canvas view"
              className="flex items-center overflow-hidden rounded-xl border border-line bg-paper-0 p-0.5"
            >
              <button
                role="tab"
                aria-selected={viewMode !== 'map'}
                onClick={() => onViewModeChange('details')}
                className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-caption font-semibold whitespace-nowrap ${
                  viewMode !== 'map'
                    ? 'bg-[rgb(var(--color-journey)/0.18)] text-ink-900 shadow-surface'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
                style={{ transition: `all var(--motion-card) var(--ease-out)` }}
              >
                <List size={12} />
                <span>Details</span>
              </button>
              <button
                role="tab"
                aria-selected={viewMode === 'map'}
                onClick={() => onViewModeChange('map')}
                className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-caption font-semibold whitespace-nowrap ${
                  viewMode === 'map'
                    ? 'bg-[rgb(var(--color-journey)/0.18)] text-ink-900 shadow-surface'
                    : 'text-ink-500 hover:text-ink-900'
                }`}
                style={{ transition: `all var(--motion-card) var(--ease-out)` }}
              >
                <MapViewIcon size={12} />
                <span>Map</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {isPrefsOpen && <TransportPreferencesPanel onClose={() => setIsPrefsOpen(false)} />}
    </div>
  );
}
