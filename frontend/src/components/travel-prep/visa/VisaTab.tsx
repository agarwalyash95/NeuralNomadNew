'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, Globe, AlertCircle, Clock, X } from 'lucide-react';
import VisaDetailsCard from './VisaDetailsCard';
import { visaService } from '@/services/visa.service';
import { VisaInfo } from '@/types/visa';

const STORAGE_KEY = 'visa_recent_searches';
const MAX_RECENT = 5;

const COUNTRY_FLAGS: Record<string, string> = {
  'Switzerland': '🇨🇭', 'Japan': '🇯🇵', 'Thailand': '🇹🇭',
  'United Kingdom': '🇬🇧', 'UAE': '🇦🇪', 'Singapore': '🇸🇬',
  'Australia': '🇦🇺', 'Canada': '🇨🇦', 'USA': '🇺🇸',
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Malaysia': '🇲🇾',
  'Italy': '🇮🇹', 'Spain': '🇪🇸', 'Netherlands': '🇳🇱',
  'New Zealand': '🇳🇿', 'Turkey': '🇹🇷', 'Greece': '🇬🇷',
};

const POPULAR_DESTINATIONS = [
  { label: 'Switzerland', flag: '🇨🇭' }, { label: 'Japan', flag: '🇯🇵' },
  { label: 'Thailand', flag: '🇹🇭' }, { label: 'United Kingdom', flag: '🇬🇧' },
  { label: 'UAE', flag: '🇦🇪' }, { label: 'Singapore', flag: '🇸🇬' },
  { label: 'Australia', flag: '🇦🇺' }, { label: 'Canada', flag: '🇨🇦' },
  { label: 'USA', flag: '🇺🇸' }, { label: 'France', flag: '🇫🇷' },
  { label: 'Germany', flag: '🇩🇪' }, { label: 'Malaysia', flag: '🇲🇾' },
];

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(country: string) {
  const recent = getRecentSearches().filter((c) => c.toLowerCase() !== country.toLowerCase());
  recent.unshift(country);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

function removeRecentSearch(country: string) {
  const recent = getRecentSearches().filter((c) => c !== country);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
}

export default function VisaTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VisaInfo | VisaInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const handleSearch = async (country: string = query) => {
    if (!country.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setResults(null);
    try {
      const data = await visaService.searchVisaByCountry(country.trim());
      setResults(data);
      saveRecentSearch(country.trim());
      setRecentSearches(getRecentSearches());
    } catch {
      setError(`No visa information found for "${country}". Try a different country name.`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecent = (country: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(country);
    setRecentSearches(getRecentSearches());
  };

  const getFlag = (country: string) => {
    const match = Object.entries(COUNTRY_FLAGS).find(
      ([key]) => key.toLowerCase() === country.toLowerCase()
    );
    return match ? match[1] : '🌍';
  };

  const resultList: VisaInfo[] = results
    ? Array.isArray(results) ? results : [results]
    : [];

  return (
    <div className="flex flex-col gap-6">

      {/* Hero Search Bar */}
      <div className="relative group">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500/10 to-violet-500/10 blur-xl group-focus-within:from-indigo-500/20 group-focus-within:to-violet-500/20 transition-all duration-300" />
        <div className="relative flex items-center gap-3 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-lg px-4 py-3">
          <Search size={22} className="text-indigo-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Where do you want to go? (e.g. Switzerland, Japan, UAE...)"
            className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-base font-medium focus:outline-none"
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Check Visa'}
          </button>
        </div>
      </div>

      {/* Recent Searches */}
      {!searched && recentSearches.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-slate-400" />
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Recent Searches</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((country) => (
              <button
                key={country}
                onClick={() => handleSearch(country)}
                className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm"
              >
                <span className="text-base">{getFlag(country)}</span>
                <span>{country}</span>
                <span
                  role="button"
                  onClick={(e) => handleRemoveRecent(country, e)}
                  className="ml-1 rounded-full p-0.5 text-slate-300 hover:bg-red-100 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Popular Destination Pills */}
      {!searched && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Popular Destinations</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {POPULAR_DESTINATIONS.map((dest) => (
              <button
                key={dest.label}
                onClick={() => { setQuery(dest.label); handleSearch(dest.label); }}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white/80 backdrop-blur-sm px-4 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all duration-200 shadow-sm shrink-0"
              >
                <span>{dest.flag}</span>
                <span>{dest.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
          <span className="font-medium">Fetching visa requirements...</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div>
          <div className="flex items-start gap-3 rounded-2xl bg-red-50 border border-red-200 p-5 text-sm text-red-600 mb-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
          {/* Show recent searches even after an error */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-slate-400" />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Try a Recent Search</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((country) => (
                  <button
                    key={country}
                    onClick={() => { setSearched(false); handleSearch(country); }}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm"
                  >
                    <span>{getFlag(country)}</span>
                    <span>{country}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {!loading && !error && resultList.length > 0 && (
        <div className="flex flex-col gap-4">
          {resultList.map((visa) => (
            <VisaDetailsCard key={visa.id} visa={visa} />
          ))}
          {/* Show recents below results too */}
          {recentSearches.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-slate-400" />
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Searches</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((country) => (
                  <button
                    key={country}
                    onClick={() => { setQuery(country); handleSearch(country); }}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition-all shadow-sm"
                  >
                    <span>{getFlag(country)}</span>
                    <span>{country}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Initial State — no recents, no search */}
      {!searched && recentSearches.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center text-slate-400">
          <Globe size={48} className="text-slate-200" />
          <p className="font-semibold text-slate-500">Search for a destination</p>
          <p className="text-sm max-w-xs">
            Type a country name above or click on a popular destination to check visa requirements for Indian passport holders.
          </p>
        </div>
      )}

    </div>
  );
}
