'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Download, MoreVertical, CreditCard, Loader2, Route, Bookmark, BookmarkCheck,
  Calendar, Users, Pencil, Ticket, MapPin, Milestone, Undo2, Redo2, Gauge,
} from 'lucide-react';
import { MockTripData } from './types';
import { parsePriceToInteger } from './utils/priceParser';
import type { TripLedger } from '@/services/planner.types';
import TransportPreferencesPanel from '@/features/planner/components/TransportPreferencesPanel';

interface PlannerHeaderProps {
  data: MockTripData;
  /** Server-computed money truth: committed vs planned vs budget, by tier */
  ledger?: TripLedger | null;
  onExport?: () => void;
  isExporting?: boolean;
  isSavingCloud?: boolean;
  onBook?: () => void;
  onViewPasses?: () => void;
  /** Files a route-optimization proposal (AI proposes, user decides) */
  onOptimizeRoutes?: () => void;
  /** Save the plan — moves the trip to the Saved sidebar bucket */
  onSave?: () => void;
  isSaving?: boolean;
  /** status === 'saved' && !is_modified — renders the button as "Saved" */
  isSaved?: boolean;
  /** Rename the trip (persisted to trip + workspace) */
  onRenameTitle?: (title: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const HATCH_AMBER =
  'repeating-linear-gradient(135deg, rgb(var(--trust-estimated) / 0.75) 0 4px, rgb(var(--trust-estimated) / 0.35) 4px 8px)';
const HATCH_VIOLET =
  'repeating-linear-gradient(135deg, rgb(var(--trust-suggested) / 0.7) 0 4px, rgb(var(--trust-suggested) / 0.3) 4px 8px)';

export default function PlannerHeader({
  data, ledger, onExport, isExporting, isSavingCloud, onBook, onViewPasses,
  onOptimizeRoutes, onSave, isSaving, isSaved, onRenameTitle,
  onUndo, onRedo, canUndo, canRedo,
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

  // ── Stat chips: structured facts only ────────────────────────────────────
  const stats = useMemo(() => {
    const dayCount = data.cities.reduce((n, c) => n + c.days.length, 0);
    const cityCount = data.cities.length;
    let totalKm = 0;
    data.cities.forEach(c =>
      c.days.forEach(d => {
        Object.values(d.transitHints ?? {}).forEach(h => { totalKm += h.distance_km; });
      })
    );
    return { dayCount, cityCount, totalKm: Math.round(totalKm) };
  }, [data]);

  const dateRange = data.startDate && data.endDate ? `${data.startDate} → ${data.endDate}` : null;

  // ── Money: prefer the server ledger, fall back to client sums ────────────
  const money = useMemo(() => {
    if (ledger) {
      return {
        currency: ledger.currency,
        committed: ledger.committed,
        planned: ledger.planned_estimate,
        plannedTier: ledger.planned_tier,
        budget: ledger.budget,
      };
    }
    let committed = 0;
    data.cities.forEach(city => {
      const count = (item: typeof city.transitToNext) => {
        if (!item || item.isInactive || item.status !== 'Confirmed') return;
        committed += item.cost?.amount ?? (item.price ? parsePriceToInteger(item.price) : 0);
      };
      count(city.transitToNext);
      city.days.forEach(day => day.items.forEach(count));
    });
    return {
      currency: data.budget?.currency ?? 'INR',
      committed,
      planned: 0,
      plannedTier: null as TripLedger['planned_tier'],
      budget: data.budget?.amount ?? null,
    };
  }, [ledger, data]);

  const symbol = money.currency === 'INR' ? '₹' : `${money.currency} `;
  const barTotal = Math.max(money.budget ?? 0, money.committed + money.planned, 1);
  const committedPct = Math.min(100, (money.committed / barTotal) * 100);
  const plannedPct = Math.min(100 - committedPct, (money.planned / barTotal) * 100);
  const isOver = money.budget !== null && money.committed + money.planned > money.budget;

  const commitTitle = () => {
    setIsEditingTitle(false);
    const next = titleDraft.trim();
    if (next && next !== data.title) onRenameTitle?.(next);
    else setTitleDraft(data.title);
  };

  return (
    <div className="mb-3 rounded-[14px] border border-line bg-paper-2 px-3.5 py-2.5 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.35)]">
      {/* ── Row 1: identity + actions ── */}
      <div className="flex items-center gap-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {isEditingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(data.title); setIsEditingTitle(false); } }}
              className="min-w-0 flex-1 rounded-lg border border-line-strong bg-paper-1 px-2 py-1 text-[15px] font-semibold tracking-tight text-ink-900 outline-none focus:border-blue-400"
              maxLength={120}
            />
          ) : (
            <button
              onClick={() => { setTitleDraft(data.title); setIsEditingTitle(true); }}
              className="group flex min-w-0 items-center gap-1.5 text-left cursor-text export-hidden"
              title="Rename trip"
            >
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-ink-900">{data.title}</h1>
              <Pencil size={11} className="shrink-0 text-ink-400 opacity-0 transition group-hover:opacity-100" />
            </button>
          )}

          {dateRange && (
            <span className="hidden shrink-0 items-center gap-1 rounded-full border border-line bg-paper-1 px-2 py-0.5 text-[10px] font-bold text-ink-500 sm:flex">
              <Calendar size={10} className="text-ink-400" />
              {dateRange}
            </span>
          )}
          {data.travelers != null && data.travelers > 0 && (
            <span className="hidden shrink-0 items-center gap-1 rounded-full border border-line bg-paper-1 px-2 py-0.5 text-[10px] font-bold text-ink-500 md:flex">
              <Users size={10} className="text-ink-400" />
              {data.travelers}
            </span>
          )}
          {isSavingCloud && (
            <span className="flex shrink-0 items-center gap-1 rounded-sm bg-blue-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-blue-600">
              <Loader2 size={9} className="animate-spin" /> Saving
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 export-hidden">
          {(onUndo || onRedo) && (
            <div className="flex items-center overflow-hidden rounded-lg border border-line-strong bg-paper-2">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className="cursor-pointer p-1.5 text-ink-500 transition hover:bg-paper-1 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={13} />
              </button>
              <div className="h-4 w-px bg-line-strong" />
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className="cursor-pointer p-1.5 text-ink-500 transition hover:bg-paper-1 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 size={13} />
              </button>
            </div>
          )}
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving || isSaved}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-all duration-200 active:scale-95 ${
                isSaved
                  ? 'cursor-default border-emerald-200 bg-emerald-50 text-trust-verified'
                  : 'cursor-pointer border-line-strong bg-paper-2 text-ink-700 hover:bg-paper-1 hover:shadow-sm disabled:opacity-60'
              }`}
              title={isSaved ? 'Plan saved — edits move it back to Recent' : 'Save this plan'}
            >
              {isSaving ? <Loader2 size={11} className="animate-spin" /> : isSaved ? <BookmarkCheck size={11} /> : <Bookmark size={11} />}
              <span>{isSaving ? 'Saving…' : isSaved ? 'Saved' : 'Save'}</span>
            </button>
          )}

          <button
            onClick={onBook}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-blue-600 px-3 py-1 text-[11px] font-bold text-white shadow-xs transition-all duration-200 hover:bg-blue-700 hover:shadow-md active:scale-95"
          >
            <CreditCard size={11} />
            <span>Book</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="More actions"
              className="cursor-pointer rounded-lg border border-line-strong bg-paper-2 p-1 text-ink-500 transition hover:bg-paper-1 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
              title="More Actions"
            >
              <MoreVertical size={13} />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
                <div role="menu" className="absolute right-0 z-20 mt-1.5 w-44 rounded-xl border border-line bg-paper-2 p-1.5 shadow-[0_12px_24px_-8px_rgba(15,23,42,0.18)] animate-in fade-in slide-in-from-top-2 duration-150">
                  {hasBookedItems && (
                    <button
                      role="menuitem"
                      onClick={() => { onViewPasses?.(); setIsMenuOpen(false); }}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      <Ticket size={13} className="text-emerald-500" />
                      <span>View Passes</span>
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => { onOptimizeRoutes?.(); setIsMenuOpen(false); }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-ink-700 transition hover:bg-paper-1"
                  >
                    <Route size={13} className="text-ink-400" />
                    <span>Optimize routes</span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setIsPrefsOpen(true); setIsMenuOpen(false); }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-ink-700 transition hover:bg-paper-1"
                  >
                    <Gauge size={13} className="text-ink-400" />
                    <span>Transport preferences</span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { onExport?.(); setIsMenuOpen(false); }}
                    disabled={isExporting}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-ink-700 transition hover:bg-paper-1 disabled:opacity-50"
                  >
                    {isExporting ? <Loader2 size={13} className="animate-spin text-ink-400" /> : <Download size={13} className="text-ink-400" />}
                    <span>{isExporting ? 'Exporting…' : 'Export PDF'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: stat chips + segmented budget bar ── */}
      <div className="mt-2 flex items-center gap-3">
        <div className="flex shrink-0 items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-ink-500">
          <span className="flex items-center gap-0.5"><Calendar size={10} className="text-ink-400" />{stats.dayCount}d</span>
          <span className="text-line-strong">·</span>
          <span className="flex items-center gap-0.5"><MapPin size={10} className="text-ink-400" />{stats.cityCount} {stats.cityCount === 1 ? 'city' : 'cities'}</span>
          {stats.totalKm > 0 && (
            <>
              <span className="text-line-strong">·</span>
              <span className="flex items-center gap-0.5 tabular-nums"><Milestone size={10} className="text-ink-400" />{stats.totalKm} km</span>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[10px] font-extrabold tabular-nums text-ink-900" title="Committed (booked) spend">
            {symbol}{Math.round(money.committed).toLocaleString()}
          </span>
          <div
            className="h-2 min-w-0 flex-1 overflow-hidden rounded-full border border-line bg-paper-0"
            title={
              `Committed ${symbol}${Math.round(money.committed).toLocaleString()}` +
              (money.planned > 0 ? ` · planned${money.plannedTier === 'verified' ? '' : ' (est.)'} ${symbol}${Math.round(money.planned).toLocaleString()}` : '') +
              (money.budget !== null ? ` · budget ${symbol}${Math.round(money.budget).toLocaleString()}` : '')
            }
          >
            <div className="flex h-full w-full">
              <div
                className={`h-full transition-all duration-500 ${isOver ? 'bg-red-500' : 'bg-trust-verified'}`}
                style={{ width: `${committedPct}%` }}
              />
              {plannedPct > 0 && (
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${plannedPct}%`,
                    backgroundImage: money.plannedTier === 'suggested' ? HATCH_VIOLET : HATCH_AMBER,
                  }}
                />
              )}
            </div>
          </div>
          <span className="shrink-0 text-[10px] font-bold tabular-nums text-ink-500" title="Trip budget">
            {money.budget !== null ? `${symbol}${Math.round(money.budget).toLocaleString()}` : 'no budget'}
          </span>
        </div>
      </div>

      {isPrefsOpen && <TransportPreferencesPanel onClose={() => setIsPrefsOpen(false)} />}
    </div>
  );
}
