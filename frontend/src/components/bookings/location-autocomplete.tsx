'use client';

import { useState, useEffect, useRef } from 'react';
import { locationService, LocationSuggestion } from '@/services/location.service';
import { MapPin, Loader2, Plane, Train, Building2, Navigation } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type: string; // 'airport', 'station', 'city', 'bus_stop', etc.
  placeholder?: string;
  icon?: React.ElementType;
  flex?: string;
}

export default function LocationAutocomplete({
  label, value, onChange, type, placeholder, icon: Icon = MapPin, flex = 'flex-1'
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Custom debounce logic if useDebounce hook is unavailable, 
  // but we'll try to use the hook or fallback.
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    // Only search if user typed something and it differs from the selected value
    if (debouncedQuery && debouncedQuery !== value) {
      const search = async () => {
        setLoading(true);
        const results = await locationService.searchLocations(debouncedQuery, type);
        setSuggestions(results);
        setLoading(false);
        setIsOpen(true);
      };
      search();
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  }, [debouncedQuery, type, value]);

  // Handle clicking outside to close the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync internal query with external value if it changes
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSelect = (suggestion: LocationSuggestion) => {
    const finalValue = suggestion.code ? `${suggestion.city} (${suggestion.code})` : suggestion.name;
    setQuery(finalValue);
    onChange(finalValue);
    setIsOpen(false);
  };

  const LocationIcon = type === 'airport' ? Plane : type === 'station' ? Train : type === 'city' ? Building2 : Navigation;

  return (
    <div ref={wrapperRef} className={`relative group px-4 py-2 hover:bg-slate-50/50 transition-colors rounded-xl ${flex}`}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 group-focus-within:text-blue-600 transition-colors">
        {label}
      </label>
      <div className="flex items-center gap-2 relative">
        <Icon size={16} className="text-slate-400 group-focus-within:text-blue-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (query.length >= 2) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 placeholder-slate-300 outline-none truncate"
        />
        {loading && <Loader2 size={14} className="animate-spin text-blue-500 absolute right-2 top-1/2 -translate-y-1/2" />}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (suggestions.length > 0 || query.length >= 2) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto w-72 md:w-full">
          {suggestions.length > 0 ? (
            <ul className="py-2">
              {suggestions.map((suggestion) => (
                <li
                  key={suggestion.id}
                  onClick={() => handleSelect(suggestion)}
                  className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100/50 text-blue-600 flex items-center justify-center shrink-0">
                    <LocationIcon size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{suggestion.city}</p>
                    <p className="text-xs text-slate-500 truncate">{suggestion.name}</p>
                  </div>
                  {suggestion.code && (
                    <div className="ml-auto bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-500 shrink-0">
                      {suggestion.code}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : !loading && query.length >= 2 ? (
            <div className="p-4 text-center text-sm font-medium text-slate-500">
              No matches found
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
