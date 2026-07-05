'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import { Plane, Search } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import FlightSearchForm from '../forms/FlightSearchForm';
import { searchService } from '@/services/search.service';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';
import ReplaceConfirmBar from '../../shared/ReplaceConfirmBar';
import { ItineraryItem } from '../../../plan-canvas/mockData';

interface FlightCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const QUICK_FILTER_TAGS = ['Cheapest', 'Fastest', 'Morning', 'Evening', 'Non-stop'];

function buildInitialParams(ctx: TripContext): BookingSearchParams {
  let origin = 'Delhi (DEL)';
  let destination = ctx.destination ? `${ctx.destination} / Bhuntar (KUU)` : 'Mumbai (BOM)';

  if (ctx.activeNodeCityName && ctx.allCities && ctx.allCities.length > 0) {
    const idx = ctx.allCities.indexOf(ctx.activeNodeCityName);
    if (idx !== -1) {
      origin = ctx.activeNodeCityName;
      if (idx + 1 < ctx.allCities.length) {
        destination = ctx.allCities[idx + 1] || '';
      }
    }
  }

  const textToParse = (ctx.activeNodeSubtitle || ctx.activeNodeTitle || '').toLowerCase();
  if (textToParse.includes(' to ')) {
    const parts = (ctx.activeNodeSubtitle || ctx.activeNodeTitle || '').split(/ to /i);
    if (parts.length >= 2) {
      let possibleOrigin = (parts[0] || '').trim();
      if (possibleOrigin.toLowerCase().includes('from ')) {
        possibleOrigin = (possibleOrigin.split(/from /i).pop() || '').trim();
      }
      if (possibleOrigin) origin = possibleOrigin;
      destination = ((parts[1] || '').split(' • ')[0] || '').trim();
    }
  }

  return {
    service: 'flight',
    tripType: 'one-way',
    origin: origin,
    destination: destination,
    departureDate: ctx.activeNodeDateStr || ctx.startDate || '',
    returnDate: '',
    travellers: String(ctx.travellers || 2),
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
}

function updateParam(
  setParams: React.Dispatch<React.SetStateAction<BookingSearchParams>>,
  field: keyof BookingSearchParams,
  value: string
) {
  setParams(current => ({ ...current, [field]: value }));
}

export default function FlightCanvas({ onClose, tripContext, onAddToPlan }: FlightCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(() => buildInitialParams(tripContext));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Cheapest']);
  const [pendingItem, setPendingItem] = useState<any | null>(null);

  // Re-prefill if trip context changes
  useEffect(() => {
    setParams(buildInitialParams(tripContext));
  }, [tripContext.tripId]);

  const fetchFlights = async (searchParams: BookingSearchParams) => {
    setLoading(true);
    try {
      const apiResults = await searchService.search(searchParams);
      const mapped = apiResults.map((flight) => {
        const cabinClass = flight.meta?.cabin_classes?.[0];
        const price = flight.providers?.[0]?.price || cabinClass?.price || 4850;
        const seats = cabinClass?.seats_available ? `${cabinClass.seats_available} seats left` : '12 seats left';
        const baggage = flight.meta?.baggage || '15 kg';
        const meal = flight.meta?.meal;
        const getTime = (s: string) => !s ? '06:30' : s.includes('T') ? s.split('T')[1]?.slice(0, 5) ?? '08:00' : s.slice(0, 5);
        return {
          id: flight.id,
          airline: flight.title,
          flightNumber: flight.code,
          departure: {
            time: getTime(flight.departure_time),
            airport: flight.origin_code || searchParams.origin || 'DEL',
            city: flight.origin_city || searchParams.origin || 'Origin'
          },
          arrival: {
            time: getTime(flight.arrival_time),
            airport: flight.destination_code || searchParams.destination || 'BOM',
            city: flight.destination_city || searchParams.destination || tripContext.destination || 'Destination'
          },
          duration: flight.duration || '1h 45m',
          stops: flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop(s)`,
          price,
          class: cabinClass?.class || 'Economy',
          seats,
          baggage,
          meal: meal ? ['Meal'] : [],
          amenities: meal ? ['WiFi', 'Meal'] : ['WiFi'],
        };
      });
      setResults(mapped);
    } catch (err: any) {
      console.error('Error fetching flights:', err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFlights(params); }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!params.origin.trim() && !params.destination.trim()) {
      setFormError('Enter origin or destination.');
      return;
    }
    setFormError(null);
    setIsSearchExpanded(false);
    await fetchFlights(params);
  };

  const handleSelect = (flight: any) => {
    setPendingItem(flight);
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `flight-${pendingItem.id}-${Date.now()}`,
      type: 'flight',
      startTime: pendingItem.departure.time,
      endTime: pendingItem.arrival.time,
      title: `${pendingItem.airline} ${pendingItem.flightNumber}`,
      subtitle: `${pendingItem.departure.city} to ${pendingItem.arrival.city}`,
      price: `₹${pendingItem.price.toLocaleString()}`,
      status: 'Pending',
      details: `${pendingItem.duration} • ${pendingItem.stops} • ${pendingItem.baggage}`,
    };
    onAddToPlan(newItem);
    setPendingItem(null);
  };

  const filteredResults = results.filter(f => {
    if (selectedTags.length === 0) return true;
    return selectedTags.every(tag => {
      if (tag === 'Non-stop') return f.stops === 'Non-stop';
      if (tag === 'Morning') return parseInt(f.departure.time) < 12;
      if (tag === 'Evening') return parseInt(f.departure.time) >= 17;
      return true;
    });
  });

  const searchSummary = `${params.origin} → ${params.destination}`;
  const searchSecondary = [params.departureDate, `${params.travellers} traveller(s)`, params.cabinClass].filter(Boolean).join(' • ');

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader
        icon={<Plane size={18} />}
        iconColor="bg-blue-600"
        label="Flights"
        title={searchSummary}
        tripContext={tripContext}
        onClose={onClose}
      />

      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar
            primary={searchSummary}
            secondary={searchSecondary}
            accentColor="group-hover:text-blue-600"
            onClick={() => setIsSearchExpanded(true)}
          >
            <QuickFilterBar
              tags={QUICK_FILTER_TAGS}
              selected={selectedTags}
              activeColor="border-blue-600 bg-blue-600 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
            />
          </SearchSummaryBar>
        )}

        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Edit Search</h3>
                <button type="button" onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
              <FlightSearchForm params={params} onUpdateParam={(field, value) => updateParam(setParams, field, value)} />
              {formError && <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-600"><div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />{formError}</div>}
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:opacity-50">
                {loading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Searching...</> : <><Search size={16} />Update Search</>}
              </button>
            </form>
          </div>
        )}

        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-blue-600" />
              <p className="text-sm font-semibold text-slate-600">Searching flights...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{filteredResults.length} flights found</p>
              {filteredResults.map((flight) => (
                <div key={flight.id} className={`group rounded-xl border bg-white p-4 transition-all hover:shadow-md ${pendingItem?.id === flight.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-lg">✈️</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{flight.airline}</p>
                          <p className="text-xs text-slate-500">{flight.flightNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div><p className="text-lg font-bold text-slate-900">{flight.departure.time}</p><p className="text-xs text-slate-500">{flight.departure.airport}</p></div>
                        <div className="flex flex-1 flex-col items-center">
                          <p className="text-[10px] font-semibold text-slate-400">{flight.duration}</p>
                          <div className="my-1 h-px w-full bg-slate-300" />
                          <p className="text-[10px] text-slate-400">{flight.stops}</p>
                        </div>
                        <div className="text-right"><p className="text-lg font-bold text-slate-900">{flight.arrival.time}</p><p className="text-xs text-slate-500">{flight.arrival.airport}</p></div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <span>{flight.baggage}</span><span>•</span><span>{flight.seats}</span>
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-xl font-bold text-slate-900">₹{flight.price.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">per person</p>
                      <button
                        onClick={() => handleSelect(flight)}
                        className={`mt-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${pendingItem?.id === flight.id ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                      >
                        {pendingItem?.id === flight.id ? '✓ Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200"><Plane size={24} className="text-slate-400" /></div>
              <p className="text-sm font-semibold text-slate-600">No flights found</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting your search or check the backend inventory</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Replace Confirmation Bar */}
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar
          newItemTitle={`${pendingItem.airline} ${pendingItem.flightNumber}`}
          newItemPrice={`₹${pendingItem.price.toLocaleString()}`}
          tripContext={tripContext}
          confirmColor="bg-blue-600 hover:bg-blue-700"
          onCancel={() => setPendingItem(null)}
          onConfirm={handleConfirmReplace}
        />
      )}
    </div>
  );
}
