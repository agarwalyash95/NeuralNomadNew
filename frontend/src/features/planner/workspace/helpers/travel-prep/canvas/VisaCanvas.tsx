'use client';

import React, { useState } from 'react';
import { Stamp, X, Edit2, Check, CheckCircle2, Clock, DollarSign, FileText } from 'lucide-react';
import { mockVisaInfo } from './mockVisaData';

interface VisaCanvasProps {
  onClose?: () => void;
}

export default function VisaCanvas({ onClose }: VisaCanvasProps) {
  const [country, setCountry] = useState('Japan');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visaInfo, setVisaInfo] = useState(mockVisaInfo);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Tourist', 'E-Visa']);

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
    'Fast Track',
    'Multiple Entry'
  ];

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
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Visa</p>
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
                  <p className="mt-1 text-xs text-slate-500">
                    {visaInfo.visaType} • {visaInfo.processingTime} • {visaInfo.fee}
                  </p>
                </div>
                <Edit2 size={16} className="text-slate-400 group-hover:text-indigo-600" />
              </div>
            </button>

            {/* Popular Destinations */}
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Popular Destinations</p>
              <div className="grid grid-cols-3 gap-2">
                {['USA', 'UK', 'Japan', 'UAE', 'Singapore', 'Australia'].map((dest) => (
                  <button
                    key={dest}
                    onClick={() => setCountry(dest)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                      country === dest
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                    }`}
                  >
                    {dest}
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
                  setLoading(true);
                  setTimeout(() => {
                    setLoading(false);
                    setIsSearchExpanded(false);
                  }, 800);
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
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600" />
              <p className="text-sm font-semibold text-slate-600">Checking requirements...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Visa Status Card */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-indigo-900">{visaInfo.visaType}</h3>
                  <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                    Required
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-indigo-600" />
                    <span className="text-indigo-800">{visaInfo.processingTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={14} className="text-indigo-600" />
                    <span className="text-indigo-800">{visaInfo.fee}</span>
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
                      <span className="text-slate-700">{doc}</span>
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
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-slate-700">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-amber-900">Important Tips</h3>
                <div className="space-y-2">
                  {visaInfo.tips.map((tip, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 text-amber-600">•</span>
                      <span className="text-amber-800">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
