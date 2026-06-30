'use client';

import React, { FormEvent, useState } from 'react';
import {
  BedDouble,
  BusFront,
  Car,
  Plane,
  Search,
  TrainFront,
} from 'lucide-react';
import { useTravelSearch } from '@/hooks/use-travel-search';
import { BookingSearchParams, BookingService } from '@/types/booking';
import FlightSearchForm from './helpers/booking/FlightSearchForm';
import HotelSearchForm from './helpers/booking/HotelSearchForm';
import TrainSearchForm from './helpers/booking/TrainSearchForm';
import BusSearchForm from './helpers/booking/BusSearchForm';
import CabSearchForm from './helpers/booking/CabSearchForm';
import BookingResults from './helpers/booking/BookingResults';

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

            {params.service === 'flight' && (
              <FlightSearchForm
                params={params}
                onUpdateParam={(field, value) => updateParam(setParams, field, value)}
              />
            )}

            {params.service === 'hotel' && (
              <HotelSearchForm
                params={params}
                onUpdateParam={(field, value) => updateParam(setParams, field, value)}
              />
            )}

            {params.service === 'train' && (
              <TrainSearchForm
                params={params}
                onUpdateParam={(field, value) => updateParam(setParams, field, value)}
              />
            )}

            {params.service === 'bus' && (
              <BusSearchForm
                params={params}
                onUpdateParam={(field, value) => updateParam(setParams, field, value)}
              />
            )}

            {params.service === 'cab' && (
              <CabSearchForm
                params={params}
                onUpdateParam={(field, value) => updateParam(setParams, field, value)}
              />
            )}

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
          <BookingResults loading={loading} results={results} />
        </div>
      </div>
    </div>
  );
}
