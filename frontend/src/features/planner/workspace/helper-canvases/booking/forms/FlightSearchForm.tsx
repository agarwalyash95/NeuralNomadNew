'use client';

import React from 'react';
import { MapPin, CalendarDays, Users } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import LocationAutocomplete from '@/components/bookings/location-autocomplete';
import SearchField from './SearchField';
import SelectField from './SelectField';

interface FlightSearchFormProps {
  params: BookingSearchParams;
  onUpdateParam: (field: keyof BookingSearchParams, value: string) => void;
}

export default function FlightSearchForm({ params, onUpdateParam }: FlightSearchFormProps) {
  return (
    <>
      <div className="mb-1 flex gap-2">
        {(['one-way', 'round-trip'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onUpdateParam('tripType', t)}
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

      <LocationAutocomplete
        icon={MapPin}
        label="From"
        value={params.origin}
        type="airport"
        placeholder="City or airport"
        onChange={(v) => onUpdateParam('origin', v)}
        flex="w-full"
      />

      <LocationAutocomplete
        icon={MapPin}
        label="To"
        value={params.destination}
        type="airport"
        placeholder="City or airport"
        onChange={(v) => onUpdateParam('destination', v)}
        flex="w-full"
      />

      <div className="flex gap-2">
        <SearchField
          icon={CalendarDays}
          label="Depart"
          type="date"
          value={params.departureDate}
          onChange={(v) => onUpdateParam('departureDate', v)}
        />
        {params.tripType === 'round-trip' ? (
          <SearchField
            icon={CalendarDays}
            label="Return"
            type="date"
            value={params.returnDate}
            onChange={(v) => onUpdateParam('returnDate', v)}
          />
        ) : null}
      </div>

      <div className="flex gap-2">
        <SearchField
          icon={Users}
          label="Travellers"
          type="number"
          value={params.travellers}
          onChange={(v) => onUpdateParam('travellers', v)}
        />
        <SelectField
          label="Class"
          value={params.cabinClass}
          options={[
            { value: 'Economy', label: 'Economy' },
            { value: 'Premium Economy', label: 'Premium economy' },
            { value: 'Business', label: 'Business' },
            { value: 'First', label: 'First' },
          ]}
          onChange={(v) => onUpdateParam('cabinClass', v)}
        />
      </div>
    </>
  );
}
