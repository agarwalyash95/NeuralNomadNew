'use client';

import React, { FormEvent, useState } from 'react';
import {
  BedDouble,
  BusFront,
  Car,
  Plane,
  Search,
  TrainFront,
  ChevronDown,
  MapPin,
  CalendarDays,
  Users,
} from 'lucide-react';
import { useTravelSearch } from '@/hooks/use-travel-search';
import { BookingSearchParams, BookingService } from '@/types/booking';
import SearchResults from '@/components/bookings/search-results';
import LocationAutocomplete from '@/components/bookings/location-autocomplete';

const services: { id: BookingService; label: string; icon: React.ElementType }[] = [
  { id: 'flight', label: 'Flights', icon: Plane },
  { id: 'hotel', label: 'Hotels', icon: BedDouble },
  { id: 'train', label: 'Trains', icon: TrainFront },
  { id: 'bus', label: 'Bus', icon: BusFront },
  { id: 'cab', label: 'Cabs', icon: Car },
];

const initialParams: BookingSearchParams = {
  service: 'flight',
  tripType: 'one-way',
  origin: '',
  destination: '',
  departureDate: '',
  returnDate: '',
  travellers: '1',
  cabinClass: 'Economy',
  fareType: 'Regular',
  city: '',
  checkIn: '',
  checkOut: '',
  roomCount: '1',
  nationality: 'Indian',
  trainClass: 'SL',
  quota: 'General',
  cabType: 'airport',
  pickup: '',
  drop: '',
};

function updateParam(
  setParams: React.Dispatch<React.SetStateAction<BookingSearchParams>>,
  field: keyof BookingSearchParams,
  value: string
) {
  setParams((current) => ({ ...current, [field]: value }));
}

function validateParams(params: BookingSearchParams): string | null {
  if (params.service === 'hotel') {
    if (!params.city.trim()) return 'Enter a destination city.';
    return null;
  }
  if (params.service === 'cab') {
    if (!params.pickup.trim()) return 'Enter a pickup location.';
    return null;
  }
  if (!params.origin.trim() && !params.destination.trim()) return 'Enter origin or destination.';
  return null;
}

