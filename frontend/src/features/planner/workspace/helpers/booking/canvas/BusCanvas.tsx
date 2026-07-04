'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import { BusFront, Search, X, ArrowRight, Edit2, Check } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import BusSearchForm from '../BusSearchForm';
import { searchService } from '@/services/search.service';

const initialParams: BookingSearchParams = {
  service: 'bus',
  tripType: 'one-way',
  origin: 'Delhi (Kashmiri Gate)',
  destination: 'Mumbai (Dadar TT)',
  departureDate: '2024-03-15',
  returnDate: '',
  travellers: '2',
  cabinClass: 'Economy',
  fareType: 'AC Sleeper',
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

interface BusCanvasProps {
  onClose?: () => void;
}

export default function BusCanvas({ onClose }: BusCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(initialParams);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['AC Sleeper', 'WiFi']);

  const fetchBuses = async (searchParams: BookingSearchParams) => {
    setLoading(true);
    try {
      const apiResults = await searchService.search(searchParams);
      const mapped = apiResults.map((bus) => {
        const price = bus.providers?.[0]?.price || bus.meta?.seats?.[0]?.price || 850;
        const seats = bus.meta?.seats?.[0]?.seats_available ? `${bus.meta.seats[0].seats_available} seats left` : '15 seats left';

        const getDisplayTime = (isoStr: string) => {
          if (!isoStr) return '20:00';
          if (isoStr.includes('T')) return isoStr.split('T')[1]?.slice(0, 5) ?? '20:00';
          return isoStr.slice(0, 5);
        };

        return {
          id: bus.id,
          operator: bus.title,
          busType: bus.meta?.bus_type || 'AC Sleeper',
          rating: 4.1,
          departure: {
            time: getDisplayTime(bus.departure_time),
            location: bus.origin_code || 'DEL',
          },
          arrival: {
            time: getDisplayTime(bus.arrival_time),
            location: bus.destination_code || 'BOM',
          },
          duration: bus.duration || '12h 00m',
          amenities: ['WiFi', 'Water Bottle', 'Charging Point'],
          seats: seats,
          price: price,
        };
      });
      setResults(mapped);
    } catch (err) {
      console.error('Error fetching buses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuses(params);
  }, []);

  const validateParams = (): string | null => {
    if (!params.origin.trim() && !params.destination.trim()) {
      return 'Enter origin or destination city.';
    }
    return null;
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateParams();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setIsSearchExpanded(false);
    await fetchBuses(params);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const recommendedTags = [
    'AC Sleeper',
    'WiFi',
    'Evening',
    'Volvo',
    'Top Rated',
    'Seater',
    'Semi-Sleeper'
  ];

  const getSearchSummary = () => {
    if (params.origin && params.destination) {
      return `${params.origin} → ${params.destination}`;
    }
    return 'Search buses';
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 text-white">
              <BusFront size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Buses</p>
              <h2 className="text-sm font-semibold text-slate-900">{getSearchSummary()}</h2>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {/* Search Bar Summary */}
        {!isSearchExpanded && (
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-orange-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{params.origin}</span>
                    <ArrowRight size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900">{params.destination}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span>{params.departureDate}</span>
                    <span>•</span>
                    <span>{params.fareType}</span>
                    <span>•</span>
                    <span>{params.travellers} passenger(s)</span>
                  </div>
                </div>
                <Edit2 size={16} className="text-slate-400 group-hover:text-orange-600" />
              </div>
            </button>

            {/* Tags */}
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick Filters</p>
              <div className="flex flex-wrap gap-2">
                {recommendedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'border-orange-600 bg-orange-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    {selectedTags.includes(tag) && <Check size={12} className="mr-1 inline" />}
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expanded Search Form */}
        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Edit Search</h3>
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <BusSearchForm
                params={params}
                onUpdateParam={(field, value) => updateParam(setParams, field, value)}
              />

              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-600">
                  <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search size={16} />
                    Update Search
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Results Section */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-orange-600" />
              <p className="text-sm font-semibold text-slate-600">Finding buses...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">{results.length} buses found</p>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Price
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Rating
                  </button>
                </div>
              </div>

              {/* Bus Cards */}
              {results.map((bus) => (
                <div
                  key={bus.id}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-orange-300 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{bus.operator}</p>
                      <p className="text-xs text-slate-500">{bus.busType}</p>
                    </div>
                    <div className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
                      {bus.rating} ★
                    </div>
                  </div>

                  <div className="mb-3 flex items-center gap-3">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{bus.departure.time}</p>
                      <p className="text-xs text-slate-500">{bus.departure.location}</p>
                    </div>
                    <div className="flex flex-1 flex-col items-center">
                      <p className="text-[10px] font-semibold text-slate-400">{bus.duration}</p>
                      <div className="my-1 h-px w-full bg-slate-300" />
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">{bus.arrival.time}</p>
                      <p className="text-xs text-slate-500">{bus.arrival.location}</p>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {bus.amenities?.map((amenity: string) => (
                      <span key={amenity} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                        {amenity}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-green-600">{bus.seats}</p>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-900">₹{bus.price.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">per person</p>
                      </div>
                      <button className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700">
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <BusFront size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No buses found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
