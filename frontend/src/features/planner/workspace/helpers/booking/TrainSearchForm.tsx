'use client';

import React from 'react';
import { TrainFront, CalendarDays } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import LocationAutocomplete from '@/components/bookings/location-autocomplete';
import SearchField from './SearchField';
import SelectField from './SelectField';

interface TrainSearchFormProps {
  params: BookingSearchParams;
  onUpdateParam: (field: keyof BookingSearchParams, value: string) => void;
}

export default function TrainSearchForm({ params, onUpdateParam }: TrainSearchFormProps) {
  return (
    <>
      <LocationAutocomplete
        icon={TrainFront}
        label="From station"
        value={params.origin}
        type="station"
        placeholder="Delhi"
        onChange={(v) => onUpdateParam('origin', v)}
        flex="w-full"
      />

      <LocationAutocomplete
        icon={TrainFront}
        label="To station"
        value={params.destination}
        type="station"
        placeholder="Mumbai"
        onChange={(v) => onUpdateParam('destination', v)}
        flex="w-full"
      />

      <SearchField
        icon={CalendarDays}
        label="Travel date"
        type="date"
        value={params.departureDate}
        onChange={(v) => onUpdateParam('departureDate', v)}
      />

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
          onChange={(v) => onUpdateParam('trainClass', v)}
        />
        <SelectField
          label="Quota"
          value={params.quota}
          options={[
            { value: 'GN', label: 'General' },
            { value: 'TQ', label: 'Tatkal' },
            { value: 'LD', label: 'Ladies' },
          ]}
          onChange={(v) => onUpdateParam('quota', v)}
        />
      </div>
    </>
  );
}
