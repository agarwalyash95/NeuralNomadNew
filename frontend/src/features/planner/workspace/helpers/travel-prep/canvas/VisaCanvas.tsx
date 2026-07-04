'use client';

import React, { useState, useEffect } from 'react';
import { Stamp, X, Edit2, Check, CheckCircle2, Clock, DollarSign, FileText, AlertCircle } from 'lucide-react';
import { visaService } from '@/services/visa.service';

interface VisaCanvasProps {
  onClose?: () => void;
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

export default function VisaCanvas({ onClose }: VisaCanvasProps) {
  const [country, setCountry] = useState('Japan');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visaInfo, setVisaInfo] = useState<MappedVisaUI | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Tourist']);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const recommendedTags = [
    'Tourist',
    'E-Visa',
    'Business',
    'On Arrival',
    'Multiple Entry'
  ];

  // Helper function to transform DB model to UI structure
  const mapVisaRecord = (visa: any): MappedVisaUI => {
    const isRequired = visa.visa_required;
    const feeAmount = visa.fees ? Number(visa.fees) : 0;
    const feeText = feeAmount === 0 ? 'Free Entry' : `₹${feeAmount.toLocaleString()} (${visa.currency || 'INR'})`;
    
    // Build application process steps dynamically
    const steps = isRequired ? [
      'Compile required documents (passport, financial statement, photographs).',
      visa.official_link ? `Visit the official visa application portal at ${visa.official_link}.` : 'Access the designated embassy portal or VFS Global partner site.',
      'Submit application online or book an appointment at the nearest center.',
      `Pay the visa fee of ${feeText}.`,
      `Wait approximately ${visa.processing_time || '5-10 working days'} for processing.`,
      'Collect passport with the endorsed visa stamp.'
    ] : [
      'Ensure passport has at least 6 months validity from the date of entry.',
      'Keep your confirmed return flight ticket and accommodation details handy.',
      'Pass through the visa-exempt immigration lane at the entry port.'
    ];

    // Build helpful tips
    const tips = [
      visa.notes || 'Ensure all documentation matches your itinerary exactly.',
      'Apply at least 3-4 weeks before your scheduled departure date.',
      'Keep photocopy and digital backups of your passport and documents.',
      isRequired ? 'Travel insurance meeting destination country minimums is highly recommended.' : 'Maximum stay is strictly capped; check local rules if you wish to extend.'
    ].filter(Boolean);

    return {
      country: visa.country,
      visaRequired: isRequired,
      visaType: visa.visa_type || (isRequired ? 'Tourist Visa' : 'Visa Exemption'),
      processingTime: visa.processing_time || (isRequired ? '5-7 Working Days' : 'Instant on Arrival'),
      validity: visa.validity || '30-90 Days',
      stay: visa.max_stay_duration || '30 Days per visit',
      entry: visa.entry_type === 'MULTIPLE' ? 'Multiple Entry' : 'Single Entry',
      fee: feeText,
      documentsRequired: visa.required_documents?.length > 0 ? visa.required_documents : [
        'Valid Passport (at least 6 months validity)',
        'Recent passport-size photographs',
        'Confirmed flight itinerary & hotel booking',
        'Proof of sufficient travel funds'
      ],
      applicationProcess: steps,
      tips: tips
    };
  };

  const fetchVisaData = async (targetCountry: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await visaService.searchVisaByCountry(targetCountry);
      let visaRecord: any = null;
      if (Array.isArray(response)) {
        visaRecord = response.length > 0 ? response[0] : null;
      } else {
        visaRecord = response;
      }

      if (visaRecord) {
        const mapped = mapVisaRecord(visaRecord);
        setVisaInfo(mapped);
        setCountry(visaRecord.country); // sync actual database country name (e.g. "Japan" if they search "jap")
      } else {
        setError(`No visa guidelines found for "${targetCountry}".`);
        setVisaInfo(null);
      }
    } catch (err: any) {
      console.error('Error fetching visa data:', err);
      setError(`Could not retrieve visa guidelines for "${targetCountry}".`);
      setVisaInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // Run on mount
  useEffect(() => {
    fetchVisaData(country);
  }, []);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Stamp size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Visa Requirements</p>
              <h2 className="text-sm font-semibold text-slate-900">{country}</h2>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {/* Search Bar Summary */}
        {!isSearchExpanded && (
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">Visa for {country}</p>
                  {visaInfo && (
                    <p className="mt-1 text-xs text-slate-500">
                      {visaInfo.visaType} • {visaInfo.processingTime} • {visaInfo.fee}
                    </p>
                  )}
                </div>
                <Edit2 size={16} className="text-slate-400 group-hover:text-indigo-600" />
              </div>
            </button>

            {/* Popular Destinations */}
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Popular Destinations</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Japan', query: 'Japan' },
                  { label: 'Schengen', query: 'Switzerland' },
                  { label: 'Thailand', query: 'Thailand' },
                  { label: 'UAE', query: 'UAE' },
                  { label: 'Singapore', query: 'Singapore' },
                  { label: 'China', query: 'China' }
                ].map((dest) => (
                  <button
                    key={dest.label}
                    onClick={() => {
                      setCountry(dest.label);
                      fetchVisaData(dest.query);
                    }}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                      country === dest.label
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    {dest.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Visa Types</p>
              <div className="flex flex-wrap gap-2">
                {recommendedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    {selectedTags.includes(tag) && <Check size={12} className="mr-1 inline" />}
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expanded Search Form */}
        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Change Destination</h3>
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Enter country name"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
              />

              <button
                onClick={() => {
                  fetchVisaData(country);
                  setIsSearchExpanded(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700"
              >
                Check Requirements
              </button>
            </div>
          </div>
        )}

        {/* Results Section */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-indigo-600" />
              <p className="text-sm font-semibold text-slate-600">Checking requirements...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle size={20} />
              </div>
              <p className="text-sm font-semibold text-red-800">{error}</p>
              <p className="mt-1 text-xs text-red-600">Please try popular destinations or check search spelling.</p>
            </div>
          ) : visaInfo ? (
            <div className="space-y-4">
              {/* Visa Status Card */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-indigo-950">{visaInfo.visaType}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    visaInfo.visaRequired 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-green-600 text-white'
                  }`}>
                    {visaInfo.visaRequired ? 'Visa Required' : 'Visa Free / Exemption'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-indigo-600" />
                    <span className="text-indigo-900 font-medium">{visaInfo.processingTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-indigo-600" />
                    <span className="text-indigo-900 font-medium">{visaInfo.fee}</span>
                  </div>
                </div>
              </div>

              {/* Documents Required */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FileText size={16} className="text-slate-600" />
                  Documents Required
                </h3>
                <div className="space-y-2">
                  {visaInfo.documentsRequired.map((doc, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-600" />
                      <span className="text-slate-700 leading-relaxed">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Application Process */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Application Process</h3>
                <div className="space-y-3">
                  {visaInfo.applicationProcess.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <h3 className="mb-2 text-sm font-semibold text-amber-900">Important Advisory</h3>
                <div className="space-y-2">
                  {visaInfo.tips.map((tip, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 text-amber-600 font-bold">•</span>
                      <span className="text-amber-800 leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
