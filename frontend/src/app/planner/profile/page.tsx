'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, BrainCircuit, MessageSquareQuote, Lightbulb, BadgeCheck } from 'lucide-react';
import { plannerService } from '@/services/planner.service';
import type { TravelerFact } from '@/services/planner.types';

/**
 * The consent surface for traveler memory.
 * Every fact the agent remembers is listed with its provenance and source,
 * and can be deleted. Nothing silently learned is silently applied.
 */

const PROFILE_KEY = ['planner', 'traveler-profile'] as const;

const FACT_LABELS: Record<string, string> = {
  home_origin: 'Usually travels from',
  typical_party_size: 'Typical party size',
  budget_tier: 'Budget style',
  recent_trip_budget: 'Recent trip budget',
  interests: 'Interests',
};

const PROVENANCE_META = {
  stated: { label: 'You told me', icon: MessageSquareQuote, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  confirmed: { label: 'Confirmed by you', icon: BadgeCheck, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  inferred: { label: 'Learned from your trips', icon: Lightbulb, className: 'bg-amber-50 text-amber-700 border-amber-200' },
} as const;

function humanizeKey(key: string): string {
  if (FACT_LABELS[key]) return FACT_LABELS[key];
  if (key.startsWith('rejected.')) return `You rejected a ${key.slice(9).replace(/_/g, ' ')} because`;
  return key.replace(/[._]/g, ' ');
}

function humanizeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if ('amount' in v) return `${v.currency ?? ''} ${Number(v.amount).toLocaleString()}`.trim();
    if (Array.isArray(value)) return value.join(', ');
    return JSON.stringify(value);
  }
  return String(value);
}

export default function TravelerProfilePage() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: plannerService.getTravelerProfile,
  });

  const deleteFact = useMutation({
    mutationFn: (key: string) => plannerService.deleteTravelerFact(key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
  });

  const facts: TravelerFact[] = data?.facts ?? [];

  return (
    <div className="h-full w-full overflow-y-auto bg-paper-0 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#cfe0ff] bg-white text-blue-600 shadow-sm">
            <BrainCircuit size={22} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            What I remember about you
          </h1>
        </div>
        <p className="mb-8 max-w-xl text-sm leading-relaxed text-slate-500">
          These facts help me plan faster — pre-filling your origin, party size, and
          budget instead of asking again. Each one shows where it came from. Delete
          anything, anytime; deleted facts are gone for good and never used again.
        </p>

        {isPending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#ece8dd]" />
            ))}
          </div>
        ) : facts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line-strong bg-white/60 p-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              Nothing here yet. As you plan trips, I&apos;ll note durable preferences —
              your usual origin, party size, budget style — and list every one of them
              here for you to review.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {facts.map((fact) => {
              const meta = PROVENANCE_META[fact.provenance] ?? PROVENANCE_META.inferred;
              const Icon = meta.icon;
              return (
                <div
                  key={fact.key}
                  className="group flex items-start justify-between gap-4 rounded-2xl border border-line bg-white px-5 py-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {humanizeKey(fact.key)}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">
                      {humanizeValue(fact.value)}
                    </p>
                    <span
                      className={`mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${meta.className}`}
                    >
                      <Icon size={10} />
                      {meta.label}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteFact.mutate(fact.key)}
                    disabled={deleteFact.isPending}
                    aria-label={`Forget ${humanizeKey(fact.key)}`}
                    className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
