import React, { useState } from 'react';
import { Search, Calendar, Users, Wallet, Navigation, Sparkles, MapPin, Clock, Plus, Check } from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';

export interface ChatWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
}

export function ChatWidget({ widget, onSubmit }: ChatWidgetProps) {
  if (widget.type === 'destination_search') {
    return <DestinationWidget onSubmit={onSubmit} />;
  }
  if (widget.type === 'date_range_picker') {
    return <DateRangeWidget onSubmit={onSubmit} />;
  }
  if (widget.type === 'optional_trip_details') {
    return <OptionalDetailsWidget widget={widget} onSubmit={onSubmit} />;
  }
  if (widget.type === 'nearby_cities_recommendation') {
    return <NearbyCitiesWidget widget={widget} onSubmit={onSubmit} />;
  }
  return null;
}

function DestinationWidget({ onSubmit }: { onSubmit: (m: string, s: any) => void }) {
  const [city, setCity] = useState('');

  const handleSelect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    onSubmit(`I want to go to ${city}`, {
      field: 'destination',
      value: { name: city }
    });
  };

  return (
    <form onSubmit={handleSelect} className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-[#ddd7ca] bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Select Destination</p>
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
          <Sparkles size={10} /> AI Analyzing
        </span>
      </div>
      <div className="relative group">
        <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 blur transition duration-500 group-hover:opacity-20"></div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            autoFocus
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Paris, Tokyo, Bali..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>
      <button 
        type="submit" 
        disabled={!city.trim()}
        className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
      >
        Confirm Destination
      </button>
    </form>
  );
}

