'use client';

import React, { useMemo, useState } from 'react';
import { MapPin, AlertTriangle, Ticket, ChevronDown, Wand2 } from 'lucide-react';
import { MockTripData, ItineraryCity, ItineraryDay } from './types';
import type { TripLedger } from '@/services/planner.types';
import { parsePriceToInteger } from './utils/priceParser';
import { useInsights } from '@/features/planner/hooks/usePlannerQueries';
import InsightStrip from './InsightStrip';
import { scrollToNode } from './utils/scrollToNode';

/** Categories that can actually be booked — mirrors the checkout flow's
 *  BOOKABLE_TYPES (PlannerWorkspace.tsx), kept in sync deliberately: both
 *  answer "does this block represent something you book," not "is it costed." */
const BOOKABLE_TYPES = new Set(['flight', 'train', 'bus', 'cab', 'taxi', 'hotel']);

interface TripStatusSpineProps {
  data: MockTripData;
  ledger?: TripLedger | null;
  workspaceId: string | null;
  focusedDayId: string | null;
  activeCityId: string | null;
  onCityFocus: (city: ItineraryCity) => void;
  onDayFocus: (day: ItineraryDay) => void;
  onReviewBooking: () => void;
}

const HATCH_AMBER =
  'repeating-linear-gradient(135deg, rgb(var(--trust-estimated) / 0.75) 0 4px, rgb(var(--trust-estimated) / 0.35) 4px 8px)';
const HATCH_VIOLET =
  'repeating-linear-gradient(135deg, rgb(var(--trust-suggested) / 0.7) 0 4px, rgb(var(--trust-suggested) / 0.3) 4px 8px)';

