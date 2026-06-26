'use client';

import { useState, useEffect } from 'react';
import { Loader2, Store, AlertCircle, Clock, X } from 'lucide-react';
import ConversionBar from './ConversionBar';
import VendorCard from './VendorCard';
import { forexService } from '@/services/forex.service';
import { ForexVendor } from '@/types/forex';

const STORAGE_KEY = 'forex_recent_searches';
const MAX_RECENT = 5;

const CURRENCY_FLAGS: Record<string, string> = {
  INR: '🇮🇳', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧',
  AED: '🇦🇪', SGD: '🇸🇬', MYR: '🇲🇾', JPY: '🇯🇵',
  AUD: '🇦🇺', CAD: '🇨🇦',
};

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(currency: string) {
  const recent = getRecentSearches().filter((c) => c !== currency);
  recent.unshift(currency);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function removeRecentSearch(currency: string) {
  const recent = getRecentSearches().filter((c) => c !== currency);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
}

export default function ForexTab() {
  const [vendors, setVendors] = useState<ForexVendor[]>([]);
  const [fromCurrency, setFromCurrency] = useState('INR');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amount, setAmount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const handleSearchVendors = async (toCurr: string, fromCurr?: string, amt?: number) => {
    setToCurrency(toCurr);
    if (fromCurr) setFromCurrency(fromCurr);
    if (amt) setAmount(amt);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await forexService.getVendors(toCurr);
      setVendors(data);
      saveRecentSearch(toCurr);
      setRecentSearches(getRecentSearches());
    } catch {
      setError('Failed to fetch vendors. Please ensure the backend is running.');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecent = (currency: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(currency);
    setRecentSearches(getRecentSearches());
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Conversion Bar */}
      <ConversionBar onSearchVendors={handleSearchVendors} />

      {/* Recent Searches */}
      {!searched && recentSearches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-slate-400" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Recent Searches</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((currency) => (
              <button
                key={currency}
                onClick={() => handleSearchVendors(currency)}
                className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all shadow-sm"
              >
                <span className="text-base">{CURRENCY_FLAGS[currency] ?? '💱'}</span>
                <span>{currency}</span>
                <span
                  role="button"
                  onClick={(e) => handleRemoveRecent(currency, e)}
                  className="ml-1 rounded-full p-0.5 text-slate-300 hover:bg-red-100 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 size={28} className="animate-spin text-blue-500" />
          <span className="font-medium">Searching local vendors for {toCurrency}...</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 border border-red-200 p-5 text-sm text-red-600">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty Results */}
      {!loading && searched && !error && vendors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center text-slate-500">
          <Store size={40} className="text-slate-300" />
          <p className="font-semibold text-slate-700">No local vendors found</p>
          <p className="text-sm">No vendors currently stock {toCurrency}. Try a different currency.</p>
        </div>
      )}

      {/* Vendor Results */}
      {!loading && vendors.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
            {vendors.length} Local Vendor{vendors.length > 1 ? 's' : ''} Found — {toCurrency}
          </h2>
          <div className="flex flex-col gap-4">
            {vendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                fromCurrency={fromCurrency}
                toCurrency={toCurrency}
                amount={amount}
              />
            ))}
          </div>
        </div>
      )}

      {/* Initial Prompt (no recents, no search) */}
      {!searched && recentSearches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center text-slate-400">
          <Store size={40} className="text-slate-200" />
          <p className="font-semibold text-slate-500">Select currencies and click &quot;Search Local Vendors&quot;</p>
          <p className="text-sm">We&apos;ll show you local vendors that have your target currency in stock.</p>
        </div>
      )}

    </div>
  );
}
