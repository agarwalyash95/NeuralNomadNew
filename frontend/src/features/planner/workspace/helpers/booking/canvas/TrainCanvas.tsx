'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import { TrainFront, Search, X, ArrowRight, Edit2, Check } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import TrainSearchForm from '../TrainSearchForm';
import { searchService } from '@/services/search.service';

const initialParams: BookingSearchParams = {
  service: 'train',
  tripType: 'one-way',
  origin: 'New Delhi (NDLS)',
  destination: 'Mumbai Central (MMCT)',
  departureDate: '2024-03-15',
  returnDate: '',
  travellers: '2',
  cabinClass: 'Economy',
  fareType: 'Regular',
  city: '',
  checkIn: '',
  checkOut: '',
  roomCount: '1',
  nationality: 'Indian',
  trainClass: '3A',
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

interface TrainCanvasProps {
  onClose?: () => void;
}

export default function TrainCanvas({ onClose }: TrainCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(initialParams);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['AC Class', 'Available']);

  const fetchTrains = async (searchParams: BookingSearchParams) => {
    setLoading(true);
    try {
      const apiResults = await searchService.search(searchParams);
      const mapped = apiResults.map((train) => {
        const classes = train.meta?.classes?.map((c) => ({
          name: c.class || c.label,
          seats: c.availability || 'Available',
          price: c.price,
        })) || [];

        const getDisplayTime = (isoStr: string) => {
          if (!isoStr) return '12:00';
          if (isoStr.includes('T')) return isoStr.split('T')[1]?.slice(0, 5) ?? '20:00';
          return isoStr.slice(0, 5);
        };

        return {
          id: train.id,
          name: train.title,
          trainNumber: train.code,
          days: train.days_of_week?.join(', ') || 'Daily',
          rating: 4.3,
          departure: {
            time: getDisplayTime(train.departure_time),
            station: train.origin_code || 'NDLS',
          },
          arrival: {
            time: getDisplayTime(train.arrival_time),
            station: train.destination_code || 'MMCT',
          },
          duration: train.duration || '16h 00m',
          classes: classes,
        };
      });
      setResults(mapped);
    } catch (err) {
      console.error('Error fetching trains:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrains(params);
  }, []);

  const validateParams = (): string | null => {
    if (!params.origin.trim() && !params.destination.trim()) {
      return 'Enter origin or destination station.';
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
    await fetchTrains(params);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const recommendedTags = [
    'AC Class',
    'Available',
    'Morning',
    'Evening',
    'Rajdhani',
    'Express',
    'Tatkal'
  ];

  const getSearchSummary = () => {
    if (params.origin && params.destination) {
      return `${params.origin} → ${params.destination}`;
    }
    return 'Search trains';
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <TrainFront size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trains</p>
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
              className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-emerald-300 hover:shadow-md"
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
                    <span>{params.trainClass} Class</span>
                    <span>•</span>
                    <span>{params.quota} Quota</span>
                  </div>
                </div>
                <Edit2 size={16} className="text-slate-400 group-hover:text-emerald-600" />
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
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50'
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

              <TrainSearchForm
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
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
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-emerald-600" />
              <p className="text-sm font-semibold text-slate-600">Checking availability...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">{results.length} trains found</p>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Departure
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Duration
                  </button>
                </div>
              </div>

              {/* Train Cards */}
              {results.map((train) => (
                <div
                  key={train.id}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{train.name}</p>
                      <p className="text-xs text-slate-500">#{train.trainNumber} • {train.days}</p>
                    </div>
                    <div className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {train.rating} ★
                    </div>
                  </div>

                  <div className="mb-3 flex items-center gap-3">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{train.departure.time}</p>
                      <p className="text-xs text-slate-500">{train.departure.station}</p>
                    </div>
                    <div className="flex flex-1 flex-col items-center">
                      <p className="text-[10px] font-semibold text-slate-400">{train.duration}</p>
                      <div className="my-1 h-px w-full bg-slate-300" />
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">{train.arrival.time}</p>
                      <p className="text-xs text-slate-500">{train.arrival.station}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {train.classes?.map((cls: any) => (
                      <div
                        key={cls.name}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="mr-4">
                          <p className="text-xs font-semibold text-slate-900">{cls.name}</p>
                          <p className="text-[10px] text-slate-500">{cls.seats}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900">₹{cls.price}</p>
                          <button className="mt-1 rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700">
                            Book
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <TrainFront size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No trains found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
