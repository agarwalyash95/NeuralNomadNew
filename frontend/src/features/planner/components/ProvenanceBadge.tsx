'use client';

import React from 'react';
import { ShieldCheck, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CostProvenance } from '../workspace/plan-canvas/types';

/**
 * ProvenanceBadge — the product-wide trust grammar, rendered.
 *
 *  verified   solid emerald  — a live source or booking confirmed this, timestamped
 *  estimated  dashed amber   — computed from historical data, basis stated
 *  suggested  dotted violet  — AI-generated, not yet checked
 *
 * Aggregations must inherit the weakest tier of their inputs.
 */

const TIER_CONFIG = {
  verified: {
    label: 'Verified',
    icon: ShieldCheck,
    className: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
  estimated: {
    label: 'Estimate',
    icon: TrendingUp,
    className: 'border-dashed border-amber-300 bg-amber-50 text-amber-700',
  },
  suggested: {
    label: 'AI suggested',
    icon: Sparkles,
    className: 'border-dotted border-violet-300 bg-violet-50 text-violet-700',
  },
} as const;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface ProvenanceBadgeProps {
  provenance?: CostProvenance | null;
  className?: string;
  /** Compact: icon + label only; full: adds timestamp/basis detail */
  detail?: boolean;
}

export function ProvenanceBadge({ provenance, className, detail = false }: ProvenanceBadgeProps) {
  if (!provenance?.tier || !(provenance.tier in TIER_CONFIG)) return null;

  const config = TIER_CONFIG[provenance.tier];
  const Icon = config.icon;

  const detailText =
    provenance.tier === 'verified' && provenance.verified_at
      ? relativeTime(provenance.verified_at)
      : detail && provenance.basis
        ? provenance.basis
        : null;

  const tooltip = [
    config.label,
    provenance.source && `via ${provenance.source}`,
    provenance.basis,
    provenance.verified_at && `at ${new Date(provenance.verified_at).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <span
      title={tooltip}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
        config.className,
        className
      )}
    >
      <Icon size={10} strokeWidth={2.5} />
      <span>{config.label}</span>
      {detailText && <span className="font-medium normal-case opacity-80">· {detailText}</span>}
    </span>
  );
}
