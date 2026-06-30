'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Search, MapPin, Loader2, Banknote, Stamp, ArrowRightLeft, Store, Globe, AlertCircle } from 'lucide-react';
import { forexService } from '@/services/forex.service';
import { visaService } from '@/services/visa.service';
import { ForexVendor, ForexRate } from '@/types/forex';
import { VisaInfo } from '@/types/visa';
import VendorCard from '@/components/travel-prep/forex/VendorCard';
import VisaDetailsCard from '@/components/travel-prep/visa/VisaDetailsCard';

const CURRENCY_FLAGS: Record<string, string> = {
  INR: 'IN',
  USD: 'US',
  EUR: 'EU',
  GBP: 'UK',
  AED: 'AE',
  SGD: 'SG',
  MYR: 'MY',
  JPY: 'JP',
  AUD: 'AU',
  CAD: 'CA',
};

type TravelPrepService = 'forex' | 'visa';

export default function TravelPrepHelper() {
  const [activeService, setActiveService] = useState<TravelPrepService>('forex');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const [rates, setRates] = useState<ForexRate[]>([]);
  const [fromCurrency, setFromCurrency] = useState('INR');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amount, setAmount] = useState<number>(1000);
  const [forexVendors, setForexVendors] = useState<ForexVendor[]>([]);
  const [forexLoading, setForexLoading] = useState(false);
  const [forexError, setForexError] = useState<string | null>(null);
  const [hasSearchedForex, setHasSearchedForex] = useState(false);
  const [conversionResult, setConversionResult] = useState<{ converted: number; rate: number } | null>(null);

  const [visaQuery, setVisaQuery] = useState('');
  const [visaResults, setVisaResults] = useState<VisaInfo[]>([]);
  const [visaLoading, setVisaLoading] = useState(false);
  const [visaError, setVisaError] = useState<string | null>(null);
  const [hasSearchedVisa, setHasSearchedVisa] = useState(false);

  useEffect(() => {
    forexService.getRates().then(setRates).catch(console.error);
  }, []);

  useEffect(() => {
    if (!fromCurrency || !toCurrency || !amount || activeService !== 'forex') return;
    const timer = setTimeout(async () => {
      try {
        const data = await forexService.convert(fromCurrency, toCurrency, amount);
        setConversionResult({ converted: data.converted_amount, rate: data.rate });
      } catch {
        setConversionResult(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [fromCurrency, toCurrency, amount, activeService]);

  const currencyOptions = rates.map((r) => r.currency);
  if (!currencyOptions.includes('INR')) currencyOptions.unshift('INR');

  const handleForexSearch = async (e: FormEvent) => {
    e.preventDefault();
    setForexLoading(true);
    setForexError(null);
    setHasSearchedForex(true);
    setIsSearchExpanded(false);
    try {
      const data = await forexService.getVendors(toCurrency);
      setForexVendors(data);
    } catch {
      setForexError('Failed to fetch vendors. Please ensure the backend is running.');
      setForexVendors([]);
    } finally {
      setForexLoading(false);
    }
  };

  const handleVisaSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!visaQuery.trim()) return;
    setVisaLoading(true);
    setVisaError(null);
    setHasSearchedVisa(true);
    setIsSearchExpanded(false);
    try {
      const data = await visaService.searchVisaByCountry(visaQuery.trim());
      setVisaResults(Array.isArray(data) ? data : [data]);
    } catch {
      setVisaError(`No visa information found for "${visaQuery}".`);
      setVisaResults([]);
    } finally {
      setVisaLoading(false);
    }
  };

  const getSummaryText = () => {
    if (activeService === 'forex') {
      return hasSearchedForex ? `${amount} ${fromCurrency} to ${toCurrency}` : 'Exchange currency';
    }
    return hasSearchedVisa && visaQuery ? `Visa for ${visaQuery}` : 'Check visa requirements';
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f7f4ed]">
      <div className="sticky top-0 z-20 shrink-0 border-b border-[#e2ddd2] bg-white/90 p-4 backdrop-blur-sm">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveService('forex')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              activeService === 'forex' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Banknote size={14} /> Forex
          </button>
          <button
            onClick={() => setActiveService('visa')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
              activeService === 'visa' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Stamp size={14} /> Visa
          </button>
        </div>
      </div>

      <div className="flex-1 p-4">
        {!isSearchExpanded ? (
          <div
            onClick={() => setIsSearchExpanded(true)}
            className="flex w-full cursor-pointer items-center justify-between rounded-[24px] border border-[#ddd7ca] bg-white p-4 shadow-sm transition-colors hover:bg-[#faf8f2]"
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-xl border p-2 text-white shadow-sm ${activeService === 'forex' ? 'border-blue-500 bg-blue-600' : 'border-indigo-500 bg-indigo-600'}`}>
                {activeService === 'forex' ? <Banknote size={16} /> : <Stamp size={16} />}
              </div>
              <div>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {activeService === 'forex' ? 'Forex search' : 'Visa check'}
                </p>
                <p className="text-sm font-semibold text-slate-800">{getSummaryText()}</p>
              </div>
            </div>
            <Search size={16} className="text-slate-400" />
          </div>
        ) : (
          <div className="rounded-[24px] border border-[#ddd7ca] bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                {activeService === 'forex' ? 'Currency exchange' : 'Destination'}
              </h3>
              {(hasSearchedForex || hasSearchedVisa) ? (
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(false)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Cancel
                </button>
              ) : null}
            </div>

            {activeService === 'forex' ? (
              <form onSubmit={handleForexSearch} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-2xl border border-[#ddd7ca] bg-white p-3">
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">From</label>
                    <select
                      value={fromCurrency}
                      onChange={(e) => setFromCurrency(e.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
                    >
                      {currencyOptions.map((c) => (
                        <option key={c} value={c}>
                          {CURRENCY_FLAGS[c] ?? ''} {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFromCurrency(toCurrency);
                      setToCurrency(fromCurrency);
                    }}
                    className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200"
                  >
                    <ArrowRightLeft size={14} />
                  </button>

                  <div className="flex-1 rounded-2xl border border-[#ddd7ca] bg-white p-3">
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">To</label>
                    <select
                      value={toCurrency}
                      onChange={(e) => setToCurrency(e.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
                    >
                      {currencyOptions.filter((c) => c !== fromCurrency).map((c) => (
                        <option key={c} value={c}>
                          {CURRENCY_FLAGS[c] ?? ''} {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#ddd7ca] bg-white p-3">
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Amount ({fromCurrency})</label>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
                  />
                </div>

                {conversionResult ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-center">
                    <span className="text-sm font-semibold text-blue-700">
                      {conversionResult.converted.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {toCurrency}
                    </span>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Rate: 1 {toCurrency} = {(1 / conversionResult.rate).toFixed(4)} {fromCurrency}
                    </p>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={forexLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                >
                  {forexLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Find vendors
                </button>
              </form>
            ) : null}

            {activeService === 'visa' ? (
              <form onSubmit={handleVisaSearch} className="flex flex-col gap-3">
                <div className="rounded-2xl border border-[#ddd7ca] bg-white p-3 transition-colors focus-within:border-indigo-500">
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Destination country</label>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400" />
                    <input
                      type="text"
                      value={visaQuery}
                      onChange={(e) => setVisaQuery(e.target.value)}
                      placeholder="Japan, UAE, Switzerland..."
                      className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={visaLoading || !visaQuery.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                >
                  {visaLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Check requirements
                </button>
              </form>
            ) : null}
          </div>
        )}

        <div className="mt-6 border-t border-[#e7e1d5] pt-4">
          {activeService === 'forex' ? (
            <div>
              {forexLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 size={24} className="mb-2 animate-spin text-blue-600" />
                  <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Searching vendors...</p>
                </div>
              ) : forexError ? (
                <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600">
                  <AlertCircle size={14} className="shrink-0" /> {forexError}
                </div>
              ) : hasSearchedForex ? (
                forexVendors.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {forexVendors.length} vendors found
                    </h3>
                    {forexVendors.map((vendor) => (
                      <VendorCard
                        key={vendor.id}
                        vendor={vendor}
                        fromCurrency={fromCurrency}
                        toCurrency={toCurrency}
                        amount={amount}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center">
                    <Store size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-500">No vendors stock {toCurrency}</p>
                  </div>
                )
              ) : (
                <div className="py-8 text-center">
                  <Banknote size={24} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-xs font-semibold text-slate-400">Search to see local rates</p>
                </div>
              )}
            </div>
          ) : null}

          {activeService === 'visa' ? (
            <div>
              {visaLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Loader2 size={24} className="mb-2 animate-spin text-indigo-600" />
                  <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Checking requirements...</p>
                </div>
              ) : visaError ? (
                <div className="flex gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600">
                  <AlertCircle size={14} className="shrink-0" /> {visaError}
                </div>
              ) : hasSearchedVisa ? (
                visaResults.length > 0 ? (
                  <div className="space-y-4">
                    {visaResults.map((visa) => (
                      <VisaDetailsCard key={visa.id} visa={visa} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 py-8 text-center">
                    <Globe size={24} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-500">No visa information found</p>
                  </div>
                )
              ) : (
                <div className="py-8 text-center">
                  <Globe size={24} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-xs font-semibold text-slate-400">Search to check visa rules</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
