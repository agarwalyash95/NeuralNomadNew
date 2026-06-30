'use client';

import React, { FormEvent, useState } from 'react';
import { BedDouble, Search, X, ArrowRight, Edit2, Check, Star } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import HotelSearchForm from '../HotelSearchForm';
import { mockHotelResults } from './mockHotelData';

const initialParams: BookingSearchParams = {
  service: 'hotel',
  tripType: 'one-way',
  origin: '',
  destination: '',
  departureDate: '',
  returnDate: '',
  travellers: '2',
  cabinClass: 'Economy',
  fareType: 'Regular',
  city: 'Mumbai',
  checkIn: '2024-03-15',
  checkOut: '2024-03-17',
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

interface HotelCanvasProps {
  onClose?: () => void;
}

export default function HotelCanvas({ onClose }: HotelCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(initialParams);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(mockHotelResults);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Free WiFi', '4+ Stars']);

  const validateParams = (): string | null => {
    if (!params.city.trim()) return 'Enter a destination city.';
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
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setIsSearchExpanded(false);
      setResults(mockHotelResults);
    }, 800);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const recommendedTags = [
    'Free WiFi',
    '4+ Stars',
    'Pool',
    'Breakfast',
    'Free Cancel',
    'Near Beach',
    'City Center'
  ];

  const getSearchSummary = () => {
    if (params.city) {
      return `Hotels in ${params.city}`;
    }
    return 'Search hotels';
  };

  const calculateNights = () => {
    if (params.checkIn && params.checkOut) {
      const checkIn = new Date(params.checkIn);
      const checkOut = new Date(params.checkOut);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      return nights;
    }
    return 0;
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-white">
              <BedDouble size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hotels</p>
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
              className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-purple-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{params.city}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                    <span>{params.checkIn}</span>
                    <ArrowRight size={12} className="text-slate-400" />
                    <span>{params.checkOut}</span>
                    <span>•</span>
                    <span>{calculateNights()} night(s)</span>
                    <span>•</span>
                    <span>{params.roomCount} room, {params.travellers} guest(s)</span>
                  </div>
                </div>
                <Edit2 size={16} className="text-slate-400 group-hover:text-purple-600" />
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
                        ? 'border-purple-600 bg-purple-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-purple-300 hover:bg-purple-50'
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

              <HotelSearchForm
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white transition-all hover:bg-purple-700 disabled:opacity-50"
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
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-purple-600" />
              <p className="text-sm font-semibold text-slate-600">Finding hotels...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">{results.length} hotels found</p>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Price
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Rating
                  </button>
                </div>
              </div>

              {/* Hotel Cards */}
              {results.map((hotel) => (
                <div
                  key={hotel.id}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-purple-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-4xl">
                      {hotel.image}
                    </div>

                    <div className="flex-1">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{hotel.name}</h3>
                          <div className="mt-1 flex items-center gap-1">
                            {[...Array(hotel.stars)].map((_, i) => (
                              <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{hotel.location}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-xs">
                            <span className="font-semibold text-slate-900">{hotel.rating}</span>
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                          </div>
                          <p className="text-[10px] text-slate-500">{hotel.reviews} reviews</p>
                        </div>
                      </div>

                      <div className="mb-2 flex flex-wrap gap-2 text-[10px]">
                        {hotel.amenities.slice(0, 4).map((amenity) => (
                          <span key={amenity} className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                            {amenity}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-xs">
                          <p className="text-slate-500">{hotel.roomType}</p>
                          <p className="text-green-600">{hotel.cancellation}</p>
                        </div>
                        <div className="text-right">
                          {hotel.originalPrice > hotel.price && (
                            <p className="text-xs text-slate-400 line-through">₹{hotel.originalPrice.toLocaleString()}</p>
                          )}
                          <p className="text-lg font-bold text-slate-900">₹{hotel.price.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-500">per night</p>
                          <button className="mt-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-700">
                            Book Now
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <BedDouble size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No hotels found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
