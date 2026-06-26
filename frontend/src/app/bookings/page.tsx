'use client';

import { FormEvent, useState } from 'react';
import { BedDouble, BusFront, Car, Plane, Search, TrainFront, ChevronDown, MapPin, CalendarDays, Users } from 'lucide-react';
import { useTravelSearch } from '@/hooks/use-travel-search';
import AppShell from '@/components/ui-custom/app-shell';
import { BookingSearchParams, BookingService } from '@/types/booking';
import SearchResults from '@/components/bookings/search-results';
import LocationAutocomplete from '@/components/bookings/location-autocomplete';

// NOTE: IDs must match TravelService type (singular) and backend service_type values
const services: { id: BookingService; label: string; icon: React.ElementType }[] = [
  { id: 'flight', label: 'Flights', icon: Plane },
  { id: 'hotel',  label: 'Hotels',  icon: BedDouble },
  { id: 'train',  label: 'Trains',  icon: TrainFront },
  { id: 'bus',    label: 'Bus',     icon: BusFront },
  { id: 'cab',    label: 'Cabs',    icon: Car },
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

// ── Unified Search Fields ────────────────────────────────────────────────────
function SearchField({
  label, value, placeholder, type = 'text', onChange, icon: Icon, flex = 'flex-1'
}: {
  label: string; value: string; placeholder?: string; type?: string;
  onChange: (value: string) => void; icon?: React.ElementType; flex?: string;
}) {
  return (
    <div className={`relative group px-4 py-2 hover:bg-slate-50/50 transition-colors rounded-xl ${flex}`}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 group-focus-within:text-blue-600 transition-colors">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-slate-400 group-focus-within:text-blue-500" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 placeholder-slate-300 outline-none truncate"
        />
      </div>
    </div>
  );
}

function SelectField({
  label, value, options, onChange, icon: Icon, flex = 'flex-1'
}: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; icon?: React.ElementType; flex?: string;
}) {
  return (
    <div className={`relative group px-4 py-2 hover:bg-slate-50/50 transition-colors rounded-xl ${flex}`}>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 group-focus-within:text-blue-600 transition-colors">
        {label}
      </label>
      <div className="relative flex items-center gap-2">
        {Icon && <Icon size={16} className="text-slate-400 group-focus-within:text-blue-500" />}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 outline-none appearance-none cursor-pointer pr-4 truncate"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

function SearchDivider() {
  return <div className="hidden lg:block w-px h-10 bg-slate-200 shrink-0" />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BookingPage() {
  const { results, loading, search } = useTravelSearch();
  const [params, setParams] = useState<BookingSearchParams>(initialParams);
  const [formError, setFormError] = useState<string | null>(null);

  const activeService = services.find((s) => s.id === params.service) || services[0];

  function changeService(service: BookingService) {
    setParams((current) => ({ ...current, service }));
    setFormError(null);
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateParams(params);
    if (error) { setFormError(error); return; }
    setFormError(null);
    await search(params);
  }

  return (
    <AppShell>
      {/* Dynamic Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/20 blur-[100px] animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-400/20 blur-[120px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[50%] rounded-full bg-sky-300/20 blur-[100px] animate-blob animation-delay-4000" />
      </div>

      <div className="max-w-7xl mx-auto pt-8 pb-20 px-4">

        <div className="mb-8">
          <h1 className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tight text-center mb-6">
            Where to next?
          </h1>

          {/* Service Tabs */}
          <div className="flex justify-center mb-6">
            <div className="flex p-1.5 bg-white/50 backdrop-blur-xl border border-white/60 rounded-2xl shadow-sm">
              {services.map(({ id, label, icon: Icon }) => {
                const isActive = params.service === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => changeService(id)}
                    className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      isActive
                        ? 'bg-white text-blue-600 shadow-md shadow-blue-900/5'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                    }`}
                  >
                    <Icon size={18} className={isActive ? 'text-blue-500' : ''} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Unified Search Bar */}
        <div className="bg-white/80 backdrop-blur-2xl border border-white rounded-[2rem] shadow-xl p-2 sm:p-3 relative z-10 mx-auto max-w-6xl">
          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            
            {/* Context Actions (like one-way/round-trip) */}
            {params.service === 'flight' && (
              <div className="flex gap-2 px-4 pt-2">
                {(['one-way', 'round-trip'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => updateParam(setParams, 'tripType', t)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      params.tripType === t
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-transparent text-slate-500 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {t.replace('-', ' ')}
                  </button>
                ))}
              </div>
            )}

            {/* Main Input Row */}
            <div className="flex flex-col lg:flex-row items-center gap-2 bg-white rounded-2xl p-1 shadow-inner border border-slate-100">
              
              {/* ── FLIGHTS ── */}
              {params.service === 'flight' && (
                <>
                  <LocationAutocomplete icon={MapPin} label="From" value={params.origin} type="airport" placeholder="City or Airport" onChange={(v) => updateParam(setParams, 'origin', v)} flex="flex-[1.5]" />
                  <SearchDivider />
                  <LocationAutocomplete icon={MapPin} label="To" value={params.destination} type="airport" placeholder="City or Airport" onChange={(v) => updateParam(setParams, 'destination', v)} flex="flex-[1.5]" />
                  <SearchDivider />
                  <SearchField icon={CalendarDays} label="Depart" type="date" value={params.departureDate} onChange={(v) => updateParam(setParams, 'departureDate', v)} />
                  <SearchDivider />
                  {params.tripType === 'round-trip' && (
                    <>
                      <SearchField icon={CalendarDays} label="Return" type="date" value={params.returnDate} onChange={(v) => updateParam(setParams, 'returnDate', v)} />
                      <SearchDivider />
                    </>
                  )}
                  <SearchField icon={Users} label="Travellers" type="number" value={params.travellers} onChange={(v) => updateParam(setParams, 'travellers', v)} flex="flex-[0.8]" />
                  <SearchDivider />
                  <SelectField
                    label="Class"
                    value={params.cabinClass}
                    options={[
                      { value: 'Economy', label: 'Economy' },
                      { value: 'Premium Economy', label: 'Premium' },
                      { value: 'Business', label: 'Business' },
                      { value: 'First', label: 'First' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'cabinClass', v)}
                  />
                </>
              )}

              {/* ── HOTELS ── */}
              {params.service === 'hotel' && (
                <>
                  <LocationAutocomplete icon={MapPin} label="Where" value={params.city} type="city" placeholder="City, Area, or Property" onChange={(v) => updateParam(setParams, 'city', v)} flex="flex-[2]" />
                  <SearchDivider />
                  <SearchField icon={CalendarDays} label="Check-in" type="date" value={params.checkIn} onChange={(v) => updateParam(setParams, 'checkIn', v)} flex="flex-[1.2]" />
                  <SearchDivider />
                  <SearchField icon={CalendarDays} label="Check-out" type="date" value={params.checkOut} onChange={(v) => updateParam(setParams, 'checkOut', v)} flex="flex-[1.2]" />
                  <SearchDivider />
                  <SearchField icon={BedDouble} label="Rooms" type="number" value={params.roomCount} placeholder="1" onChange={(v) => updateParam(setParams, 'roomCount', v)} flex="flex-[0.8]" />
                  <SearchDivider />
                  <SelectField
                    icon={Users}
                    label="Guests"
                    value={params.travellers}
                    options={[
                      { value: '1', label: '1 Guest' },
                      { value: '2', label: '2 Guests' },
                      { value: '3', label: '3 Guests' },
                      { value: '4', label: '4 Guests' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'travellers', v)}
                  />
                </>
              )}

              {/* ── TRAINS ── */}
              {params.service === 'train' && (
                <>
                  <LocationAutocomplete icon={TrainFront} label="From Station" value={params.origin} type="station" placeholder="e.g., Delhi" onChange={(v) => updateParam(setParams, 'origin', v)} flex="flex-[1.5]" />
                  <SearchDivider />
                  <LocationAutocomplete icon={TrainFront} label="To Station" value={params.destination} type="station" placeholder="e.g., Mumbai" onChange={(v) => updateParam(setParams, 'destination', v)} flex="flex-[1.5]" />
                  <SearchDivider />
                  <SearchField icon={CalendarDays} label="Travel Date" type="date" value={params.departureDate} onChange={(v) => updateParam(setParams, 'departureDate', v)} />
                  <SearchDivider />
                  <SelectField
                    label="Class"
                    value={params.trainClass}
                    options={[
                      { value: 'SL',  label: 'SL — Sleeper' },
                      { value: '3A',  label: '3A — AC 3-Tier' },
                      { value: '2A',  label: '2A — AC 2-Tier' },
                      { value: '1A',  label: '1A — First AC' },
                      { value: 'CC',  label: 'CC — Chair Car' },
                      { value: 'EC',  label: 'EC — Exec Chair' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'trainClass', v)}
                  />
                  <SearchDivider />
                  <SelectField
                    label="Quota"
                    value={params.quota}
                    options={[
                      { value: 'GN', label: 'General' },
                      { value: 'TQ', label: 'Tatkal' },
                      { value: 'LD', label: 'Ladies' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'quota', v)}
                    flex="flex-[0.8]"
                  />
                </>
              )}

              {/* ── BUS ── */}
              {params.service === 'bus' && (
                <>
                  <LocationAutocomplete icon={MapPin} label="From City" value={params.origin} type="city" placeholder="e.g., Bangalore" onChange={(v) => updateParam(setParams, 'origin', v)} flex="flex-[1.5]" />
                  <SearchDivider />
                  <LocationAutocomplete icon={MapPin} label="To City" value={params.destination} type="city" placeholder="e.g., Goa" onChange={(v) => updateParam(setParams, 'destination', v)} flex="flex-[1.5]" />
                  <SearchDivider />
                  <SearchField icon={CalendarDays} label="Date" type="date" value={params.departureDate} onChange={(v) => updateParam(setParams, 'departureDate', v)} />
                  <SearchDivider />
                  <SelectField
                    label="Seat Type"
                    value={params.fareType}
                    options={[
                      { value: 'Sleeper',       label: 'Sleeper' },
                      { value: 'Semi-Sleeper',  label: 'Semi-Sleeper' },
                      { value: 'Seater',        label: 'Seater' },
                      { value: 'AC Sleeper',    label: 'AC Sleeper' },
                      { value: 'AC Seater',     label: 'AC Seater' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'fareType', v)}
                  />
                  <SearchDivider />
                  <SearchField icon={Users} label="Passengers" type="number" value={params.travellers} onChange={(v) => updateParam(setParams, 'travellers', v)} flex="flex-[0.8]" />
                </>
              )}

              {/* ── CABS ── */}
              {params.service === 'cab' && (
                <>
                  <SelectField
                    icon={Car}
                    label="Cab Type"
                    value={params.cabType}
                    options={[
                      { value: 'outstation', label: 'Outstation' },
                      { value: 'airport',    label: 'Airport Transfer' },
                      { value: 'hourly',     label: 'Hourly Rental' },
                    ]}
                    onChange={(v) => updateParam(setParams, 'cabType', v)}
                  />
                  <SearchDivider />
                  <LocationAutocomplete icon={MapPin} label="Pickup" value={params.pickup} type="city" placeholder="e.g., Delhi Airport" onChange={(v) => updateParam(setParams, 'pickup', v)} flex="flex-[1.5]" />
                  <SearchDivider />
                  {params.cabType === 'outstation' && (
                    <>
                      <LocationAutocomplete icon={MapPin} label="Drop" value={params.drop} type="city" placeholder="e.g., Agra" onChange={(v) => updateParam(setParams, 'drop', v)} flex="flex-[1.5]" />
                      <SearchDivider />
                    </>
                  )}
                  <SearchField icon={CalendarDays} label="Pickup Time" type="datetime-local" value={params.departureDate} onChange={(v) => updateParam(setParams, 'departureDate', v)} flex="flex-[1.5]" />
                </>
              )}

              {/* Search Button (Aligned within the row on desktop) */}
              <button
                type="submit"
                className="w-full lg:w-auto h-16 px-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 m-1"
              >
                <Search size={18} />
                Search
              </button>
            </div>

            {formError && (
              <div className="px-4 py-3 rounded-xl bg-red-50/80 text-red-600 text-sm font-bold flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                {formError}
              </div>
            )}
          </form>
        </div>

        {/* Results Section */}
        <div className="mt-16 max-w-6xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin mb-4" />
              <p className="text-slate-500 font-bold tracking-wide">Searching live inventory...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-slate-800">Available {activeService?.label}</h2>
              <SearchResults results={results} />
            </div>
          ) : null}
        </div>

      </div>
    </AppShell>
  );
}
