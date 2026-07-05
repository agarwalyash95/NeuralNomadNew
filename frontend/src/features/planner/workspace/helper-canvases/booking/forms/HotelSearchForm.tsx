'use client';

import React from 'react';
import { MapPin, CalendarDays, BedDouble, Users } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import LocationAutocomplete from '@/components/bookings/location-autocomplete';
import SearchField from './SearchField';
import SelectField from './SelectField';

interface HotelSearchFormProps {
  params: BookingSearchParams;
  onUpdateParam: (field: keyof BookingSearchParams, value: string) => void;
}

export default function HotelSearchForm({ params, onUpdateParam }: HotelSearchFormProps) {
  return (
    <>
      <LocationAutocomplete
        icon={MapPin}
        label="Where"
        value={params.city}
        type="city"
        placeholder="City, area, or property"
        onChange={(v) => onUpdateParam('city', v)}
        flex="w-full"
      />

      <div className="flex gap-2">
        <SearchField
          icon={CalendarDays}
          label="Check-in"
          type="date"
          value={params.checkIn}
          onChange={(v) => onUpdateParam('checkIn', v)}
        />
        <SearchField
          icon={CalendarDays}
          label="Check-out"
          type="date"
          value={params.checkOut}
          onChange={(v) => onUpdateParam('checkOut', v)}
        />
      </div>

      <div className="flex gap-2">
        <SearchField
          icon={BedDouble}
          label="Rooms"
          type="number"
          value={params.roomCount}
          placeholder="1"
          onChange={(v) => onUpdateParam('roomCount', v)}
        />
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
          onChange={(v) => onUpdateParam('travellers', v)}
        />
      </div>
    </>
  );
}