export default function TripStatusSpine({
  data, ledger, workspaceId, focusedDayId, activeCityId, onCityFocus, onDayFocus, onReviewBooking,
}: TripStatusSpineProps) {
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [toBookOpen, setToBookOpen] = useState(false);

  const { data: insights = [] } = useInsights(workspaceId);

  // ── Where am I — live position readout ──────────────────────────────────
  const position = useMemo(() => {
    const totalDays = data.cities.reduce((n, c) => n + c.days.length, 0);
    for (const city of data.cities) {
      const day = city.days.find((d) => d.id === focusedDayId);
      if (day) return { dayNumber: day.dayNumber, totalDays, cityName: city.cityName };
    }
    // Fall back to the active city's first day, else just totals.
    const activeCity = data.cities.find((c) => c.id === activeCityId);
    return { dayNumber: activeCity?.days[0]?.dayNumber ?? 1, totalDays, cityName: activeCity?.cityName ?? data.cities[0]?.cityName ?? '' };
  }, [data, focusedDayId, activeCityId]);

  // ── Budget bar — moved here from PlannerHeader unchanged ────────────────
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
  const budgetBarColor = isOver
    ? 'bg-red-500'
    : committedPct > 80
      ? 'bg-amber-500'
      : 'bg-[rgb(var(--color-confirmed))]';

  // ── To-book rollup — same bookable/priced/not-yet-booked predicate the
  //    checkout flow uses, computed here to answer "what still needs booking"
  //    without waiting for the traveler to open Checkout to find out. ──────
  const toBookItems = useMemo(() => {
    const out: { id: string; title: string; dayNumber: number }[] = [];
    data.cities.forEach((city) => {
      const consider = (item: typeof city.transitToNext, dayNumber: number) => {
        if (!item || item.isInactive || item.blockStatus === 'booked') return;
        if (!BOOKABLE_TYPES.has(item.type) || !item.price) return;
        out.push({ id: item.id, title: item.title, dayNumber });
      };
      const lastDay = city.days[city.days.length - 1];
      consider(city.transitToNext, lastDay?.dayNumber ?? 0);
      city.days.forEach((day) => day.items.forEach((item) => consider(item, day.dayNumber)));
    });
    return out;
  }, [data]);

  const warningCount = insights.filter((i) => i.severity === 'warning').length || insights.length;

  return (
    <div className="flex w-full flex-col gap-2 border-b border-line/40 bg-paper-1 px-6 py-2.5 shrink-0">
      {/* PROV-01 (docs/planner-complete-current-audit-and-repair-plan.md
          §19 R13): distinct from the review-recommended banner (moved to
          Checkout) — this is a stronger, more urgent signal ("this isn't
          the AI-composed plan you asked for") that needs to persist
          wherever the trip is viewed, not just the ~1.8s loading-screen
          transition. Violet, not amber, matching the app's existing
          "AI/suggested" trust-tier color (ProvenanceBadge). */}
      {data.degraded && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] text-violet-900">
          <Wand2 size={13} className="mt-0.5 shrink-0" />
          <p className="font-bold">
            This is a starter plan — our AI planner had trouble generating a full itinerary, so we built this from verified basics. You can customize everything, or try regenerating.
          </p>
        </div>
      )}
      {/* ── Row 1: live position + progress cue + rollups ─────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="shrink-0 text-[15px] font-bold tracking-tight text-ink-900">
            Day {position.dayNumber} of {position.totalDays}
            {position.cityName && <span className="font-medium text-ink-500"> · {position.cityName}</span>}
          </h2>
          {/* Quiet trip-progress cue — a muted line, not a game bar */}
          <div className="hidden h-1 w-20 shrink-0 overflow-hidden rounded-full bg-line/50 sm:block" title="Progress through your trip">
            <div
              className="h-full rounded-full bg-ink-400/50"
              style={{ width: `${Math.min(100, (position.dayNumber / Math.max(position.totalDays, 1)) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Attention rollup */}
          {insights.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => { setAttentionOpen((v) => !v); setToBookOpen(false); }}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/70 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
              >
                <AlertTriangle size={11} className="text-amber-500" />
                {warningCount} need{warningCount === 1 ? 's' : ''} attention
                <ChevronDown size={11} className={`text-amber-500 transition-transform ${attentionOpen ? 'rotate-180' : ''}`} />
              </button>
              {attentionOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setAttentionOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-line bg-white p-2.5 shadow-modal">
                    <InsightStrip
                      workspaceId={workspaceId}
                      onSelect={(insight) => {
                        scrollToNode(insight.related_block_ids?.[0], insight.day_number);
                        setAttentionOpen(false);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* To-book rollup */}
          {toBookItems.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => { setToBookOpen((v) => !v); setAttentionOpen(false); }}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[rgb(var(--color-booking)/0.3)] bg-[rgb(var(--color-booking)/0.06)] px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--color-booking))] hover:bg-[rgb(var(--color-booking)/0.12)]"
              >
                <Ticket size={11} />
                {toBookItems.length} to book
                <ChevronDown size={11} className={`transition-transform ${toBookOpen ? 'rotate-180' : ''}`} />
              </button>
              {toBookOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setToBookOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-line bg-white p-2 shadow-modal">
                    <div className="flex flex-col gap-1">
                      {toBookItems.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => { scrollToNode(it.id, it.dayNumber); setToBookOpen(false); }}
                          className="flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-[11.5px] font-medium text-ink-700 hover:bg-paper-0"
                        >
                          <span className="truncate">{it.title}</span>
                          <span className="shrink-0 text-[10px] text-ink-400">Day {it.dayNumber}</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => { onReviewBooking(); setToBookOpen(false); }}
                      className="mt-1.5 w-full cursor-pointer rounded-xl bg-ink-900 px-3 py-1.5 text-[11px] font-semibold text-paper-1 hover:opacity-90"
                    >
                      Review & book
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: day/city chip rail + budget bar ───────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-[55%]">
          {data.cities.map((city) => (
            <button
              key={city.id}
              onClick={() => onCityFocus(city)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeCityId === city.id
                  ? 'bg-[rgb(var(--color-journey)/0.18)] border-[rgb(var(--color-journey)/0.5)] text-ink-900'
                  : 'border-line bg-white text-ink-500 hover:border-[rgb(var(--color-journey)/0.4)] hover:text-ink-900'
              }`}
              style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
            >
              <MapPin size={9} className="shrink-0" /> {city.cityName}
            </button>
          ))}

          {data.cities.length > 0 && <div className="h-3 w-px bg-line/60 shrink-0 mx-1" />}

          {data.cities.flatMap((c) => c.days).map((day) => (
            <button
              key={day.id}
              onClick={() => onDayFocus(day)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                focusedDayId === day.id
                  ? 'bg-[rgb(var(--color-journey)/0.18)] border-[rgb(var(--color-journey)/0.5)] text-ink-900'
                  : 'border-line bg-white text-ink-500 hover:border-[rgb(var(--color-journey)/0.4)] hover:text-ink-900'
              }`}
              style={{ transition: `all var(--motion-hover) var(--ease-out)` }}
            >
              D{day.dayNumber}
            </button>
          ))}
        </div>

        {/* Budget bar — real weight now: bigger track, clearer digits */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink-700" title="Committed (booked) spend">
            {symbol}{Math.round(money.committed).toLocaleString()}
          </span>
          <div
            className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-paper-0 border border-line/60"
            title={
              `Committed ${symbol}${Math.round(money.committed).toLocaleString()}` +
              (money.planned > 0
                ? ` · planned${money.plannedTier === 'verified' ? '' : ' (est.)'} ${symbol}${Math.round(money.planned).toLocaleString()}`
                : '') +
              (money.budget !== null ? ` · budget ${symbol}${Math.round(money.budget).toLocaleString()}` : '')
            }
          >
            <div className="flex h-full w-full">
              <div
                className={`h-full ${budgetBarColor} rounded-full`}
                style={{ width: `${committedPct}%`, transition: `width var(--motion-bar) var(--ease-out)` }}
              />
              {plannedPct > 0 && (
                <div
                  className="h-full rounded-r-full"
                  style={{
                    width: `${plannedPct}%`,
                    backgroundImage: money.plannedTier === 'suggested' ? HATCH_VIOLET : HATCH_AMBER,
                    transition: `width var(--motion-bar) var(--ease-out)`,
                  }}
                />
              )}
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-ink-500" title="Trip budget">
            {money.budget !== null ? `${symbol}${Math.round(money.budget).toLocaleString()}` : 'No budget set'}
          </span>
        </div>
      </div>
    </div>
  );
}
