'use client';

import React, { FormEvent } from 'react';
import { Search, Loader2, ArrowRightLeft } from 'lucide-react';

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

interface ForexSearchFormProps {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  currencyOptions: string[];
  conversionResult: { converted: number; rate: number } | null;
  forexLoading: boolean;
  onFromCurrencyChange: (value: string) => void;
  onToCurrencyChange: (value: string) => void;
  onAmountChange: (value: number) => void;
  onSwapCurrencies: () => void;
  onSubmit: (e: FormEvent) => void;
}

export default function ForexSearchForm({
  fromCurrency,
  toCurrency,
  amount,
  currencyOptions,
  conversionResult,
  forexLoading,
  onFromCurrencyChange,
  onToCurrencyChange,
  onAmountChange,
  onSwapCurrencies,
  onSubmit,
}: ForexSearchFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-2xl border border-[#ddd7ca] bg-white p-3">
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">From</label>
          <select
            value={fromCurrency}
            onChange={(e) => onFromCurrencyChange(e.target.value)}
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
          onClick={onSwapCurrencies}
          className="rounded-full bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200"
        >
          <ArrowRightLeft size={14} />
        </button>

        <div className="flex-1 rounded-2xl border border-[#ddd7ca] bg-white p-3">
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">To</label>
          <select
            value={toCurrency}
            onChange={(e) => onToCurrencyChange(e.target.value)}
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
        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
          Amount ({fromCurrency})
        </label>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => onAmountChange(Number(e.target.value))}
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
  );
}
