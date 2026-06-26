'use client';

import { Download, Trash2, Calendar, Hash, MapPin, User2 } from 'lucide-react';
import { TravelPass, DOC_TYPE_META, PassStatus } from '@/types/travelpass';

interface TravelPassCardProps {
  pass: TravelPass;
  onDelete?: (id: string) => void;
  isOwner: boolean;
}

const STATUS_STYLES: Record<PassStatus, string> = {
  ACTIVE:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  UPCOMING: 'bg-sky-50 text-sky-700 border border-sky-200',
  EXPIRED:  'bg-red-50 text-red-700 border border-red-200',
  USED:     'bg-slate-100 text-slate-600 border border-slate-200',
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function TravelPassCard({ pass, onDelete, isOwner }: TravelPassCardProps) {
  const meta = DOC_TYPE_META[pass.document_type] ?? DOC_TYPE_META.OTHER;

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-slate-200 bg-white/70 backdrop-blur-xl shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group"
    >
      {/* Gradient accent bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${meta.colorFrom}, ${meta.colorTo})` }}
      />

      {/* Glow blob */}
      <div
        className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-20 blur-3xl"
        style={{ background: meta.colorFrom }}
      />

      <div className="p-5 flex flex-col gap-4">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Icon badge */}
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${meta.bgClass} border ${meta.borderClass}`}
            >
              {meta.emoji}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">
                {pass.title}
              </h3>
              <p className={`text-xs font-medium mt-0.5 ${meta.textClass}`}>
                {meta.label}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${STATUS_STYLES[pass.status]}`}>
            {pass.status}
          </span>
        </div>

        {/* Route (for transport) */}
        {(pass.origin || pass.destination) && (
          <div className="flex items-center gap-2 text-slate-300">
            <MapPin size={12} className="text-slate-500 shrink-0" />
            <span className="text-xs truncate">
              {pass.origin && pass.destination
                ? `${pass.origin} → ${pass.destination}`
                : pass.origin || pass.destination}
            </span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-slate-200 border-dashed" />

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Valid From */}
          <div className="flex items-start gap-2">
            <Calendar size={12} className="mt-0.5 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Valid From</p>
              <p className="text-xs font-semibold text-slate-800">{formatDate(pass.valid_from)}</p>
            </div>
          </div>
          {/* Valid Until */}
          <div className="flex items-start gap-2">
            <Calendar size={12} className="mt-0.5 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Valid Until</p>
              <p className="text-xs font-semibold text-slate-800">{formatDate(pass.valid_until)}</p>
            </div>
          </div>
          {/* Reference */}
          <div className="flex items-start gap-2">
            <Hash size={12} className="mt-0.5 text-slate-400 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Ref No.</p>
              <p className="text-xs font-mono font-semibold text-slate-800">{pass.reference_number}</p>
            </div>
          </div>
          {/* Issuer */}
          {pass.issuer && (
            <div className="flex items-start gap-2">
              <User2 size={12} className="mt-0.5 text-slate-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Issuer</p>
                <p className="text-xs font-semibold text-slate-800 truncate">{pass.issuer}</p>
              </div>
            </div>
          )}
        </div>

        {/* Seat info pill */}
        {pass.seat_info && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-xs text-slate-600 w-fit">
            🪑 {pass.seat_info}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {pass.document_path && (
            <a
              href={`http://localhost:8000${pass.document_path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-white transition-all"
              style={{ background: `linear-gradient(135deg, ${meta.colorFrom}99, ${meta.colorTo}99)` }}
            >
              <Download size={13} /> Download
            </a>
          )}
          {isOwner && onDelete && (
            <button
              onClick={() => onDelete(pass.id)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
