'use client';

import React, { FormEvent, useState } from 'react';
import { Plane, Search, X, ArrowRight, Edit2, Check } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import FlightSearchForm from '../FlightSearchForm';
import { mockFlightResults } from './mockFlightData';

const initialParams: BookingSearchParams = {
  service: 'flight',
  tripType: 'one-way',
  origin: 'Delhi (DEL)',
  destination: 'Mumbai (BOM)',
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

interface FlightCanvasProps {
  onClose?: () => void;
}

export default function FlightCanvas({ onClose }: FlightCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(initialParams);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(mockFlightResults);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Cheapest', 'Morning']);

  const validateParams = (): string | null => {
    if (!params.origin.trim() && !params.destination.trim()) {
      return 'Enter origin or destination.';
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
    setLoading(true);
    // Simulate search
    setTimeout(() => {
      setLoading(false);
      setIsSearchExpanded(false);
      setResults(mockFlightResults);
    }, 800);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const recommendedTags = [
    'Cheapest',
    'Fastest',
    'Morning',
    'Evening',
    'Non-stop',
    'IndiGo',
    'Vistara'
  ];

  const getSearchSummary = () => {
    if (params.origin && params.destination) {
      return `${params.origin} → ${params.destination}`;
    }
    return 'Search flights';
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Plane size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Flights</p>
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
        {/* Search Bar Summary - Always Visible */}
        {!isSearchExpanded && (
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <button
              onClick={() => setIsSearchExpanded(true)}
              className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-blue-300 hover:shadow-md"
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
                    <span>{params.travellers} traveller(s)</span>
                    <span>•</span>
                    <span>{params.cabinClass}</span>
                  </div>
                </div>
                <Edit2 size={16} className="text-slate-400 group-hover:text-blue-600" />
              </div>
            </button>

            {/* Recommended Tags */}
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick Filters</p>
              <div className="flex flex-wrap gap-2">
                {recommendedTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50'
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

              <FlightSearchForm
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
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
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-blue-600" />
              <p className="text-sm font-semibold text-slate-600">Searching flights...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">{results.length} flights found</p>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Price
                  </button>
                  <button className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50">
                    Duration
                  </button>
                </div>
              </div>

              {/* Flight Cards */}
              {results.map((flight) => (
                <div
                  key={flight.id}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-lg">{flight.logo}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{flight.airline}</p>
                          <p className="text-xs text-slate-500">{flight.flightNumber}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-lg font-bold text-slate-900">{flight.departure.time}</p>
                          <p className="text-xs text-slate-500">{flight.departure.airport}</p>
                        </div>
                        <div className="flex flex-1 flex-col items-center">
                          <p className="text-[10px] font-semibold text-slate-400">{flight.duration}</p>
                          <div className="my-1 h-px w-full bg-slate-300" />
                          <p className="text-[10px] text-slate-400">{flight.stops}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-slate-900">{flight.arrival.time}</p>
                          <p className="text-xs text-slate-500">{flight.arrival.airport}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                        <span>{flight.baggage}</span>
                        <span>•</span>
                        <span>{flight.seats}</span>
                        {flight.amenities.map((amenity) => (
                          <React.Fragment key={amenity}>
                            <span>•</span>
                            <span>{amenity}</span>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    <div className="ml-4 text-right">
                      <p className="text-xl font-bold text-slate-900">₹{flight.price.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">per person</p>
                      <button className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700">
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
                <Plane size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No flights found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