function SearchField({
  label,
  value,
  placeholder,
  type = 'text',
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
  icon?: React.ElementType;
}) {
  return (
    <div className="group relative w-full rounded-2xl border border-[#ddd7ca] bg-white px-3 py-3 transition-colors focus-within:border-blue-500">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={16} className="shrink-0 text-slate-400 group-focus-within:text-blue-500" /> : null}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full truncate bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none"
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: React.ElementType;
}) {
  return (
    <div className="group relative w-full rounded-2xl border border-[#ddd7ca] bg-white px-3 py-3 transition-colors focus-within:border-blue-500">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600">
        {label}
      </label>
      <div className="relative flex items-center gap-2">
        {Icon ? <Icon size={16} className="shrink-0 text-slate-400 group-focus-within:text-blue-500" /> : null}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer truncate appearance-none bg-transparent pr-4 text-sm font-semibold text-slate-800 outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

interface BookingHelperProps {
  initialService: BookingService;
}

export default function BookingHelper({ initialService }: BookingHelperProps) {
  const { results, loading, search } = useTravelSearch();
  const [params, setParams] = useState<BookingSearchParams>({
    ...initialParams,
    service: initialService,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const activeService = services.find((s) => s.id === params.service) ?? services[0]!;

  function changeService(service: BookingService) {
    setParams((current) => ({ ...current, service }));
    setFormError(null);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateParams(params);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setIsSearchExpanded(false);
    await search(params);
  }

  function getSearchSummary() {
    if (params.service === 'hotel') {
      return params.city ? `Hotels in ${params.city}` : 'Where to stay?';
    }
    if (params.service === 'cab') {
      return params.pickup ? `Cab from ${params.pickup}` : 'Pickup location?';
    }
    if (params.origin && params.destination) {
      return `${params.origin} to ${params.destination}`;
    }
    return 'Where to next?';
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#f7f4ed]">
      <div className="sticky top-0 z-10 shrink-0 border-b border-[#e2ddd2] bg-white/90 p-4 backdrop-blur-sm">
        <div className="flex gap-1 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {services.map(({ id, label, icon: Icon }) => {
            const isActive = params.service === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => changeService(id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'border border-blue-200 bg-blue-50 text-blue-600'
                    : 'border border-transparent text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-blue-500' : ''} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-4">
        {!isSearchExpanded ? (
          <div
            onClick={() => setIsSearchExpanded(true)}
            className="flex w-full cursor-pointer items-center justify-between rounded-[24px] border border-[#ddd7ca] bg-white p-4 shadow-sm transition-colors hover:bg-[#faf8f2]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[#e9e3d8] bg-[#f6f4ef] p-2 text-blue-600">
                {React.createElement(activeService.icon, { size: 16 })}
              </div>
              <div>
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {activeService.label}
                </p>
                <p className="text-sm font-semibold text-slate-800">{getSearchSummary()}</p>
              </div>
            </div>
            <Search size={16} className="text-slate-400" />
          </div>
        ) : (
          <form onSubmit={handleSearch} className="flex flex-col gap-3 rounded-[24px] border border-[#ddd7ca] bg-white p-4 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Edit search</h3>
              <button
                type="button"
                onClick={() => setIsSearchExpanded(false)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Cancel
              </button>
            </div>

            {params.service === 'flight' ? (
              <div className="mb-1 flex gap-2">
                {(['one-way', 'round-trip'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updateParam(setParams, 'tripType', t)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition-all ${
                      params.tripType === t
                        ? 'border-slate-800 bg-slate-800 text-white'
                        : 'border-slate-300 bg-transparent text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {t.replace('-', ' ')}
                  </button>
                ))}
              </div>
            ) : null}

            {params.service === 'flight' ? (
              <>
                <LocationAutocomplete icon={MapPin} label="From" value={params.origin} type="airport" placeholder="City or airport" onChange={(v) => updateParam(setParams, 'origin', v)} flex="w-full" />
                <LocationAutocomplete icon={MapPin} label="To" value={params.destination} type="airport" placeholder="City or airport" onChange={(v) => updateParam(setParams, 'destination', v)} flex="w-full" />
                <div className="flex gap-2">
                  <SearchField icon={CalendarDays} label="Depart" type="date" value={params.departureDate} onChange={(v) => updateParam(setParams, 'departureDate', v)} />
                  {params.tripType === 'round-trip' ? (
                    <SearchField icon={CalendarDays} label="Return" type="date" value={params.returnDate} onChange={(v) => updateParam(setParams, 'returnDate', v)} />
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <SearchField icon={Users} label="Travellers" type="number" value={params.travellers} onChange={(v) => updateParam(setParams, 'travellers', v)} />
                  <SelectField
                    label="Class"
                    value={params.cabinClass}
                    options={[
                      { value: 'Economy', label: 'Economy' },
                      { value: 'Premium Economy', label: 'Premium economy' },
                      { value: 'Business', label: 'Business' },
                      { value: 'First', label: 'First' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'cabinClass', v)}
                  />
                </div>
              </>
            ) : null}

            {params.service === 'hotel' ? (
              <>
                <LocationAutocomplete icon={MapPin} label="Where" value={params.city} type="city" placeholder="City, area, or property" onChange={(v) => updateParam(setParams, 'city', v)} flex="w-full" />
                <div className="flex gap-2">
                  <SearchField icon={CalendarDays} label="Check-in" type="date" value={params.checkIn} onChange={(v) => updateParam(setParams, 'checkIn', v)} />
                  <SearchField icon={CalendarDays} label="Check-out" type="date" value={params.checkOut} onChange={(v) => updateParam(setParams, 'checkOut', v)} />
                </div>
                <div className="flex gap-2">
                  <SearchField icon={BedDouble} label="Rooms" type="number" value={params.roomCount} placeholder="1" onChange={(v) => updateParam(setParams, 'roomCount', v)} />
                  <SelectField
                    icon={Users}
                    label="Guests"
                    value={params.travellers}
                    options={[
                      { value: '1', label: '1 guest' },
                      { value: '2', label: '2 guests' },
                      { value: '3', label: '3 guests' },
                      { value: '4', label: '4 guests' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'travellers', v)}
                  />
                </div>
              </>
            ) : null}

            {params.service === 'train' ? (
              <>
                <LocationAutocomplete icon={TrainFront} label="From station" value={params.origin} type="station" placeholder="Delhi" onChange={(v) => updateParam(setParams, 'origin', v)} flex="w-full" />
                <LocationAutocomplete icon={TrainFront} label="To station" value={params.destination} type="station" placeholder="Mumbai" onChange={(v) => updateParam(setParams, 'destination', v)} flex="w-full" />
                <SearchField icon={CalendarDays} label="Travel date" type="date" value={params.departureDate} onChange={(v) => updateParam(setParams, 'departureDate', v)} />
                <div className="flex gap-2">
                  <SelectField
                    label="Class"
                    value={params.trainClass}
                    options={[
                      { value: 'SL', label: 'SL • Sleeper' },
                      { value: '3A', label: '3A • AC 3-Tier' },
                      { value: '2A', label: '2A • AC 2-Tier' },
                      { value: '1A', label: '1A • First AC' },
                      { value: 'CC', label: 'CC • Chair Car' },
                      { value: 'EC', label: 'EC • Executive Chair' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'trainClass', v)}
                  />
                  <SelectField
                    label="Quota"
                    value={params.quota}
                    options={[
                      { value: 'GN', label: 'General' },
                      { value: 'TQ', label: 'Tatkal' },
                      { value: 'LD', label: 'Ladies' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'quota', v)}
                  />
                </div>
              </>
            ) : null}

            {params.service === 'bus' ? (
              <>
                <LocationAutocomplete icon={MapPin} label="From city" value={params.origin} type="city" placeholder="Bangalore" onChange={(v) => updateParam(setParams, 'origin', v)} flex="w-full" />
                <LocationAutocomplete icon={MapPin} label="To city" value={params.destination} type="city" placeholder="Goa" onChange={(v) => updateParam(setParams, 'destination', v)} flex="w-full" />
                <SearchField icon={CalendarDays} label="Date" type="date" value={params.departureDate} onChange={(v) => updateParam(setParams, 'departureDate', v)} />
                <div className="flex gap-2">
                  <SelectField
                    label="Seat type"
                    value={params.fareType}
                    options={[
                      { value: 'Sleeper', label: 'Sleeper' },
                      { value: 'Semi-Sleeper', label: 'Semi-sleeper' },
                      { value: 'Seater', label: 'Seater' },
                      { value: 'AC Sleeper', label: 'AC Sleeper' },
                      { value: 'AC Seater', label: 'AC Seater' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'fareType', v)}
                  />
                  <SearchField icon={Users} label="Passengers" type="number" value={params.travellers} onChange={(v) => updateParam(setParams, 'travellers', v)} />
                </div>
              </>
            ) : null}

            {params.service === 'cab' ? (
              <>
                <SelectField
                  icon={Car}
                  label="Cab type"
                  value={params.cabType}
                  options={[
                    { value: 'outstation', label: 'Outstation' },
                    { value: 'airport', label: 'Airport transfer' },
                    { value: 'hourly', label: 'Hourly rental' },
                  ]}
                  onChange={(v) => updateParam(setParams, 'cabType', v)}
                />
                <LocationAutocomplete icon={MapPin} label="Pickup" value={params.pickup} type="city" placeholder="Delhi Airport" onChange={(v) => updateParam(setParams, 'pickup', v)} flex="w-full" />
                {params.cabType === 'outstation' ? (
                  <LocationAutocomplete icon={MapPin} label="Drop" value={params.drop} type="city" placeholder="Agra" onChange={(v) => updateParam(setParams, 'drop', v)} flex="w-full" />
                ) : null}
                <SearchField icon={CalendarDays} label="Pickup time" type="datetime-local" value={params.departureDate} onChange={(v) => updateParam(setParams, 'departureDate', v)} />
              </>
            ) : null}

            <button
              type="submit"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800"
            >
              <Search size={16} />
              Search
            </button>

            {formError ? (
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-600">
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                {formError}
              </div>
            ) : null}
          </form>
        )}

        <div className="mt-6 border-t border-[#e7e1d5] pt-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-500">Searching live inventory...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800">Results</h3>
              <div className="custom-scrollbar max-h-[400px] overflow-y-auto pr-1">
                <SearchResults results={results} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
