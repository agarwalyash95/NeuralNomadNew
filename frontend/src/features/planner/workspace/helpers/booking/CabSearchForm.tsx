'use client';

import React from 'react';
import { MapPin, CalendarDays, Car } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import LocationAutocomplete from '@/components/bookings/location-autocomplete';
import SearchField from './SearchField';
import SelectField from './SelectField';

interface CabSearchFormProps {
  params: BookingSearchParams;
  onUpdateParam: (field: keyof BookingSearchParams, value: string) => void;
}

export default function CabSearchForm({ params, onUpdateParam }: CabSearchFormProps) {
  return (
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
        onChange={(v) => onUpdateParam('cabType', v)}
      />

      <LocationAutocomplete
        icon={MapPin}
        label="Pickup"
        value={params.pickup}
        type="city"
        placeholder="Delhi Airport"
        onChange={(v) => onUpdateParam('pickup', v)}
        flex="w-full"
      />

      {params.cabType === 'outstation' ? (
        <LocationAutocomplete
          icon={MapPin}
          label="Drop"
          value={params.drop}
          type="city"
          placeholder="Agra"
          onChange={(v) => onUpdateParam('drop', v)}
          flex="w-full"
        />
      ) : null}

      <SearchField
        icon={CalendarDays}
        label="Pickup time"
        type="datetime-local"
        value={params.departureDate}
        onChange={(v) => onUpdateParam('departureDate', v)}
      />
    </>
  );
}
