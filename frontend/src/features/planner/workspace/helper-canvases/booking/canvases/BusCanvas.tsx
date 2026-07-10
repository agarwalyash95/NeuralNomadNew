'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import { Bus, Search } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import BusSearchForm from '../forms/BusSearchForm';
import { searchService } from '@/services/search.service';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';
import ReplaceConfirmBar from '../../shared/ReplaceConfirmBar';
import { ItineraryItem, CostProvenance } from '../../../plan-canvas/types';
import { ProvenanceBadge } from '../../../../components/ProvenanceBadge';
import CurrentlyBookedCard from '../../shared/CurrentlyBookedCard';

interface BusCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const QUICK_FILTER_TAGS = ['AC Sleeper', 'Volvo', 'Lowest Price', 'Fastest', 'Ladies Special'];

/** Search results are real inventory, but not yet price-locked — 'estimated'
 *  until the traveler explicitly verifies via Verify Live Price on the block. */
const RESULT_PROVENANCE: CostProvenance = { tier: 'estimated', source: 'Live search', basis: 'Not yet price-verified' };

function buildInitialParams(ctx: TripContext): BookingSearchParams {
  let origin = 'Delhi';
  let destination = ctx.destination || 'Manali';

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
    service: 'bus',
    tripType: 'one-way',
    origin: origin,
    destination: destination,
    departureDate: ctx.activeNodeDateStr || ctx.startDate || '',
    returnDate: '',
    travellers: String(ctx.travellers || 1),
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

function updateParam(setParams: React.Dispatch<React.SetStateAction<BookingSearchParams>>, field: keyof BookingSearchParams, value: string) {
  setParams(current => ({ ...current, [field]: value }));
}

export default function BusCanvas({ onClose, tripContext, onAddToPlan }: BusCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(() => buildInitialParams(tripContext));
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['AC Sleeper']);
  const [pendingItem, setPendingItem] = useState<any | null>(null);

  useEffect(() => { setParams(buildInitialParams(tripContext)); }, [tripContext.tripId]);

  const fetchBuses = async (searchParams: BookingSearchParams) => {
    setLoading(true);
    try {
      const apiResults = await searchService.search(searchParams);
      const mapped = apiResults.map((bus) => {
        const seat = bus.meta?.seats?.[0];
        const price = bus.providers?.[0]?.price || seat?.price || 1200;
        return {
          id: bus.id,
          operator: bus.title,
          busType: bus.meta?.bus_type || 'AC Sleeper',
          departure: { time: bus.departure_time || '18:00', location: bus.origin_city || searchParams.origin || 'Origin' },
          arrival: { time: bus.arrival_time || '08:30+1', location: bus.destination_city || searchParams.destination || tripContext.destination },
          duration: bus.duration || '14h 30m',
          price,
          seats: seat?.seats_available ? `${seat.seats_available} seats left` : 'Available',
          amenities: ['Charging Point', 'Blanket'],
        };
      });
      setResults(mapped);
    } catch (err) {
      console.error('Error fetching buses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBuses(params); }, []);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSearchExpanded(false);
    await fetchBuses(params);
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `bus-${pendingItem.id}-${Date.now()}`,
      type: 'bus',
      startTime: pendingItem.departure.time,
      endTime: pendingItem.arrival.time,
      title: `${pendingItem.operator}`,
      subtitle: `${pendingItem.departure.location} to ${pendingItem.arrival.location} • ${pendingItem.busType}`,
      price: `₹${pendingItem.price.toLocaleString()}`,
      status: 'Pending',
      details: `${pendingItem.duration} • ${pendingItem.seats}`,
      cost: { amount: pendingItem.price, currency: 'INR', provenance: RESULT_PROVENANCE },
    };
    onAddToPlan(newItem);
    setPendingItem(null);
  };

  // 'Lowest Price'/'Fastest' are sort toggles, not predicates. Everything else filters.
  const filteredResults = results
    .filter((bus: any) => {
      if (selectedTags.length === 0) return true;
      return selectedTags.every(tag => {
        if (tag === 'AC Sleeper') return (bus.busType || '').toLowerCase().includes('ac');
        if (tag === 'Volvo') return (bus.operator || '').toLowerCase().includes('volvo') || (bus.busType || '').toLowerCase().includes('volvo');
        if (tag === 'Ladies Special') return (bus.operator || '').toLowerCase().includes('ladies');
        return true;
      });
    })
    .sort((a: any, b: any) => {
      if (selectedTags.includes('Lowest Price')) return a.price - b.price;
      if (selectedTags.includes('Fastest')) return parseInt(a.duration) - parseInt(b.duration);
      return 0;
    });

  const searchSummary = `${params.origin} → ${params.destination}`;
  const searchSecondary = [params.departureDate, `${params.travellers} passenger(s)`].filter(Boolean).join(' • ');

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader icon={<Bus size={18} />} iconColor="bg-sky-600" label="Buses" title={searchSummary} tripContext={tripContext} onClose={onClose} />
      <CurrentlyBookedCard tripContext={tripContext} nodeType="bus" />
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary={searchSecondary} accentColor="group-hover:text-sky-600" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar tags={QUICK_FILTER_TAGS} selected={selectedTags}
              activeColor="border-sky-600 bg-sky-600 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} />
          </SearchSummaryBar>
        )}
        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Edit Search</h3>
                <button type="button" onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
              <BusSearchForm params={params} onUpdateParam={(field, value) => updateParam(setParams, field, value)} />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-semibold text-white transition-all hover:bg-sky-700 disabled:opacity-50">
                {loading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Searching...</> : <><Search size={16} />Search Buses</>}
              </button>
            </form>
          </div>
        )}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-sky-600" />
              <p className="text-sm font-semibold text-slate-600">Searching buses...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{filteredResults.length} buses found</p>
              {filteredResults.map((bus) => (
                <div key={bus.id} className={`rounded-xl border bg-white p-4 transition-all hover:shadow-md ${pendingItem?.id === bus.id ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200 hover:border-sky-300'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{bus.operator}</p>
                      <p className="text-xs text-slate-500">{bus.busType}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="font-bold text-slate-900">{bus.departure.time}</span>
                        <span className="text-slate-400">→</span>
                        <span className="font-bold text-slate-900">{bus.arrival.time}</span>
                        <span className="text-slate-500">• {bus.duration}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{bus.seats}</p>
                    </div>
                    <div className="ml-4 text-right shrink-0">
                      <p className="text-xl font-bold text-slate-900">₹{bus.price.toLocaleString()}</p>
                      <div className="mb-1 flex justify-end"><ProvenanceBadge provenance={RESULT_PROVENANCE} /></div>
                      <button onClick={() => setPendingItem(bus)}
                        className={`mt-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${pendingItem?.id === bus.id ? 'bg-sky-700 text-white' : 'bg-sky-600 text-white hover:bg-sky-700'}`}>
                        {pendingItem?.id === bus.id ? '✓ Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200"><Bus size={24} className="text-slate-400" /></div>
              <p className="text-sm font-semibold text-slate-600">No buses found</p>
            </div>
          )}
        </div>
      </div>
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar newItemTitle={pendingItem.operator} newItemPrice={`₹${pendingItem.price.toLocaleString()}`}
          tripContext={tripContext} confirmColor="bg-sky-600 hover:bg-sky-700"
          onCancel={() => setPendingItem(null)} onConfirm={handleConfirmReplace} />
      )}
    </div>
  );
}
