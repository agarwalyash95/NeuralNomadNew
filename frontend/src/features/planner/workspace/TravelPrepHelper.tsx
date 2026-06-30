'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { Search, Banknote, Stamp } from 'lucide-react';
import { forexService } from '@/services/forex.service';
import { visaService } from '@/services/visa.service';
import { ForexVendor, ForexRate } from '@/types/forex';
import { VisaInfo } from '@/types/visa';
import ForexSearchForm from './helpers/travel-prep/ForexSearchForm';
import VisaSearchForm from './helpers/travel-prep/VisaSearchForm';
import ForexResults from './helpers/travel-prep/ForexResults';
import VisaResults from './helpers/travel-prep/VisaResults';

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
              <ForexSearchForm
                fromCurrency={fromCurrency}
                toCurrency={toCurrency}
                amount={amount}
                currencyOptions={currencyOptions}
                conversionResult={conversionResult}
                forexLoading={forexLoading}
                onFromCurrencyChange={setFromCurrency}
                onToCurrencyChange={setToCurrency}
                onAmountChange={setAmount}
                onSwapCurrencies={() => {
                  setFromCurrency(toCurrency);
                  setToCurrency(fromCurrency);
                }}
                onSubmit={handleForexSearch}
              />
            ) : null}

            {activeService === 'visa' ? (
              <VisaSearchForm
                visaQuery={visaQuery}
                visaLoading={visaLoading}
                onVisaQueryChange={setVisaQuery}
                onSubmit={handleVisaSearch}
              />
            ) : null}
          </div>
        )}

        <div className="mt-6 border-t border-[#e7e1d5] pt-4">
          {activeService === 'forex' ? (
            <ForexResults
              forexLoading={forexLoading}
              forexError={forexError}
              hasSearchedForex={hasSearchedForex}
              forexVendors={forexVendors}
              fromCurrency={fromCurrency}
              toCurrency={toCurrency}
              amount={amount}
            />
          ) : null}

          {activeService === 'visa' ? (
            <VisaResults
              visaLoading={visaLoading}
              visaError={visaError}
              hasSearchedVisa={hasSearchedVisa}
              visaResults={visaResults}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
