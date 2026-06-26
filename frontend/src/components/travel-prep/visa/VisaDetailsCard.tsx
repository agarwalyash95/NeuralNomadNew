'use client';

import { ExternalLink, Clock, DollarSign, FileText, ShieldCheck, ShieldX, Globe, Timer, CalendarDays } from 'lucide-react';
import GlassCard from '@/components/ui-custom/glass-card';
import { VisaInfo } from '@/types/visa';

interface VisaDetailsCardProps {
  visa: VisaInfo;
}

const ENTRY_TYPE_LABEL: Record<string, string> = {
  SINGLE: 'Single Entry',
  MULTIPLE: 'Multiple Entry',
  UNKNOWN: 'Not Specified',
  '': 'Not Specified',
};

export default function VisaDetailsCard({ visa }: VisaDetailsCardProps) {
  return (
    <GlassCard className="p-6 flex flex-col gap-6">

      {/* Country Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{visa.country}</h2>
          {visa.visa_type && (
            <p className="text-sm text-slate-500 mt-0.5">{visa.visa_type}</p>
          )}
        </div>
        {visa.visa_required ? (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5">
            <ShieldX size={18} className="text-red-500" />
            <div>
              <p className="text-xs text-red-400 font-medium uppercase tracking-wider">Visa Status</p>
              <p className="text-sm font-bold text-red-700">Required</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-2.5">
            <ShieldCheck size={18} className="text-green-500" />
            <div>
              <p className="text-xs text-green-400 font-medium uppercase tracking-wider">Visa Status</p>
              <p className="text-sm font-bold text-green-700">Not Required</p>
            </div>
          </div>
        )}
      </div>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

        {/* Processing Time */}
        <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4">
          <Clock size={18} className="text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-blue-400 font-medium uppercase tracking-wider">Processing Time</p>
            <p className="text-sm font-bold text-blue-800 mt-0.5">
              {visa.processing_time || (visa.processing_time_days ? `${visa.processing_time_days} days` : '—')}
            </p>
          </div>
        </div>

        {/* Cost */}
        <div className="flex items-start gap-3 rounded-xl bg-indigo-50 border border-indigo-100 p-4">
          <DollarSign size={18} className="text-indigo-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-indigo-400 font-medium uppercase tracking-wider">Visa Fee</p>
            <p className="text-sm font-bold text-indigo-800 mt-0.5">
              {visa.fees != null ? `${visa.fees} ${visa.currency}` : 'Free / N/A'}
            </p>
          </div>
        </div>

        {/* Validity */}
        <div className="flex items-start gap-3 rounded-xl bg-violet-50 border border-violet-100 p-4">
          <FileText size={18} className="text-violet-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-violet-400 font-medium uppercase tracking-wider">Validity</p>
            <p className="text-sm font-bold text-violet-800 mt-0.5">
              {visa.validity || '—'}
            </p>
          </div>
        </div>

        {/* Entry Type */}
        <div className="flex items-start gap-3 rounded-xl bg-teal-50 border border-teal-100 p-4">
          <Globe size={18} className="text-teal-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-teal-400 font-medium uppercase tracking-wider">Entry Type</p>
            <p className="text-sm font-bold text-teal-800 mt-0.5">
              {ENTRY_TYPE_LABEL[visa.entry_type] ?? 'Not Specified'}
            </p>
          </div>
        </div>

        {/* Max Stay Duration */}
        {visa.max_stay_duration && (
          <div className="flex items-start gap-3 rounded-xl bg-orange-50 border border-orange-100 p-4">
            <Timer size={18} className="text-orange-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-orange-400 font-medium uppercase tracking-wider">Max Stay</p>
              <p className="text-sm font-bold text-orange-800 mt-0.5">
                {visa.max_stay_duration}
              </p>
            </div>
          </div>
        )}

        {/* Last Updated */}
        {visa.updated_at && (
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <CalendarDays size={18} className="text-slate-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Last Updated</p>
              <p className="text-sm font-bold text-slate-600 mt-0.5">
                {new Date(visa.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Required Documents */}
      {visa.required_documents && visa.required_documents.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Required Documents</h3>
          <ul className="flex flex-col gap-2">
            {visa.required_documents.map((doc, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                {doc}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Exemptions */}
      {visa.exemptions && visa.exemptions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-3">Exemptions / Special Cases</h3>
          <ul className="flex flex-col gap-2">
            {visa.exemptions.map((ex, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                {ex}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {visa.notes && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Important Note</p>
          <p className="text-sm text-amber-800">{visa.notes}</p>
        </div>
      )}

      {/* Official Link */}
      {visa.official_link && (
        <a
          href={visa.official_link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all"
        >
          <ExternalLink size={15} />
          Apply on Official Site
        </a>
      )}
    </GlassCard>
  );
}
