'use client';

import React, { useState, useEffect } from 'react';
import { Stamp, CheckCircle2, Info, Clock, DollarSign, FileText, AlertCircle } from 'lucide-react';
import { visaService } from '@/services/visa.service';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';

interface VisaCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
}

interface MappedVisaUI {
  country: string;
  visaRequired: boolean;
  visaType: string;
  processingTime: string;
  validity: string;
  stay: string;
  entry: string;
  fee: string;
  documentsRequired: string[];
  applicationProcess: string[];
  tips: string[];
}

const VISA_TYPE_TAGS = ['Tourist', 'E-Visa', 'On Arrival', 'Visa Free'];

/**
 * VisaCanvas — Two modes:
 * 1. DOMESTIC (all Indian cities): Shows "No visa required" card with
 *    domestic travel documents checklist
 * 2. INTERNATIONAL: Full visa info from visaService
 */
export default function VisaCanvas({ onClose, tripContext }: VisaCanvasProps) {
  const [country, setCountry] = useState('Japan');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visaInfo, setVisaInfo] = useState<MappedVisaUI | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Tourist']);

  // Detect domestic trip (all cities are India)
  const isDomesticTrip = tripContext.allCities.length > 0 && !tripContext.allCities.some(city =>
    ['bali', 'thailand', 'dubai', 'singapore', 'uk', 'usa', 'france', 'japan', 'nepal', 'europe', 'europe'].some(intl =>
      city.toLowerCase().includes(intl)
    )
  );

  // For international trips, auto-detect country from destination
  useEffect(() => {
    if (!isDomesticTrip && tripContext.destination) {
      // Simple heuristic: if destination is a known country/city, set it
      const dest = tripContext.destination;
      if (dest && !['manali', 'goa', 'kerala', 'jaipur', 'mumbai', 'delhi'].some(d => dest.toLowerCase().includes(d))) {
        setCountry(dest);
        fetchVisaInfo(dest);
      }
    }
  }, [isDomesticTrip, tripContext.destination]);

  const fetchVisaInfo = async (dest: string) => {
    setLoading(true);
    setError('');
    try {
      const data: any = await visaService.searchVisaByCountry(dest);
      const visa = Array.isArray(data) ? data[0] : data;
      if (visa) {
        setVisaInfo({
          country: visa.country_name || dest,
          visaRequired: visa.visa_required ?? true,
          visaType: visa.visa_type || 'Tourist Visa',
          processingTime: visa.processing_time || '5-10 business days',
          validity: visa.validity || '30 days',
          stay: visa.max_stay || '30 days',
          entry: visa.entry_type || 'Single Entry',
          fee: visa.visa_fee ? `₹${visa.visa_fee.toLocaleString()}` : 'Check official website',
          documentsRequired: visa.documents_required || [],
          applicationProcess: visa.application_process || [],
          tips: visa.tips || [],
        });
      }
    } catch (err) {
      setError('Could not load visa information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ─── DOMESTIC MODE ───────────────────────────────────────────────────────
  if (isDomesticTrip) {
    return (
      <div className="flex h-full flex-col bg-white">
        <CanvasHeader icon={<Stamp size={18} />} iconColor="bg-teal-600" label="Visa & Documents" title={`Documents for ${tripContext.destination}`} tripContext={tripContext} onClose={onClose} />
        <div className="custom-scrollbar flex-1 overflow-y-auto p-4 space-y-4">
          {/* No visa card */}
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900">No Visa Required 🇮🇳</h3>
                <p className="mt-1 text-xs text-emerald-700">
                  {tripContext.destination} is within India — no visa needed for Indian nationals!
                  Just carry a valid government ID.
                </p>
              </div>
            </div>
          </div>

          {/* Documents checklist */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-900">✅ Recommended Documents</h3>
            <div className="space-y-2">
              {[
                { doc: 'Aadhaar Card', required: true, note: 'Primary ID — always carry original' },
                { doc: 'Voter ID / Passport', required: false, note: 'Backup ID recommended for remote areas' },
                { doc: 'Hotel booking confirmation', required: false, note: 'Some checkpoints in Rohtang area may ask' },
                { doc: 'Emergency contacts', required: false, note: 'Printed copy is useful in low-signal areas' },
              ].map(({ doc, required, note }) => (
                <div key={doc} className="flex items-start gap-2">
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${required ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}>
                    {required && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{doc} {required && <span className="text-rose-500">*</span>}</p>
                    <p className="text-[11px] text-slate-500">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rohtang permit note */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-amber-900">⛰️ Rohtang Pass Permit</h3>
                <p className="mt-1 text-xs text-amber-800">
                  An NGT environmental permit is required to cross Rohtang Pass. Book online at <strong>rohtangpermits.nic.in</strong> at least 1 day in advance. ₹500/car — limited slots daily.
                </p>
              </div>
            </div>
          </div>

          {/* Health tips for Himalayan trip */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-bold text-blue-900">🏥 Health Advisory</h3>
            <ul className="space-y-1.5 text-xs text-blue-800">
              <li>• Altitude sickness is possible above 2000m — acclimatize on Day 1</li>
              <li>• Carry Diamox (altitude sickness tablets) — consult doctor first</li>
              <li>• Travel insurance with emergency evacuation is recommended</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // ─── INTERNATIONAL MODE ──────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader icon={<Stamp size={18} />} iconColor="bg-teal-600" label="Visa" title={`Visa for ${visaInfo?.country || country}`} tripContext={tripContext} onClose={onClose} />
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={`Visa requirements for ${country}`} secondary="Indian Passport Holder"
            accentColor="group-hover:text-teal-600" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar tags={VISA_TYPE_TAGS} selected={selectedTags}
              activeColor="border-teal-600 bg-teal-600 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} />
          </SearchSummaryBar>
        )}
        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Search Country</h3>
              <button onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-slate-500">Cancel</button>
            </div>
            <input type="text" value={country} onChange={e => setCountry(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { fetchVisaInfo(country); setIsSearchExpanded(false); }}}
              placeholder="e.g. Japan, Thailand, UAE"
              className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />
            <button onClick={() => { fetchVisaInfo(country); setIsSearchExpanded(false); }}
              className="mt-3 w-full rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
              Search Visa Info
            </button>
          </div>
        )}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-teal-600" />
              <p className="text-sm font-semibold text-slate-600">Looking up visa info...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : visaInfo ? (
            <div className="space-y-4">
              {/* Visa type card */}
              <div className={`rounded-xl border p-4 ${visaInfo.visaRequired ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="flex items-center gap-2">
                  {visaInfo.visaRequired ? <AlertCircle size={18} className="text-amber-600" /> : <CheckCircle2 size={18} className="text-emerald-600" />}
                  <h3 className={`text-sm font-bold ${visaInfo.visaRequired ? 'text-amber-900' : 'text-emerald-900'}`}>
                    {visaInfo.visaRequired ? `Visa Required — ${visaInfo.visaType}` : 'Visa Free Entry'}
                  </h3>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { icon: <Clock size={12} />, label: 'Processing', value: visaInfo.processingTime },
                    { icon: <DollarSign size={12} />, label: 'Fee', value: visaInfo.fee },
                    { icon: <FileText size={12} />, label: 'Validity', value: visaInfo.validity },
                    { icon: <Info size={12} />, label: 'Entry', value: visaInfo.entry },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="rounded-lg bg-white/60 p-2 text-xs">
                      <div className="flex items-center gap-1 text-slate-500">{icon}<span>{label}</span></div>
                      <p className="mt-0.5 font-semibold text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documents */}
              {visaInfo.documentsRequired.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-2 text-sm font-bold text-slate-900">Documents Required</h3>
                  <ul className="space-y-1">
                    {visaInfo.documentsRequired.map((doc, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                        <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />{doc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 text-4xl">🛂</div>
              <p className="text-sm font-semibold text-slate-600">Search a country to get visa info</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
