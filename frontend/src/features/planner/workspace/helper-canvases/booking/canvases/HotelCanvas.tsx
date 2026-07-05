'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import { BedDouble, Search, Star } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import HotelSearchForm from '../forms/HotelSearchForm';
import { searchService } from '@/services/search.service';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';
import ReplaceConfirmBar from '../../shared/ReplaceConfirmBar';
import { ItineraryItem } from '../../../plan-canvas/mockData';

interface HotelCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const QUICK_FILTER_TAGS = ['Free WiFi', '4+ Stars', 'Pool', 'Breakfast Incl.', 'Free Cancellation'];

function buildInitialParams(ctx: TripContext): BookingSearchParams {
  return {
    service: 'hotel',
    tripType: 'one-way',
    origin: '',
    destination: '',
    departureDate: '',
    returnDate: '',
    travellers: String(ctx.travellers || 2),
    cabinClass: 'Economy',
    fareType: 'Regular',
    city: ctx.activeNodeCityName || ctx.destination || 'Manali',
    checkIn: ctx.activeNodeDateStr || ctx.startDate || '',
    checkOut: ctx.endDate || '',
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

export default function HotelCanvas({ onClose, tripContext, onAddToPlan }: HotelCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(() => buildInitialParams(tripContext));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Free WiFi']);
  const [pendingItem, setPendingItem] = useState<any | null>(null);

  useEffect(() => {
    setParams(buildInitialParams(tripContext));
  }, [tripContext.tripId]);

  const fetchHotels = async (searchParams: BookingSearchParams) => {
    setLoading(true);
    try {
      const apiResults = await searchService.search(searchParams);
      const mapped = apiResults.map((hotel) => {
        const firstRoom = hotel.meta?.rooms?.[0];
        const price = hotel.providers?.[0]?.price || firstRoom?.price_per_night || 3500;
        const amenities = hotel.meta?.amenities || ['WiFi'];
        return {
          id: hotel.id,
          name: hotel.title,
          rating: hotel.meta?.star_rating || 4.0,
          location: hotel.meta?.address || hotel.destination_city,
          price,
          originalPrice: Math.round(price * 1.15),
          amenities,
          roomType: firstRoom?.type || 'Deluxe Room',
          cancellation: 'Free cancellation',
          breakfast: amenities.includes('Restaurant') ? 'Breakfast available' : 'Room only',
        };
      });
      setResults(mapped);
    } catch (err) {
      console.error('Error fetching hotels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHotels(params); }, []);

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!params.city.trim()) { setFormError('Enter a city.'); return; }
    setFormError(null);
    setIsSearchExpanded(false);
    await fetchHotels(params);
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const newItem: ItineraryItem = {
      id: `hotel-${pendingItem.id}-${Date.now()}`,
      type: 'hotel',
      startTime: '14:00',
      title: pendingItem.name,
      subtitle: `${pendingItem.location} • ${pendingItem.roomType}`,
      price: `₹${pendingItem.price.toLocaleString()} / night`,
      status: 'Pending',
      details: pendingItem.breakfast,
      rating: pendingItem.rating,
    };
    onAddToPlan(newItem);
    setPendingItem(null);
  };

  const filteredResults = results.filter(h => {
    if (selectedTags.length === 0) return true;
    return selectedTags.every(tag => {
      if (tag === '4+ Stars') return h.rating >= 4;
      if (tag === 'Pool') return h.amenities?.some((a: string) => a.toLowerCase().includes('pool'));
      if (tag === 'Free WiFi') return h.amenities?.some((a: string) => a.toLowerCase().includes('wifi'));
      return true;
    });
  });

  const searchSummary = params.city ? `Hotels in ${params.city}` : 'Search Hotels';
  const searchSecondary = [params.checkIn && `Check-in: ${params.checkIn}`, params.checkOut && `Check-out: ${params.checkOut}`].filter(Boolean).join(' • ');

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader
        icon={<BedDouble size={18} />}
        iconColor="bg-indigo-600"
        label="Hotels"
        title={searchSummary}
        tripContext={tripContext}
        onClose={onClose}
      />

      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary={searchSecondary} accentColor="group-hover:text-indigo-600" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar
              tags={QUICK_FILTER_TAGS}
              selected={selectedTags}
              activeColor="border-indigo-600 bg-indigo-600 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50"
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
              <HotelSearchForm params={params} onUpdateParam={(field, value) => updateParam(setParams, field, value)} />
              {formError && <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-600"><div className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />{formError}</div>}
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-50">
                {loading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Searching...</> : <><Search size={16} />Search Hotels</>}
              </button>
            </form>
          </div>
        )}

        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600" />
              <p className="text-sm font-semibold text-slate-600">Finding hotels...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{filteredResults.length} hotels found</p>
              {filteredResults.map((hotel) => (
                <div key={hotel.id} className={`rounded-xl border bg-white p-4 transition-all hover:shadow-md ${pendingItem?.id === hotel.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-indigo-300'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-slate-900">{hotel.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{hotel.location}</p>
                      <div className="mt-1.5 flex items-center gap-1">
                        {[...Array(5)].map((_, i) => <Star key={i} size={11} fill={i < Math.floor(hotel.rating) ? '#f59e0b' : 'none'} className={i < Math.floor(hotel.rating) ? 'text-amber-400' : 'text-slate-300'} />)}
                        <span className="ml-1 text-[10px] font-semibold text-slate-600">{hotel.rating}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {hotel.amenities?.slice(0, 4).map((a: string) => (
                          <span key={a} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{a}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-slate-900">₹{hotel.price.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 line-through">₹{hotel.originalPrice.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500">per night</p>
                      <button
                        onClick={() => setPendingItem(hotel)}
                        className={`mt-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${pendingItem?.id === hotel.id ? 'bg-indigo-700 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                      >
                        {pendingItem?.id === hotel.id ? '✓ Selected' : 'Select'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200"><BedDouble size={24} className="text-slate-400" /></div>
              <p className="text-sm font-semibold text-slate-600">No hotels found in {params.city}</p>
            </div>
          )}
        </div>
      </div>

      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar
          newItemTitle={pendingItem.name}
          newItemPrice={`₹${pendingItem.price.toLocaleString()} / night`}
          tripContext={tripContext}
          confirmColor="bg-indigo-600 hover:bg-indigo-700"
          onCancel={() => setPendingItem(null)}
          onConfirm={handleConfirmReplace}
        />
      )}
    </div>
  );
}
