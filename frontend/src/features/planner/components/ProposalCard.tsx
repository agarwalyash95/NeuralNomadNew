'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Loader2, Route, Sparkles, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanProposal } from '@/services/planner.types';

/**
 * ProposalCard — the universal grammar for AI-initiated change:
 * card → rationale + deltas → Accept / Reject (with reason).
 * Rejection reasons are captured so the agent never re-proposes rejected ideas.
 */

const REJECT_REASONS = ['Too rushed', "Don't like it", 'Prefer my order', 'Other'];

const KIND_ICON: Record<string, React.ReactNode> = {
  route_optimization: <Route size={14} />,
  price_watch: <TrendingDown size={14} />,
  plan_edit: <Sparkles size={14} />,
};

interface ProposalCardProps {
  proposal: PlanProposal;
  onAccept: (proposalId: string) => Promise<unknown>;
  onReject: (proposalId: string, reason?: string) => Promise<unknown>;
}

export function ProposalCard({ proposal, onAccept, onReject }: ProposalCardProps) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [conflict, setConflict] = useState(false);

  const deltas = proposal.diff?.deltas;

  const handleAccept = async () => {
    setIsBusy(true);
    try {
      await onAccept(proposal.id);
    } catch (err) {
      if ((err as { status?: number }).status === 409) setConflict(true);
    } finally {
      setIsBusy(false);
    }
  };

  const handleReject = async (reason?: string) => {
    setIsBusy(true);
    try {
      await onReject(proposal.id, reason);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      className="w-[340px] rounded-2xl border border-[rgb(var(--color-ai)/0.25)] bg-paper-2 p-4 shadow-modal"
    >
      <div className="flex items-center gap-2 text-[rgb(var(--color-ai))]">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[rgb(var(--color-ai)/0.08)]">
          {KIND_ICON[proposal.kind] ?? KIND_ICON.plan_edit}
        </span>
        <h4 className="flex-1 text-xs font-bold text-ink-900">{proposal.title}</h4>
        <span className="rounded-full bg-[rgb(var(--color-ai)/0.08)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[rgb(var(--color-ai))]">
          Proposal
        </span>
      </div>

      {proposal.rationale && (
        <p className="mt-2 text-[11px] font-medium leading-relaxed text-ink-600">
          {proposal.rationale}
        </p>
      )}

      {(deltas?.saved_km || deltas?.saved_mins || deltas?.cost_delta) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {deltas.saved_km ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              −{deltas.saved_km.toFixed(1)} km travel
            </span>
          ) : null}
          {deltas.saved_mins ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              saves ~{Math.round(deltas.saved_mins)} min
            </span>
          ) : null}
          {deltas.cost_delta ? (
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                deltas.cost_delta < 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              )}
            >
              {deltas.cost_delta < 0 ? '−' : '+'}₹{Math.abs(deltas.cost_delta).toLocaleString()}
            </span>
          ) : null}
        </div>
      )}

      {conflict ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
          The plan changed since this was suggested — this proposal has expired.
        </p>
      ) : isRejecting ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
            Why not? (helps me stop suggesting this)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {REJECT_REASONS.map((reason) => (
              <button
                key={reason}
                disabled={isBusy}
                onClick={() => handleReject(reason === 'Other' ? undefined : reason)}
                className="cursor-pointer rounded-full border border-line bg-paper-2 px-2.5 py-1 text-[10px] font-semibold text-ink-600 transition-colors hover:border-line-strong hover:bg-paper-1"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            disabled={isBusy}
            onClick={() => setIsRejecting(true)}
            className="flex cursor-pointer items-center gap-1 rounded-xl border border-line bg-paper-2 px-3 py-1.5 text-[11px] font-bold text-ink-600 transition-colors hover:bg-paper-1"
          >
            <X size={12} />
            Reject
          </button>
          <button
            disabled={isBusy}
            onClick={handleAccept}
            className="flex cursor-pointer items-center gap-1 rounded-xl bg-[rgb(var(--color-ai))] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-surface transition-colors hover:bg-violet-700"
          >
            {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Accept
          </button>
        </div>
      )}
    </motion.div>
  );
}
