'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import { TrainFront, Search } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import TrainSearchForm from '../forms/TrainSearchForm';
import { searchService } from '@/services/search.service';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';
import ReplaceConfirmBar from '../../shared/ReplaceConfirmBar';
import { ItineraryItem } from '../../../plan-canvas/mockData';

interface TrainCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const QUICK_FILTER_TAGS = ['AC Class', 'Sleeper', 'Available', 'Rajdhani', 'Vande Bharat'];

function buildInitialParams(ctx: TripContext): BookingSearchParams {
  let origin = 'New Delhi (NDLS)';
  let destination = 'Chandigarh (CDG)';   // Closest major rail hub near Manali route

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
    service: 'train',
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
    trainClass: '3A',
    quota: 'General',
    cabType: 'airport',
    pickup: '',
    drop: '',
  };
}

function updateParam(setParams: React.Dispatch<React.SetStateAction<BookingSearchParams>>, field: keyof BookingSearchParams, value: string) {
  setParams(current => ({ ...current, [field]: value }));
}

export default function TrainCanvas({ onClose, tripContext, onAddToPlan }: TrainCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(() => buildInitialParams(tripContext));
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['AC Class', 'Available']);
  const [pendingItem, setPendingItem] = useState<any | null>(null);

  useEffect(() => { setParams(buildInitialParams(tripContext)); }, [tripContext.tripId]);

  const fetchTrains = async (searchParams: BookingSearchParams) => {
    setLoading(true);
    try {
      const apiResults = await searchService.search(searchParams);
      const mapped = apiResults.map((train: any) => {
        const classes = train.meta?.classes || [];
        const baseClass: any = classes[0] || {};
        const price = baseClass.price || 1500;
        return {
          id: train.id,
          trainNumber: train.code,
          name: train.title,
          departure: { time: train.departure_time || '16:55', station: train.origin_code || 'NDLS', city: train.origin_city || searchParams.origin || 'Origin' },
          arrival: { time: train.arrival_time || '08:35+1', station: train.destination_code || 'CDG', city: train.destination_city || searchParams.destination || 'Destination' },
          duration: train.duration || '5h 30m',
          classes,
          price,
          availability: baseClass.availability || 'Available',
        };
      });
      setResults(mapped);
    } catch (err) {
      console.error('Error fetching trains:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrains(params); }, []);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSearchExpanded(false);
    await fetchTrains(params);
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `train-${pendingItem.id}-${Date.now()}`,
      type: 'train',
      startTime: pendingItem.departure.time,
      endTime: pendingItem.arrival.time,
      title: `${pendingItem.name} (${pendingItem.trainNumber})`,
      subtitle: `${pendingItem.departure.city} to ${pendingItem.arrival.city}`,
      price: `₹${pendingItem.price.toLocaleString()}`,
      status: 'Pending',
      details: `${pendingItem.duration} • ${pendingItem.availability}`,
    };
    onAddToPlan(newItem);
    setPendingItem(null);
  };

  const searchSummary = `${params.origin} → ${params.destination}`;

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader icon={<TrainFront size={18} />} iconColor="bg-blue-700" label="Trains" title={searchSummary} tripContext={tripContext} onClose={onClose} />
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary={[params.departureDate, `${params.travellers} passenger(s)`, params.trainClass].filter(Boolean).join(' • ')}
            accentColor="group-hover:text-blue-700" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar tags={QUICK_FILTER_TAGS} selected={selectedTags}
              activeColor="border-blue-700 bg-blue-700 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} />
          </SearchSummaryBar>
        )}
        {isSearchExpanded && (
          <div className="border-b border-slate-200 bg-white p-4">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Edit Search</h3>
                <button type="button" onClick={() => setIsSearchExpanded(false)} className="text-xs font-semibold text-slate-500">Cancel</button>
              </div>
              <TrainSearchForm params={params} onUpdateParam={(field, value) => updateParam(setParams, field, value)} />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
                {loading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Searching...</> : <><Search size={16} />Search Trains</>}
              </button>
            </form>
          </div>
        )}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-blue-700" />
              <p className="text-sm font-semibold text-slate-600">Searching trains...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{results.length} trains found</p>
              {results.map((train) => (
                <div key={train.id} className={`rounded-xl border bg-white p-4 transition-all hover:shadow-md ${pendingItem?.id === train.id ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-300'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{train.name}</p>
                      <p className="text-xs text-slate-500">#{train.trainNumber}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <div><p className="font-bold text-slate-900">{train.departure.time}</p><p className="text-slate-500">{train.departure.station}</p></div>
                        <div className="flex-1 text-center"><p className="text-slate-400">{train.duration}</p><div className="my-1 h-px w-full bg-slate-200" /></div>
                        <div className="text-right"><p className="font-bold text-slate-900">{train.arrival.time}</p><p className="text-slate-500">{train.arrival.station}</p></div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {train.classes?.slice(0, 3).map((cls: any, cIdx: number) => (
                          <span key={`${cls.class || 'cls'}-${cIdx}`} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{cls.class} ₹{cls.price}</span>
                        ))}
                      </div>

                    </div>
                    <div className="ml-4 text-right shrink-0">
                      <p className="text-xl font-bold text-slate-900">₹{train.price.toLocaleString()}</p>
                      <p className="text-xs text-green-600 font-semibold">{train.availability}</p>
                      <button onClick={() => setPendingItem(train)}
                        className={`mt-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${pendingItem?.id === train.id ? 'bg-blue-800 text-white' : 'bg-blue-700 text-white hover:bg-blue-800'}`}>
                        {pendingItem?.id === train.id ? '✓ Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200"><TrainFront size={24} className="text-slate-400" /></div>
              <p className="text-sm font-semibold text-slate-600">No trains found</p>
            </div>
          )}
        </div>
      </div>
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar newItemTitle={pendingItem.name} newItemPrice={`₹${pendingItem.price.toLocaleString()}`}
          tripContext={tripContext} confirmColor="bg-blue-700 hover:bg-blue-800"
          onCancel={() => setPendingItem(null)} onConfirm={handleConfirmReplace} />
      )}
    </div>
  );
}
