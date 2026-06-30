'use client';

import React, { FormEvent, useRef } from 'react';
import { Search, MapPin, Loader2, Navigation } from 'lucide-react';

interface AttractionsSearchFormProps {
  searchQuery: string;
  showDropdown: boolean;
  suggestions: any[];
  searchingDropdown: boolean;
  currentLocationStr: string;
  onSearchQueryChange: (value: string) => void;
  onShowDropdownChange: (value: boolean) => void;
  onSelectLocation: (prediction: any) => void;
  onSubmit: (e: FormEvent) => void;
}

export default function AttractionsSearchForm({
  searchQuery,
  showDropdown,
  suggestions,
  searchingDropdown,
  currentLocationStr,
  onSearchQueryChange,
  onShowDropdownChange,
  onSelectLocation,
  onSubmit,
}: AttractionsSearchFormProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  return (
    <form onSubmit={onSubmit} className="relative flex flex-col gap-3 rounded-[24px] border border-[#ddd7ca] bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Search destination</h3>
        {currentLocationStr ? (
          <button
            type="button"
            onClick={() => onShowDropdownChange(false)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <div
        ref={dropdownRef}
        className="group relative w-full rounded-2xl border border-[#ddd7ca] bg-white px-3 py-3 transition-colors focus-within:border-blue-500"
      >
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600">
          Location
        </label>
        <div className="flex items-center gap-2">
          <MapPin size={16} className="shrink-0 text-slate-400 group-focus-within:text-blue-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              onSearchQueryChange(e.target.value);
              onShowDropdownChange(true);
            }}
            placeholder="Tokyo, Japan"
            className="w-full truncate bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none"
          />
        </div>

        {showDropdown && searchQuery.length > 1 ? (
          <div className="custom-scrollbar absolute left-0 right-0 top-[110%] z-50 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
            {searchingDropdown ? (
              <div className="flex justify-center p-4">
                <Loader2 size={20} className="animate-spin text-blue-600" />
              </div>
            ) : suggestions.length > 0 ? (
              <ul className="py-2">
                {suggestions.map((pred) => (
                  <li
                    key={pred.place_id}
                    onClick={() => onSelectLocation(pred)}
                    className="flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors hover:bg-slate-50"
                  >
                    <Navigation size={14} className="shrink-0 text-slate-400" />
                    <div className="truncate">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {pred.structured_formatting?.main_text || pred.description}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {pred.structured_formatting?.secondary_text}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500">No places found.</div>
            )}
          </div>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={!searchQuery.trim()}
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 disabled:opacity-50"
      >
        <Search size={16} />
        Explore
      </button>
    </form>
  );
}
