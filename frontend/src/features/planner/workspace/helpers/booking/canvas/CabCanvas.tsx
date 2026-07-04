'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import { Car, Search, X, Edit2, Check } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import CabSearchForm from '../CabSearchForm';
import { searchService } from '@/services/search.service';

const initialParams: BookingSearchParams = {
  service: 'cab',
  tripType: 'one-way',
  origin: '',
  destination: '',
  departureDate: '2024-03-15T10:00',
  returnDate: '',
  travellers: '2',
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
  pickup: 'Delhi Airport T3',
  drop: 'Connaught Place',
};

function updateParam(
  setParams: React.Dispatch<React.SetStateAction<BookingSearchParams>>,
  field: keyof BookingSearchParams,
  value: string
) {
  setParams((current) => ({ ...current, [field]: value }));
}

interface CabCanvasProps {
  onClose?: () => void;
}

export default function CabCanvas({ onClose }: CabCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(initialParams);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Sedan', 'AC']);

  const fetchCabs = async (searchParams: BookingSearchParams) => {
    setLoading(true);
    try {
      const apiResults = await searchService.search(searchParams);
      const mapped = apiResults.map((cab) => {
        const firstCabType = cab.meta?.cab_types?.[0];
        const price = cab.providers?.[0]?.price || firstCabType?.base_fare || 500;
        const capacity = firstCabType?.max_seats ? `Max seats: ${firstCabType.max_seats}` : '4 seats';

        return {
          id: cab.id,
          provider: cab.title,
          carType: firstCabType?.type || 'Sedan',
          model: cab.code,
          rating: 4.5,
          capacity: capacity,
          estimatedTime: cab.duration || '45 mins',
          features: ['AC', 'GPS', 'Luggage Space'],
          price: price,
        };
      });
      setResults(mapped);
    } catch (err) {
      console.error('Error fetching cabs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCabs(params);
  }, []);

  const validateParams = (): string | null => {
    if (!params.pickup.trim()) return 'Enter a pickup location.';
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
    await fetchCabs(params);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const recommendedTags = [
    'Sedan',
    'SUV',
    'AC',
    'GPS',
    'Instant',
    'Top Rated',
    'Sanitized'
  ];

  const getSearchSummary = () => {
    if (params.pickup) {
      return params.drop ? `${params.pickup} → ${params.drop}` : `From ${params.pickup}`;
    }
    return 'Book a cab';
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-600 text-white">
              <Car size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cabs</p>
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
              className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-yellow-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{getSearchSummary()}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span>{params.departureDate}</span>
                    <span>•</span>
                    <span>{params.cabType}</span>
                  </div>
                </div>
                <Edit2 size={16} className="text-slate-400 group-hover:text-yellow-600" />
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
                        ? 'border-yellow-600 bg-yellow-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-yellow-300 hover:bg-yellow-50'
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

              <CabSearchForm
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-600 py-3 text-sm font-semibold text-white transition-all hover:bg-yellow-700 disabled:opacity-50"
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
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-yellow-600" />
              <p className="text-sm font-semibold text-slate-600">Finding cabs...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">{results.length} cabs available</p>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Price
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Time
                  </button>
                </div>
              </div>

              {/* Cab Cards */}
              {results.map((cab) => (
                <div
                  key={cab.id}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-yellow-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{cab.provider} - {cab.carType}</p>
                          <p className="text-xs text-slate-500">{cab.model}</p>
                        </div>
                        <div className="rounded-full bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-700">
                          {cab.rating} ★
                        </div>
                      </div>

                      <div className="mb-2 flex items-center gap-4 text-xs text-slate-600">
                        <span>{cab.capacity}</span>
                        <span>•</span>
                        <span>{cab.estimatedTime}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {cab.features?.map((feature: string) => (
                          <span key={feature} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="ml-4 text-right">
                      <p className="text-xl font-bold text-slate-900">₹{cab.price.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">total</p>
                      <button className="mt-2 rounded-lg bg-yellow-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-yellow-700">
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <Car size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No cabs available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
