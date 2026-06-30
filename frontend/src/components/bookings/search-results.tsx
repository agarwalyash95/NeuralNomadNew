'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Clock, MapPin, Plane, Train, BedDouble, Bus, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBookingSelectionStore } from '@/store/booking-selection.store';
import { TravelSearchResult, FlightMeta, TrainMeta, HotelMeta, CabMeta } from '@/types/search';

interface Props {
  results: TravelSearchResult[];
}

const serviceIcons = {
  flight: Plane,
  train: Train,
  hotel: BedDouble,
  bus: Bus,
  cab: Car,
} as const;

function formatRupees(value: number) {
  return `Rs ${value.toLocaleString('en-IN')}`;
}

export default function SearchResults({ results }: Props) {
  const router = useRouter();
  const setSelected = useBookingSelectionStore((state) => state.setSelected);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-[#d7d0c3] bg-white/70 p-12 text-center">
        <p className="text-lg font-bold text-slate-700">No results found for your search.</p>
        <p className="mt-2 text-sm text-slate-500">Try adjusting your dates, route, or filters.</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const handleBook = (result: TravelSearchResult, selection?: unknown) => {
    void selection;
    setSelected(result);
    router.push('/book-now');
  };

  return (
    <div className="space-y-4">
      {results.map((result) => {
        const isExpanded = expandedId === result.id;
        const isTrain = result.service_type === 'train';
        const ServiceIcon = serviceIcons[result.service_type];

        let lowestPrice = 0;
        if (isTrain) {
          const trainMeta = result.meta as TrainMeta;
          lowestPrice = Math.min(...(trainMeta.classes?.map((item) => item.price) || [0]));
        } else if (result.providers && result.providers.length > 0) {
          lowestPrice = Math.min(...result.providers.map((provider) => provider.price));
        } else if (result.service_type === 'hotel') {
          const hotelMeta = result.meta as HotelMeta;
          lowestPrice = Math.min(...(hotelMeta.rooms?.map((room) => room.price_per_night) || [0]));
        } else if (result.service_type === 'cab') {
          const cabMeta = result.meta as CabMeta;
          lowestPrice = Math.min(...(cabMeta.cab_types?.map((cab) => cab.price_per_km) || [0]));
        } else {
          const flightMeta = result.meta as FlightMeta;
          lowestPrice = Math.min(...(flightMeta.cabin_classes?.map((item) => item.price) || [0]));
        }

        return (
          <div
            key={result.id}
            className="overflow-hidden rounded-[1.75rem] border border-[#e5ded2] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.07)] transition-all hover:shadow-[0_20px_50px_rgba(15,23,42,0.1)]"
          >
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex-1">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                      <ServiceIcon size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{result.title}</h3>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{result.code}</p>
                    </div>
                  </div>

                  {result.service_type === 'hotel' ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <MapPin size={16} className="text-slate-400" />
                      <span>
                        {result.destination_city} • {(result.meta as HotelMeta).address}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 sm:gap-5">
                      <div>
                        <p className="text-2xl font-bold text-slate-900">{result.departure_time}</p>
                        <p className="mt-1 text-sm font-medium text-slate-500">{result.origin_city}</p>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col items-center px-2">
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          <Clock size={12} />
                          {result.duration}
                        </p>
                        <div className="relative w-full">
                          <div className="h-px w-full bg-[#d8d2c6]" />
                          <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-slate-400" />
                        </div>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                          {result.stops === 0 ? 'Non-stop' : `${result.stops} stop${result.stops > 1 ? 's' : ''}`}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900">{result.arrival_time}</p>
                        <p className="mt-1 text-sm font-medium text-slate-500">{result.destination_city}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4 border-t border-[#ece6db] pt-5 lg:min-w-[220px] lg:items-end lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  <div className="lg:text-right">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">Starting from</p>
                    <p className="mt-1 text-3xl font-bold text-emerald-600">
                      {formatRupees(lowestPrice)}
                      {result.service_type === 'cab' ? <span className="ml-1 text-sm font-medium text-slate-500">/km</span> : null}
                    </p>
                  </div>

                  <Button
                    onClick={() => toggleExpand(result.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 font-semibold text-white hover:bg-slate-800 lg:w-[180px]"
                  >
                    {isTrain ? 'Check classes' : 'Compare prices'}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </Button>
                </div>
              </div>
            </div>

            {isExpanded ? (
              <div className="border-t border-[#ece6db] bg-[#faf8f3] p-5 sm:p-6">
                {isTrain ? (
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                      <Train size={14} className="text-blue-600" />
                      Class availability
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {(result.meta as TrainMeta).classes?.map((trainClass, idx) => {
                        const isAvailable = trainClass.availability.startsWith('AVAILABLE');
                        return (
                          <div key={idx} className="rounded-2xl border border-[#e4ddd1] bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-start justify-between gap-4">
                              <div>
                                <p className="text-base font-bold text-slate-900">{trainClass.class}</p>
                                <p className="text-xs font-medium text-slate-500">{trainClass.label}</p>
                              </div>
                              <p className="text-lg font-bold text-slate-900">{formatRupees(trainClass.price)}</p>
                            </div>

                            <div
                              className={`mb-4 inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold ${
                                isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {trainClass.availability}
                            </div>

                            <Button
                              onClick={() => handleBook(result, trainClass)}
                              variant={isAvailable ? 'default' : 'outline'}
                              className="w-full rounded-xl font-semibold"
                            >
                              Book now
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Provider comparison</h4>

                    {[...(result.providers || [])]
                      .sort((a, b) => a.price - b.price)
                      .map((provider, idx) => {
                        const isCheapest = idx === 0;
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                              isCheapest
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-[#e4ddd1] bg-white'
                            }`}
                          >
                            <div>
                              <p className="flex items-center gap-2 text-base font-bold text-slate-900">
                                {provider.provider}
                                {isCheapest ? (
                                  <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-800">
                                    Lowest
                                  </span>
                                ) : null}
                              </p>
                              {result.service_type === 'flight' ? (
                                <p className="mt-1 text-xs font-medium text-slate-500">
                                  Included: {(result.meta as FlightMeta).baggage} baggage • {(result.meta as FlightMeta).meal} meal
                                </p>
                              ) : null}
                            </div>

                            <div className="flex items-center justify-between gap-5 sm:justify-end">
                              <p className="text-2xl font-bold text-slate-900">
                                {formatRupees(provider.price)}
                                {result.service_type === 'cab' ? <span className="ml-1 text-sm font-medium text-slate-500">/km</span> : null}
                              </p>
                              <Button
                                onClick={() => handleBook(result, provider)}
                                className={`rounded-xl px-6 font-semibold ${
                                  isCheapest ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                              >
                                Book now
                              </Button>
                            </div>
                          </div>
                        );
                      })}

                    {(!result.providers || result.providers.length === 0) ? (
                      <p className="text-sm font-medium italic text-slate-500">No price comparisons available.</p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
