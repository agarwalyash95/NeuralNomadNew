import React, { useState } from 'react';
import {
  Search, Calendar, Navigation, Sparkles, MapPin, Clock, Plus, Check,
} from 'lucide-react';
import type { WidgetData } from '@/services/planner.types';

export interface ChatWidgetProps {
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
}

export function ChatWidget({ widget, onSubmit }: ChatWidgetProps) {
  if (widget.type === 'destination_search') {
    return <DestinationWidget onSubmit={onSubmit} widget={widget} />;
  }
  if (widget.type === 'origin_search') {
    return <OriginWidget onSubmit={onSubmit} widget={widget} />;
  }
  if (widget.type === 'date_range_picker') {
    return <DateRangeWidget onSubmit={onSubmit} widget={widget} />;
  }
  if (widget.type === 'optional_trip_details') {
    return <OptionalDetailsWidget widget={widget} onSubmit={onSubmit} />;
  }
  if (widget.type === 'nearby_cities_recommendation') {
    return <NearbyCitiesWidget widget={widget} onSubmit={onSubmit} />;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Origin Widget
// ─────────────────────────────────────────────────────────────

const POPULAR_DEPARTURES = [
  'Delhi', 'Mumbai', 'London', 'New York', 'Paris', 'Singapore',
  'Tokyo', 'Dubai', 'Sydney', 'Bareilly',
];

function OriginWidget({ onSubmit, widget }: { onSubmit: (m: string, s: any) => void; widget: WidgetData }) {
  const [city, setCity] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const destination = widget.data?.destination;
  const intent = (widget.data?.intent as string) || 'full_trip';
  const destName = (typeof destination === 'object' && destination && 'name' in (destination as any))
    ? (destination as any).name as string
    : (typeof destination === 'string' ? destination : '');

  let title = 'Departure Location';
  let messagePrefix = 'Departing from';
  let placeholder = 'Enter departure city...';

  if (intent === 'flight_only') {
    title = 'Departure Airport / City';
    messagePrefix = 'Flying from';
    placeholder = 'e.g. Delhi, Mumbai, London...';
  } else if (intent === 'train_only') {
    title = 'Boarding Station';
    messagePrefix = 'Boarding train from';
    placeholder = 'e.g. Delhi Junction, Mumbai Central...';
  } else if (intent === 'cab_only') {
    title = 'Pickup Location';
    messagePrefix = 'Pickup cab from';
    placeholder = 'e.g. Hotel, Airport, Address...';
  }

  const filtered = city.trim().length > 0
    ? POPULAR_DEPARTURES.filter(d => d.toLowerCase().startsWith(city.toLowerCase()))
    : [];

  const handleSelect = (e?: React.FormEvent, selectedCity?: string) => {
    e?.preventDefault();
    const originCity = selectedCity ?? city.trim();
    if (!originCity) return;
    setShowSuggestions(false);
    onSubmit(`${messagePrefix} ${originCity}`, {
      field: 'origin',
      value: { name: originCity },
    });
  };

  return (
    <form
      onSubmit={handleSelect}
      className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-[#ddd7ca] bg-white p-3 shadow-sm animate-fade-in"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
          <Navigation size={10} /> Transit Route
        </span>
      </div>

      <p className="text-xs text-slate-400">
        Where are you starting your journey to {destName || 'your destination'}?
      </p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          autoFocus
          value={city}
          onChange={(e) => { setCity(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-100 bg-white shadow-lg overflow-hidden">
            {filtered.slice(0, 5).map((dest) => (
              <button
                key={dest}
                type="button"
                onMouseDown={() => handleSelect(undefined, dest)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <MapPin size={13} className="text-slate-400" /> {dest}
              </button>
            ))}
          </div>
        )}
      </div>

      {city.trim().length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_DEPARTURES.slice(0, 6).map((dest) => (
            <button
              key={dest}
              type="button"
              onClick={() => handleSelect(undefined, dest)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {dest}
            </button>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={!city.trim()}
        className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
      >
        Confirm Departure Location
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Destination Widget
// ─────────────────────────────────────────────────────────────

const POPULAR_DESTINATIONS = [
  'Paris', 'Tokyo', 'Bali', 'Dubai', 'New York', 'Singapore',
  'London', 'Rome', 'Bangkok', 'Goa',
];

function DestinationWidget({ onSubmit, widget }: { onSubmit: (m: string, s: any) => void; widget?: WidgetData }) {
  const [city, setCity] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const intent = (widget?.data?.intent as string) || 'full_trip';

  let title = 'Select Destination';
  let placeholder = 'e.g. Paris, Tokyo, Bali...';
  let messagePrefix = 'I want to go to';

  if (intent === 'flight_only') {
    title = 'Arrival Airport / City';
    placeholder = 'e.g. Mumbai, London, Dubai...';
    messagePrefix = 'Book a flight to';
  } else if (intent === 'train_only') {
    title = 'Destination Station / City';
    placeholder = 'e.g. Delhi, Mumbai, Patna...';
    messagePrefix = 'Book a train to';
  } else if (intent === 'bus_only') {
    title = 'Bus Destination';
    placeholder = 'e.g. Manali, Shimla, Jaipur...';
    messagePrefix = 'Book a bus to';
  } else if (intent === 'cab_only') {
    title = 'Drop Location';
    placeholder = 'e.g. Airport, Hotel, City...';
    messagePrefix = 'Book a cab to';
  } else if (intent === 'hotel_only') {
    title = 'Hotel / Stay Location';
    placeholder = 'e.g. Goa, Paris, Maldives...';
    messagePrefix = 'Find hotels in';
  }

  const filtered = city.trim().length > 0
    ? POPULAR_DESTINATIONS.filter(d => d.toLowerCase().startsWith(city.toLowerCase()))
    : [];

  const handleSelect = (e?: React.FormEvent, selectedCity?: string) => {
    e?.preventDefault();
    const dest = selectedCity ?? city.trim();
    if (!dest) return;
    setShowSuggestions(false);
    onSubmit(`${messagePrefix} ${dest}`, {
      field: 'destination',
      value: { name: dest },
    });
  };

  return (
    <form
      onSubmit={handleSelect}
      className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-[#ddd7ca] bg-white p-3 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
          <Sparkles size={10} /> AI Analyzing
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          autoFocus
          value={city}
          onChange={(e) => { setCity(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-100 bg-white shadow-lg overflow-hidden">
            {filtered.slice(0, 5).map((dest) => (
              <button
                key={dest}
                type="button"
                onMouseDown={() => handleSelect(undefined, dest)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <MapPin size={13} className="text-slate-400" /> {dest}
              </button>
            ))}
          </div>
        )}
      </div>

      {city.trim().length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_DESTINATIONS.slice(0, 6).map((dest) => (
            <button
              key={dest}
              type="button"
              onClick={() => handleSelect(undefined, dest)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {dest}
            </button>
          ))}
        </div>
      )}

      <button
        type="submit"
        disabled={!city.trim()}
        className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
      >
        Confirm Location
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Date Range Widget
// ─────────────────────────────────────────────────────────────

function DateRangeWidget({ onSubmit, widget }: { onSubmit: (m: string, s: any) => void; widget: WidgetData }) {
  const [tripType, setTripType] = useState<'round_trip' | 'one_way'>('round_trip');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const quickPicks = [
    { label: 'Next Weekend', startOffset: 6, endOffset: 8 },
    { label: 'Next Week', startOffset: 7, endOffset: 14 },
    { label: 'In 2 Weeks', startOffset: 14, endOffset: 21 },
    { label: 'Next Month', startOffset: 30, endOffset: 37 },
  ];

  const applyQuickPick = (_label: string, startOffset: number, endOffset: number) => {
    const start = new Date();
    start.setDate(start.getDate() + startOffset);
    const end = new Date();
    end.setDate(end.getDate() + endOffset);

    const sStr = start.toISOString().split('T')[0]!;
    const eStr = end.toISOString().split('T')[0]!;
    setStartDate(sStr);
    setEndDate(eStr);
  };

  const dayCount = startDate && endDate
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate) return;
    if (tripType === 'round_trip' && !endDate) return;

    const formattedStart = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formattedEnd = endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    
    const message = tripType === 'one_way'
      ? `Travelling on ${formattedStart}.`
      : `Travelling from ${formattedStart} to ${formattedEnd} (${dayCount} days).`;

    onSubmit(message, {
      field: 'travel_dates',
      value: {
        start_date: startDate,
        end_date: tripType === 'one_way' ? startDate : endDate,
      },
    });
  };

  const intent = (widget.data?.intent as string) || 'full_trip';
  const isTransit = ['flight_only', 'train_only', 'bus_only', 'cab_only', 'transit_only'].includes(intent);

  let startLabel = 'Start Date';
  let endLabel = 'End Date';

  if (intent === 'hotel_only') {
    startLabel = 'Check-in Date';
    endLabel = 'Check-out Date';
  } else if (intent === 'car_rental') {
    startLabel = 'Pickup Date';
    endLabel = 'Return Date';
  } else if (isTransit) {
    startLabel = 'Departure Date';
    endLabel = 'Return Date';
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-[#ddd7ca] bg-white p-4 shadow-sm animate-fade-in"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Travel Dates</p>
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
          <Calendar size={10} /> Optimize Season
        </span>
      </div>

      {isTransit && (
        <div className="flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTripType('one_way')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              tripType === 'one_way'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            One-Way
          </button>
          <button
            type="button"
            onClick={() => setTripType('round_trip')}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              tripType === 'round_trip'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Round-Trip
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {quickPicks.map((qp) => (
          <button
            key={qp.label}
            type="button"
            onClick={() => applyQuickPick(qp.label, qp.startOffset, qp.endOffset)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            {qp.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-semibold uppercase text-slate-500">{startLabel}</label>
          <input
            type="date"
            required
            min={todayStr}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        {tripType === 'round_trip' && (
          <div className="flex-1">
            <label className="text-[10px] font-semibold uppercase text-slate-500">{endLabel}</label>
            <input
              type="date"
              required
              value={endDate}
              min={startDate || todayStr}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={tripType === 'one_way' ? !startDate : (!startDate || !endDate)}
        className="mt-1 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500"
      >
        Confirm Dates
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Currency helpers
// ─────────────────────────────────────────────────────────────

const CURRENCY_CONFIGS: Record<string, { min: number; max: number; step: number; defaultValue: number; budgetThreshold: number; midThreshold: number }> = {
  USD: { min: 200, max: 10000, step: 100, defaultValue: 2000, budgetThreshold: 1000, midThreshold: 3000 },
  EUR: { min: 200, max: 10000, step: 100, defaultValue: 2000, budgetThreshold: 1000, midThreshold: 3000 },
  GBP: { min: 150, max: 8000, step: 100, defaultValue: 1500, budgetThreshold: 800, midThreshold: 2400 },
  INR: { min: 15000, max: 800000, step: 5000, defaultValue: 150000, budgetThreshold: 75000, midThreshold: 220000 },
  JPY: { min: 30000, max: 1500000, step: 10000, defaultValue: 300000, budgetThreshold: 150000, midThreshold: 450000 },
};

function getLocalCurrency() {
  if (typeof window === 'undefined') return { code: 'USD', symbol: '$' };
  let code = 'USD';
  const locale = navigator.language || 'en-US';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz?.includes('Kolkata') || tz?.includes('Calcutta')) code = 'INR';
    else if (locale.endsWith('-IN') || locale.startsWith('hi')) code = 'INR';
    else if (locale.endsWith('-GB') || tz?.includes('Europe/London')) code = 'GBP';
    else if (locale.endsWith('-JP') || locale.startsWith('ja')) code = 'JPY';
    else {
      const euroLocales = ['de', 'fr', 'es', 'it', 'nl', 'be', 'at', 'fi', 'ie', 'pt', 'gr'];
      if (euroLocales.some(el => locale.startsWith(el))) code = 'EUR';
    }
  } catch { /* noop */ }

  let symbol = '$';
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).formatToParts(1);
    symbol = parts.find(p => p.type === 'currency')?.value ?? symbol;
  } catch {
    if (code === 'INR') symbol = '₹';
    else if (code === 'GBP') symbol = '£';
    else if (code === 'JPY') symbol = '¥';
    else if (code === 'EUR') symbol = '€';
  }
  return { code, symbol };
}

function getBudgetTier(val: number, code: string) {
  const conf = (CURRENCY_CONFIGS[code] || CURRENCY_CONFIGS.USD) as NonNullable<typeof CURRENCY_CONFIGS[string]>;
  if (val < conf.budgetThreshold) return 'budget';
  if (val < conf.midThreshold) return 'mid_range';
  return 'premium';
}

const FIELD_OPTIONS: Record<string, string[]> = {
  flight_class: ['Economy', 'Premium Economy', 'Business', 'First Class'],
  train_class: ['Sleeper', '3rd AC', '2nd AC', '1st AC', 'Chair Car'],
  cabin_class: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
  car_type: ['Hatchback', 'Sedan', 'SUV', 'Luxury'],
  vehicle_type: ['Hatchback', 'Sedan', 'SUV', 'Luxury'],
  bus_type: ['AC Sleeper', 'Non-AC Sleeper', 'AC Seater', 'Volvo'],
  time_window: ['Morning', 'Afternoon', 'Evening', 'Night'],
  preferred_mode: ['Flight', 'Train', 'Bus', 'Cab', 'Mixed'],
  star_rating: ['3 Star', '4 Star', '5 Star', 'Luxury Resort'],
  meal_type: ['Breakfast Included', 'Half Board', 'All Inclusive'],
  cuisine: ['Local', 'North Indian', 'South Indian', 'Asian', 'Continental'],
  trip_pace: ['Relaxed', 'Balanced', 'Fast-Paced'],
  stay_amenities: ['Pool', 'Spa & Wellness', 'Free Breakfast', 'Beachfront', 'Gym'],
  property_type: ['Hotel', 'Resort', 'Villa', 'Boutique Stay'],
  non_stop: ['Direct Only', 'Any Flight'],
  tatkal: ['Standard Booking', 'Tatkal / Urgent'],
  meal_preference: ['Veg', 'Non-Veg', 'Jain'],
  journey_timing: ['Day Journey', 'Overnight'],
  return_trip: ['One Way', 'Round Trip'],
  transmission: ['Automatic', 'Manual'],
  priority: ['Cheapest', 'Fastest Route', 'Max Comfort'],
  intensity_level: ['Light & Easy', 'Moderate', 'Action-Packed'],
  dining_package: ['Standard Dining', 'Gourmet Package', 'Chef Table'],
  dietary: ['Vegetarian', 'Vegan', 'Jain', 'Halal', 'No Restrictions'],
  ambiance: ['Romantic', 'Family Friendly', 'Fine Dining', 'Casual Vibes'],
};

function OptionalDetailsWidget({
  widget,
  onSubmit,
}: {
  widget: WidgetData;
  onSubmit: (m: string, s: any) => void;
}) {
  const { code: currencyCode, symbol: currencySymbol } = getLocalCurrency();
  const config = (CURRENCY_CONFIGS[currencyCode] || CURRENCY_CONFIGS.USD) as NonNullable<typeof CURRENCY_CONFIGS[string]>;

  const rawFields = (widget.data.fields as string[]) || [];
  const fields = rawFields.length > 0 ? rawFields : ['visit_purpose', 'travelers', 'budget', 'interests', 'origin'];
  const prefilled = (widget.data.prefilled as Record<string, any>) || {};

  // State
  const [activeStep, setActiveStep] = useState(0);
  const [visitPurpose, setVisitPurpose] = useState(prefilled.visit_purpose || '');
  const [travelers, setTravelers] = useState(prefilled.travelers || 2);
  const [budgetVal, setBudgetVal] = useState(prefilled.budget_inr || prefilled.recommended_budget_inr || config.defaultValue);
  const [interests, setInterests] = useState<string[]>(prefilled.interests || []);
  const [origin, setOrigin] = useState(prefilled.origin || '');
  const [chipValues, setChipValues] = useState<Record<string, string>>(() => ({ ...prefilled }));

  const confidenceScore = Math.min(100, Math.round(50 + (activeStep / Math.max(1, fields.length)) * 50));
  const isFormComplete = activeStep >= fields.length;

  const handleNext = () => {
    setActiveStep(prev => prev + 1);
  };

  const getChipVal = (f: string) => chipValues[f] || prefilled[f] || '';
  const setChipVal = (f: string, v: string) => setChipValues(prev => ({ ...prev, [f]: v }));

  const handleSubmit = () => {
    const tier = getBudgetTier(budgetVal, currencyCode);
    const formattedBudget = new Intl.NumberFormat(undefined).format(budgetVal);
    const parts: string[] = [];

    if (fields.includes('visit_purpose') && visitPurpose) parts.push(`purpose: ${visitPurpose}`);
    if (fields.includes('travelers')) parts.push(`${travelers} travelers`);
    if (fields.includes('budget')) parts.push(`budget: ${currencySymbol}${formattedBudget}`);
    if (fields.includes('origin') && origin.trim()) parts.push(`from ${origin}`);
    if (fields.includes('interests') && interests.length) parts.push(`interests: ${interests.join(', ')}`);

    Object.entries(chipValues).forEach(([k, v]) => {
      if (v && fields.includes(k)) parts.push(`${k.replace('_', ' ')}: ${v}`);
    });

    const message = parts.length > 0 ? parts.join(', ') + '.' : 'Updated my preferences.';

    const chipPayload: Record<string, any> = {};
    Object.entries(chipValues).forEach(([k, v]) => {
      if (v && fields.includes(k)) chipPayload[k] = v;
    });

    onSubmit(message, {
      field: 'optional_trip_details',
      value: {
        visit_purpose: fields.includes('visit_purpose') ? visitPurpose : undefined,
        travelers: fields.includes('travelers') ? travelers : undefined,
        budget: fields.includes('budget') ? { tier, amount: budgetVal, currency: currencyCode } : undefined,
        budget_inr: fields.includes('budget') ? budgetVal : undefined,
        interests: fields.includes('interests') ? interests : undefined,
        origin: fields.includes('origin') && origin.trim() ? origin.trim() : undefined,
        ...chipPayload,
      },
    });
  };

  const renderField = (field: string, index: number) => {
    const isCompleted = index < activeStep;
    const isFuture = index > activeStep;

    if (isFuture) {
      return (
        <div key={field} className="py-2 opacity-40">
          <label className="text-[11px] font-semibold uppercase text-slate-500">
            {field.replace('_', ' ')} (Next)
          </label>
        </div>
      );
    }

    if (isCompleted) {
      let valStr = '';
      if (field === 'visit_purpose') valStr = visitPurpose;
      else if (field === 'travelers') valStr = `${travelers} Passengers`;
      else if (field === 'origin') valStr = origin;
      else if (field === 'budget') valStr = `${currencySymbol}${new Intl.NumberFormat(undefined).format(budgetVal)}`;
      else if (field === 'interests') valStr = interests.join(', ');
      else valStr = getChipVal(field);

      return (
        <div key={field} className="flex items-center gap-2 py-2 text-sm font-medium text-slate-600 border-b border-slate-50 last:border-0">
          <Check size={14} className="text-emerald-500" />
          <span className="capitalize">{field.replace('_', ' ')}:</span>
          <span className="text-slate-900 capitalize font-bold">{valStr || 'Not set'}</span>
        </div>
      );
    }

    const nextBtn = (
      <div className="mt-4 flex justify-end">
        <button onClick={handleNext} className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white transition-all hover:bg-slate-800">
          Next Step
        </button>
      </div>
    );

    const options = FIELD_OPTIONS[field] || ['Standard', 'Premium', 'Flexible'];
    const currentVal = getChipVal(field);

    // ACTIVE STEP
    return (
      <div key={field} className="py-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {field === 'visit_purpose' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-slate-500 flex justify-between">
              <span>Trip Purpose</span>
              {prefilled.visit_purpose && <span className="text-[9px] text-indigo-500 flex items-center gap-0.5"><Sparkles size={8}/> AI Detected</span>}
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Vacation', 'Business', 'Hometown', 'Family', 'Honeymoon', 'Solo'].map(p => (
                <button
                  key={p}
                  onClick={() => { setVisitPurpose(p.toLowerCase()); setTimeout(handleNext, 200); }}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border flex items-center gap-1 ${
                    visitPurpose === p.toLowerCase() ? 'bg-indigo-600 text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {field === 'travelers' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-slate-500">Travelers</label>
            <div className="mt-2 flex items-center gap-3">
              <button onClick={() => setTravelers(Math.max(1, travelers - 1))} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold hover:bg-slate-200">-</button>
              <span className="w-6 text-center text-sm font-bold text-slate-800">{travelers}</span>
              <button onClick={() => setTravelers(travelers + 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold hover:bg-slate-200">+</button>
            </div>
            {nextBtn}
          </div>
        )}

        {field === 'budget' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-slate-500 flex justify-between">
              <span>Trip Budget</span>
              {prefilled.recommended_budget_inr && <span className="text-[9px] text-indigo-500 flex items-center gap-0.5"><Sparkles size={8}/> Recommended</span>}
            </label>
            <div className="mt-2 text-sm font-bold text-blue-600">
              {currencySymbol}{new Intl.NumberFormat(undefined).format(budgetVal)}
            </div>
            <input type="range" min={config.min} max={config.max} step={config.step} value={budgetVal} onChange={(e) => setBudgetVal(Number(e.target.value))} className="mt-2 w-full h-1.5 cursor-pointer appearance-none rounded-lg bg-slate-200 accent-blue-600" />
            {nextBtn}
          </div>
        )}

        {field === 'origin' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-slate-500">Departure City</label>
            <div className="relative mt-2">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input value={origin} onChange={(e) => setOrigin(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleNext()} placeholder="e.g. Mumbai" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400" />
            </div>
            {nextBtn}
          </div>
        )}

        {field === 'interests' && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-slate-500">Interests</label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Food', 'Culture', 'Nature', 'Nightlife', 'Shopping', 'Relaxation', 'Adventure'].map(i => {
                const isSel = interests.includes(i.toLowerCase());
                return (
                  <button key={i} onClick={() => {
                    setInterests(prev => isSel ? prev.filter(x => x !== i.toLowerCase()) : [...prev, i.toLowerCase()]);
                  }} className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border ${isSel ? 'bg-emerald-500 text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                    {i}
                  </button>
                )
              })}
            </div>
            {nextBtn}
          </div>
        )}

        {/* Dynamic chip-based fields (handles all other fields + fallback) */}
        {!['visit_purpose', 'travelers', 'budget', 'origin', 'interests'].includes(field) && (
          <div>
            <label className="text-[11px] font-semibold uppercase text-slate-500 flex justify-between">
              <span>{field.replace('_', ' ')}</span>
              {prefilled[field] && <span className="text-[9px] text-indigo-500 flex items-center gap-0.5"><Sparkles size={8}/> Recommended</span>}
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => { setChipVal(field, opt); setTimeout(handleNext, 200); }}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all border ${currentVal === opt ? 'bg-indigo-600 text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mr-auto mt-2 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-[#ddd7ca] bg-white p-4 shadow-sm animate-fade-in">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Sparkles size={14} className="text-indigo-500 animate-pulse" />
          <span>Fine-tuning your trip</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">AI Confidence {confidenceScore}%</span>
          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-blue-500 h-1.5 rounded-full transition-all duration-700 ease-out" style={{ width: `${confidenceScore}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        {fields.map((field, idx) => renderField(field, idx))}
      </div>

      {isFormComplete && (
        <div className="mt-2 pt-2 animate-in fade-in zoom-in duration-300 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
          >
            <Check size={16} /> Confirm Preferences
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Nearby Cities Widget
// ─────────────────────────────────────────────────────────────

function NearbyCitiesWidget({
  widget,
  onSubmit,
}: {
  widget: WidgetData;
  onSubmit: (m: string, s: any) => void;
}) {
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

  const handleAddSelected = () => {
    if (selectedCities.length === 0 || submitted) return;
    setSubmitted(true);
    const citiesStr = selectedCities.join(', ');
    const msg = selectedCities.length === 1
      ? `Add ${citiesStr} to my trip as an excursion.`
      : `Add these excursions to my trip: ${citiesStr}.`;
    onSubmit(msg, { field: 'add_nearby_city', value: { cities: selectedCities } });
  };

  const handleSkip = () => {
    setSubmitted(true);
    onSubmit("No extra excursions, keep it to the main destination.", {
      field: 'add_nearby_city',
      value: { cities: [] },
    });
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="mr-auto mt-2 flex w-full max-w-md flex-col gap-3 rounded-2xl border border-[#ddd7ca] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Recommended Excursions</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Add nearby cities to make it a multi-city trip</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
          <Sparkles size={10} className="animate-pulse" /> AI Curated
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {suggestions.map((item, idx) => {
          const isSelected = selectedCities.includes(item.city);
          return (
            <div
              key={idx}
              onClick={() => handleToggle(item.city)}
              className={`relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${isSelected
                  ? 'border-indigo-200 bg-indigo-50/30 shadow-sm'
                  : 'border-slate-100 bg-slate-50/40 hover:border-slate-200 hover:bg-slate-50/80'
                } ${submitted ? 'pointer-events-none opacity-70' : ''}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                readOnly
                disabled={submitted}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-indigo-600"
              />
              <div className="flex-1">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                  <MapPin size={13} className="text-indigo-500" /> {item.city}
                </h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase text-slate-400">
                  <span className="flex items-center gap-1"><Navigation size={10} /> {item.distance}</span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1"><Clock size={10} /> {item.recommended_duration}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.why_visit}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={handleSkip}
          disabled={submitted}
          className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={handleAddSelected}
          disabled={selectedCities.length === 0 || submitted}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${selectedCities.length === 0 || submitted
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm'}`}
        >
          {submitted ? <><Check size={15} /> Added</> : <><Plus size={15} /> Add ({selectedCities.length})</>}
        </button>
      </div>
    </div>
  );
}
