'use client';

import React from 'react';
import { MapPin, CalendarDays, Users } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import LocationAutocomplete from '@/components/bookings/location-autocomplete';
import SearchField from './SearchField';
import SelectField from './SelectField';

interface BusSearchFormProps {
  params: BookingSearchParams;
  onUpdateParam: (field: keyof BookingSearchParams, value: string) => void;
}

export default function BusSearchForm({ params, onUpdateParam }: BusSearchFormProps) {
  return (
    <>
      <LocationAutocomplete
        icon={MapPin}
        label="From city"
        value={params.origin}
        type="city"
        placeholder="Bangalore"
        onChange={(v) => onUpdateParam('origin', v)}
        flex="w-full"
      />

      <LocationAutocomplete
        icon={MapPin}
        label="To city"
        value={params.destination}
        type="city"
        placeholder="Goa"
        onChange={(v) => onUpdateParam('destination', v)}
        flex="w-full"
      />

      <SearchField
        icon={CalendarDays}
        label="Date"
        type="date"
        value={params.departureDate}
        onChange={(v) => onUpdateParam('departureDate', v)}
      />

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
          onChange={(v) => onUpdateParam('fareType', v)}
        />
        <SearchField
          icon={Users}
          label="Passengers"
          type="number"
          value={params.travellers}
          onChange={(v) => onUpdateParam('travellers', v)}
        />
      </div>
    </>
  );
}