function DateRangeWidget({ onSubmit }: { onSubmit: (m: string, s: any) => void }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    onSubmit(`From ${startDate} to ${endDate}`, {
      field: 'travel_dates',
      value: { start_date: startDate, end_date: endDate }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-[#ddd7ca] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Travel Dates</p>
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
          <Sparkles size={10} /> Optimize Season
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Start Date</label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">End Date</label>
          <input
            type="date"
            required
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>
      <button 
        type="submit" 
        disabled={!startDate || !endDate}
        className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
      >
        Confirm Dates
      </button>
    </form>
  );
}

const CURRENCY_CONFIGS: Record<string, { min: number, max: number, step: number, defaultValue: number, budgetThreshold: number, midThreshold: number }> = {
  USD: { min: 200, max: 10000, step: 100, defaultValue: 2000, budgetThreshold: 1000, midThreshold: 3000 },
  EUR: { min: 200, max: 10000, step: 100, defaultValue: 2000, budgetThreshold: 1000, midThreshold: 3000 },
  GBP: { min: 150, max: 8000, step: 100, defaultValue: 1500, budgetThreshold: 800, midThreshold: 2400 },
  INR: { min: 15000, max: 800000, step: 5000, defaultValue: 150000, budgetThreshold: 75000, midThreshold: 220000 },
  JPY: { min: 30000, max: 1500000, step: 10000, defaultValue: 300000, budgetThreshold: 150000, midThreshold: 450000 },
};

function getLocalCurrency() {
  if (typeof window === 'undefined') {
    return { code: 'USD', symbol: '$' };
  }
  
  let code = 'USD';
  const locale = navigator.language || 'en-US';
  
  try {
    // 1. Timezone-based detection (highest precision for physical location in mixed-locale systems)
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && (tz.includes('Kolkata') || tz.includes('Calcutta') || tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta')) {
      code = 'INR';
    } else if (locale.endsWith('-IN') || locale.startsWith('hi') || locale.startsWith('en-IN')) {
      code = 'INR';
    } else if (locale.endsWith('-GB') || locale.startsWith('en-GB') || (tz && tz.includes('Europe/London'))) {
      code = 'GBP';
    } else if (locale.endsWith('-JP') || locale.startsWith('ja') || (tz && tz.includes('Asia/Tokyo'))) {
      code = 'JPY';
    } else {
      const euroLocales = ['de', 'fr', 'es', 'it', 'nl', 'be', 'at', 'fi', 'ie', 'pt', 'gr'];
      const euroTzPrefixes = ['Europe/Berlin', 'Europe/Paris', 'Europe/Rome', 'Europe/Madrid', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna', 'Europe/Helsinki', 'Europe/Dublin', 'Europe/Lisbon', 'Europe/Athens'];
      if (euroLocales.some(el => locale.startsWith(el)) || (tz && euroTzPrefixes.some(ep => tz.includes(ep)))) {
        code = 'EUR';
      }
    }
  } catch (e) {
    // Fallback if timezone resolution fails
    if (locale.endsWith('-IN') || locale.startsWith('hi') || locale.startsWith('en-IN')) {
      code = 'INR';
    } else if (locale.endsWith('-GB') || locale.startsWith('en-GB')) {
      code = 'GBP';
    } else if (locale.endsWith('-JP') || locale.startsWith('ja')) {
      code = 'JPY';
    } else {
      const euroLocales = ['de', 'fr', 'es', 'it', 'nl', 'be', 'at', 'fi', 'ie', 'pt', 'gr'];
      if (euroLocales.some(el => locale.startsWith(el))) {
        code = 'EUR';
      }
    }
  }

  let symbol = '$';
  try {
    const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: code });
    const parts = formatter.formatToParts(1);
    const curPart = parts.find(p => p.type === 'currency');
    if (curPart) symbol = curPart.value;
  } catch {
    if (code === 'INR') symbol = '₹';
    else if (code === 'GBP') symbol = '£';
    else if (code === 'JPY') symbol = '¥';
    else if (code === 'EUR') symbol = '€';
  }
  return { code, symbol };
}

function OptionalDetailsWidget({ widget, onSubmit }: { widget: WidgetData, onSubmit: (m: string, s: any) => void }) {
  const { code: currencyCode, symbol: currencySymbol } = getLocalCurrency();
  const config = CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.USD;

  const fields = (widget.data.fields as string[]) || [];
  
  const [travelers, setTravelers] = useState(2);
  const [budgetVal, setBudgetVal] = useState(config.defaultValue);
  const [interests, setInterests] = useState<string[]>([]);
  const [origin, setOrigin] = useState('');

  const toggleInterest = (i: string) => {
    setInterests(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const getBudgetTier = (val: number, code: string) => {
    const conf = CURRENCY_CONFIGS[code] || CURRENCY_CONFIGS.USD;
    if (val < conf.budgetThreshold) return 'budget';
    if (val < conf.midThreshold) return 'mid_range';
    return 'premium';
  };

  const handleSubmit = () => {
    const tier = getBudgetTier(budgetVal, currencyCode);
    const formattedBudget = new Intl.NumberFormat(undefined).format(budgetVal);

    const parts: string[] = [];
    if (fields.includes('travelers')) {
      parts.push(`We are ${travelers} travelers`);
    }
    if (fields.includes('budget')) {
      parts.push(`on a ${currencySymbol}${formattedBudget} budget`);
    }
    if (fields.includes('origin') && origin.trim()) {
      parts.push(`flying from ${origin}`);
    }
    if (fields.includes('interests') && interests.length > 0) {
      parts.push(`interested in ${interests.join(', ')}`);
    }

    const message = parts.length > 0 ? parts.join(', ') + '.' : 'Updated my trip preferences.';
    
    onSubmit(message, {
      field: 'optional_trip_details',
      value: {
        travelers: fields.includes('travelers') ? travelers : undefined,
        budget: fields.includes('budget') ? { tier, amount: budgetVal, currency: currencyCode } : undefined,
        interests: fields.includes('interests') ? interests : undefined,
        origin: fields.includes('origin') && origin.trim() ? origin.trim() : undefined
      }
    }); 
  };
  
  const intent = (widget.data.intent as string) || 'full_trip';

  const title = 
    intent === 'hotel_only' ? 'Stay Preferences' :
    intent === 'flight_only' ? 'Flight Preferences' :
    intent === 'food_and_dining' ? 'Dining Preferences' :
    'Customize Trip';

  return (
    <div className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[#ddd7ca] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">
          <Sparkles size={10} /> High Precision
        </span>
      </div>
      
      {fields.includes('travelers') && (
        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase">Travelers</label>
          <div className="mt-1 flex items-center gap-3">
            <button type="button" onClick={() => setTravelers(Math.max(1, travelers - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">-</button>
            <span className="text-sm font-semibold w-4 text-center">{travelers}</span>
            <button type="button" onClick={() => setTravelers(travelers + 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">+</button>
          </div>
        </div>
      )}

      {fields.includes('origin') && (
        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase">Starting Location</label>
          <div className="relative mt-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. New York, London..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
            />
          </div>
        </div>
      )}

      {fields.includes('budget') && (
        <div>
          <div className="flex justify-between items-center">
            <label className="text-[11px] font-semibold text-slate-500 uppercase">Total Budget</label>
            <span className="text-xs font-bold text-blue-600">
              {currencySymbol}{new Intl.NumberFormat(undefined).format(budgetVal)}{budgetVal >= config.max ? '+' : ''}
            </span>
          </div>
          <div className="mt-2">
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={budgetVal}
              onChange={(e) => setBudgetVal(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[9px] font-semibold text-slate-400 mt-1 uppercase">
              <span>Budget</span>
              <span>Premium</span>
            </div>
          </div>
        </div>
      )}

      {fields.includes('interests') && (
        <div>
          <label className="text-[11px] font-semibold text-slate-500 uppercase">Interests</label>
          <div className="mt-1 flex flex-wrap gap-2">
            {['food', 'culture', 'nature', 'nightlife', 'shopping', 'relaxation'].map(i => (
              <button 
                key={i}
                onClick={() => toggleInterest(i)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all shadow-sm ${interests.includes(i) ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-transparent' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      )}

      <button 
        onClick={handleSubmit}
        className="mt-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700"
      >
        Submit Details
      </button>
    </div>
  );
}

function NearbyCitiesWidget({ widget, onSubmit }: { widget: WidgetData; onSubmit: (m: string, s: any) => void }) {
  const suggestions = (widget.data.suggestions as Array<{
    city: string;
    distance: string;
    why_visit: string;
    recommended_duration: string;
  }>) || [];
  
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const handleToggle = (city: string) => {
    if (submitted) return;
    setSelectedCities(prev => 
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  const handleAddAllSelected = () => {
    if (selectedCities.length === 0 || submitted) return;
    setSubmitted(true);
    const citiesStr = selectedCities.join(', ');
    const msg = selectedCities.length === 1 
      ? `Add ${citiesStr} to my trip as an excursion.`
      : `Add these ${selectedCities.length} excursions to my trip: ${citiesStr}.`;
    
    onSubmit(msg, {
      field: 'add_nearby_city',
      value: { cities: selectedCities }
    });
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="mr-auto mt-2 flex w-full max-w-md flex-col gap-3 rounded-2xl border border-[#ddd7ca] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recommended Excursions</p>
          <h4 className="text-[10px] text-slate-400 mt-0.5">Select excursions to treat this as a multicity itinerary</h4>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
          <Sparkles size={10} className="animate-pulse" /> AI Curated
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {suggestions.map((item, idx) => {
          const isSelected = selectedCities.includes(item.city);
          return (
            <div 
              key={idx} 
              onClick={() => handleToggle(item.city)}
              className={`relative flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                isSelected 
                  ? 'border-indigo-200 bg-indigo-50/20 shadow-sm' 
                  : 'border-slate-100 bg-slate-50/40 hover:border-slate-200 hover:bg-slate-50/80'
              } ${submitted ? 'pointer-events-none opacity-80' : ''}`}
            >
              <div className="mt-1 flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  disabled={submitted}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin size={13} className="text-indigo-500" />
                      {item.city}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-400 uppercase">
                      <span className="flex items-center gap-1">
                        <Navigation size={10} /> {item.distance}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {item.recommended_duration}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-500 mt-2">
                  {item.why_visit}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleAddAllSelected}
        disabled={selectedCities.length === 0 || submitted}
        className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-sm transition-all ${
          selectedCities.length === 0 || submitted
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:scale-[1.01] active:scale-[0.99] shadow-indigo-600/10'
        }`}
      >
        {submitted ? (
          <>
            <Check size={16} strokeWidth={2.5} /> Added to Trip
          </>
        ) : (
          <>
            <Plus size={16} strokeWidth={2.5} /> Add to Trip ({selectedCities.length} Selected)
          </>
        )}
      </button>
    </div>
  );
}

