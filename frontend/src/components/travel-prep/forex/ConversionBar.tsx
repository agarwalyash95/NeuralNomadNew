'use client';

import { useState, useEffect } from 'react';
import { ArrowRightLeft, Search, Loader2 } from 'lucide-react';
import { forexService } from '@/services/forex.service';
import { ForexRate } from '@/types/forex';

const CURRENCY_FLAGS: Record<string, string> = {
  INR: '🇮🇳', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧',
  AED: '🇦🇪', SGD: '🇸🇬', MYR: '🇲🇾', JPY: '🇯🇵',
  AUD: '🇦🇺', CAD: '🇨🇦',
};

interface ConversionBarProps {
  onSearchVendors: (toCurrency: string, fromCurrency: string, amount: number) => void;
}

export default function ConversionBar({ onSearchVendors }: ConversionBarProps) {
  const [rates, setRates] = useState<ForexRate[]>([]);
  const [fromCurrency, setFromCurrency] = useState('INR');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amount, setAmount] = useState<number>(1000);
  const [result, setResult] = useState<{ converted: number; rate: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    forexService.getRates().then(setRates).catch(console.error);
  }, []);

  useEffect(() => {
    if (!fromCurrency || !toCurrency || !amount) return;
    const timer = setTimeout(() => runConversion(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCurrency, toCurrency, amount]);

  const runConversion = async () => {
    if (!amount || amount <= 0) return;
    setConverting(true);
    try {
      const data = await forexService.convert(fromCurrency, toCurrency, amount);
      setResult({ converted: data.converted_amount, rate: data.rate });
    } catch {
      setResult(null);
    } finally {
      setConverting(false);
    }
  };

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const handleSearchVendors = () => {
    setLoading(true);
    onSearchVendors(toCurrency, fromCurrency, amount);
    setLoading(false);
  };

  const currencyOptions = rates.map((r) => r.currency);
  if (!currencyOptions.includes('INR')) currencyOptions.unshift('INR');

  return (
    <div className="w-full rounded-2xl bg-white/60 backdrop-blur-xl border border-white/40 shadow-lg p-4">
      <div className="flex flex-wrap items-center gap-3">

        {/* From Currency */}
        <div className="flex flex-col gap-1 min-w-[110px]">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">From</label>
          <select
            value={fromCurrency}
            onChange={(e) => setFromCurrency(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {currencyOptions.map((c) => (
              <option key={c} value={c}>{CURRENCY_FLAGS[c] ?? ''} {c}</option>
            ))}
          </select>
        </div>

        {/* Swap Button */}
        <button
          onClick={handleSwap}
          className="mt-5 p-2.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-200 shadow-sm"
          title="Swap currencies"
        >
          <ArrowRightLeft size={16} />
        </button>

        {/* To Currency */}
        <div className="flex flex-col gap-1 min-w-[110px]">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">To</label>
          <select
            value={toCurrency}
            onChange={(e) => setToCurrency(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {currencyOptions.filter((c) => c !== fromCurrency).map((c) => (
              <option key={c} value={c}>{CURRENCY_FLAGS[c] ?? ''} {c}</option>
            ))}
          </select>
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1 min-w-[140px] flex-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</label>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter amount"
          />
        </div>

        {/* Result */}
        <div className="flex flex-col gap-1 min-w-[160px] flex-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</label>
          <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2.5 min-h-[42px] flex items-center">
            {converting ? (
              <Loader2 size={16} className="animate-spin text-blue-400" />
            ) : result ? (
              <div>
                <span className="text-base font-bold text-blue-700">
                  {result.converted.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {toCurrency}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Rate: 1 {toCurrency} = {(1 / result.rate).toFixed(4)} {fromCurrency}
                </p>
              </div>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>
        </div>

        {/* Search Vendors Button */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-transparent uppercase tracking-wider select-none">Action</label>
          <button
            onClick={handleSearchVendors}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            Search Local Vendors
          </button>
        </div>

      </div>
    </div>
  );
}
