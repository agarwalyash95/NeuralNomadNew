'use client';

import React, { FormEvent, useState, useEffect } from 'react';
import { Car, Search } from 'lucide-react';
import { BookingSearchParams } from '@/types/booking';
import CabSearchForm from '../forms/CabSearchForm';
import { searchService } from '@/services/search.service';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';
import ReplaceConfirmBar from '../../shared/ReplaceConfirmBar';
import { ItineraryItem, CostProvenance } from '../../../plan-canvas/types';
import { ProvenanceBadge } from '../../../../components/ProvenanceBadge';
import CurrentlyBookedCard from '../../shared/CurrentlyBookedCard';

interface CabCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
  onAddToPlan?: (item: ItineraryItem) => void;
}

const QUICK_FILTER_TAGS = ['Full Day', 'Half Day', 'SUV', 'Sedan', 'Group (10 Seater)'];

/** Search results come from reference-table inventory, not a live third-party
 *  quote — 'suggested' tier until the traveler explicitly verifies via Verify
 *  Live Price on the block. */
const RESULT_PROVENANCE: CostProvenance = { tier: 'suggested', source: 'Inventory search', basis: 'Not yet price-verified' };

/** ₹/km rate card by vehicle class + base fare — used only when the real
 *  road distance is known, so the fare states its own arithmetic. */
const BASE_FARE = 300;
const ratePerKm = (cabTypeLabel: string): number => {
  const label = (cabTypeLabel || '').toLowerCase();
  if (/suv|innova|ertiga/.test(label)) return 18;
  if (/seater|tempo|traveller/.test(label)) return 26;
  if (/sedan|dzire|etios|amaze/.test(label)) return 14;
  return 16;
};

function buildInitialParams(ctx: TripContext): BookingSearchParams {
  let pickup = ctx.destination || 'Manali';
  let drop = '';

  if (ctx.activeNodeCityName && ctx.allCities && ctx.allCities.length > 0) {
    const idx = ctx.allCities.indexOf(ctx.activeNodeCityName);
    if (idx !== -1) {
      pickup = ctx.activeNodeCityName;
      if (idx + 1 < ctx.allCities.length) {
        drop = ctx.allCities[idx + 1] || '';
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
      if (possibleOrigin) pickup = possibleOrigin;
      drop = ((parts[1] || '').split(' • ')[0] || '').trim();
    }
  }

  return {
    service: 'cab',
    tripType: 'one-way',
    origin: pickup,
    destination: drop,
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
    cabType: 'outstation',
    pickup: pickup,
    drop: drop,
  };
}

function updateParam(setParams: React.Dispatch<React.SetStateAction<BookingSearchParams>>, field: keyof BookingSearchParams, value: string) {
  setParams(current => ({ ...current, [field]: value }));
}

export default function CabCanvas({ onClose, tripContext, onAddToPlan }: CabCanvasProps) {
  const [params, setParams] = useState<BookingSearchParams>(() => buildInitialParams(tripContext));
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Full Day']);
  const [pendingItem, setPendingItem] = useState<any | null>(null);
  /** Real road distance for pickup → drop, from /planner/distances/ (cached server-side) */
  const [routeInfo, setRouteInfo] = useState<{ km: number; mins: number } | null>(null);

  useEffect(() => { setParams(buildInitialParams(tripContext)); }, [tripContext.tripId]);

  useEffect(() => {
    let cancelled = false;
    setRouteInfo(null);
    const pickup = params.pickup?.trim();
    const drop = params.drop?.trim();
    if (!pickup || !drop || pickup.toLowerCase() === drop.toLowerCase()) return;
    import('@/services/distance.service').then(({ distanceService }) =>
      distanceService.getBatchDistances([
        { id: 'cab-route', origin: { name: pickup }, destination: { name: drop } },
      ])
    ).then((res) => {
      const r = res['cab-route'];
      if (!cancelled && r) setRouteInfo({ km: r.distance_km, mins: r.duration_mins });
    }).catch(() => { /* fare falls back to provider price */ });
    return () => { cancelled = true; };
  }, [params.pickup, params.drop]);

  /** Distance-based fare when the route is measured; provider price otherwise.
   *  A missing fare renders as absent, never a fabricated ₹2,800 default. */
  const fareFor = (cab: any): { price: number | null; provenance: CostProvenance; basisLabel: string } => {
    if (routeInfo) {
      const rate = ratePerKm(cab.cabTypes?.[0]?.type || '');
      const price = Math.round(BASE_FARE + routeInfo.km * rate);
      return {
        price,
        provenance: {
          tier: 'estimated',
          source: 'Distance-based estimate',
          basis: `₹${rate}/km × ${routeInfo.km} km road distance + ₹${BASE_FARE} base`,
        },
        basisLabel: `₹${rate}/km × ${routeInfo.km} km`,
      };
    }
    if (cab.price == null) {
      return { price: null, provenance: { tier: 'suggested', source: 'Inventory search', basis: 'No fare on file' }, basisLabel: 'No rate available' };
    }
    return { price: cab.price, provenance: RESULT_PROVENANCE, basisLabel: 'fixed rate' };
  };

  const fetchCabs = async (searchParams: BookingSearchParams) => {
    setLoading(true);
    try {
      const apiResults = await searchService.search(searchParams);
      const mapped = apiResults.map((cab) => {
        const cabType = cab.meta?.cab_types?.[0];
        return {
          id: cab.id,
          title: cab.title,
          origin: cab.origin_city || tripContext.destination,
          cabTypes: cab.meta?.cab_types || [],
          duration: cab.duration || 'Full Day',
          price: cabType?.base_fare ?? null,
          providers: cab.providers || [],
        };
      });
      setResults(mapped);
    } catch (err) {
      console.error('Error fetching cabs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCabs(params); }, []);

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSearchExpanded(false);
    await fetchCabs(params);
  };

  const handleConfirmReplace = () => {
    if (!pendingItem || !onAddToPlan) return;
    const fare = fareFor(pendingItem);
    const newItem: ItineraryItem = {
      id: `cab-${pendingItem.id}-${Date.now()}`,
      type: 'taxi',
      title: pendingItem.title,
      subtitle: routeInfo
        ? `${params.pickup} → ${params.drop} • ~${routeInfo.km} km`
        : `${pendingItem.origin} • ${pendingItem.duration}`,
      price: fare.price != null ? `₹${fare.price.toLocaleString()}` : undefined,
      status: 'Pending',
      details: pendingItem.cabTypes?.[0]?.type || 'SUV',
      cost: { amount: fare.price, currency: 'INR', provenance: fare.provenance },
    };
    onAddToPlan(newItem);
    setPendingItem(null);
  };

  const filteredResults = results.filter((cab: any) => {
    if (selectedTags.length === 0) return true;
    return selectedTags.every(tag => {
      if (tag === 'Full Day') return (cab.duration || '').toLowerCase().includes('full');
      if (tag === 'Half Day') return (cab.duration || '').toLowerCase().includes('half');
      if (tag === 'SUV') return cab.cabTypes?.some((t: any) => (t.type || '').toLowerCase().includes('suv'));
      if (tag === 'Sedan') return cab.cabTypes?.some((t: any) => (t.type || '').toLowerCase().includes('sedan'));
      if (tag === 'Group (10 Seater)') return cab.cabTypes?.some((t: any) => (t.type || '').includes('10'));
      return true;
    });
  });

  const searchSummary = `Cabs in ${params.pickup || tripContext.destination}`;

  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader icon={<Car size={18} />} iconColor="bg-amber-600" label="Cabs" title={searchSummary} tripContext={tripContext} onClose={onClose} />
      <CurrentlyBookedCard tripContext={tripContext} nodeType={['taxi', 'cab']} />
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary={[params.departureDate, `${params.travellers} pax`].filter(Boolean).join(' • ')}
            accentColor="group-hover:text-amber-600" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar tags={QUICK_FILTER_TAGS} selected={selectedTags}
              activeColor="border-amber-600 bg-amber-600 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50"
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
              <CabSearchForm params={params} onUpdateParam={(field, value) => updateParam(setParams, field, value)} />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
                {loading ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Searching...</> : <><Search size={16} />Find Cabs</>}
              </button>
            </form>
          </div>
        )}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-amber-600" />
              <p className="text-sm font-semibold text-slate-600">Finding cabs...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500">{filteredResults.length} cabs found</p>
                {routeInfo && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700" title="Measured road distance for this route">
                    🛣 ~{routeInfo.km} km · {Math.round(routeInfo.mins / 60 * 10) / 10}h drive
                  </span>
                )}
              </div>
              {filteredResults.map((cab) => {
                const fare = fareFor(cab);
                return (
                  <div key={cab.id} className={`rounded-xl border bg-white p-4 transition-all hover:shadow-md ${pendingItem?.id === cab.id ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200 hover:border-amber-300'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{cab.title}</p>
                        <p className="text-xs text-slate-500">{cab.origin} • {cab.duration}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {cab.cabTypes?.map((t: any, tIdx: number) => (
                            <span key={`${t.type || 'type'}-${tIdx}`} className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{t.type}</span>
                          ))}
                        </div>
                      </div>
                      <div className="ml-4 text-right shrink-0">
                        <p className="text-xl font-bold tabular-nums text-slate-900">{fare.price != null ? `₹${fare.price.toLocaleString()}` : 'Price on request'}</p>
                        <p className="text-xs text-slate-500 mb-1">{fare.basisLabel}</p>
                        <ProvenanceBadge provenance={fare.provenance} className="mb-1.5" />
                        <button onClick={() => setPendingItem(cab)}
                          className={`mt-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${pendingItem?.id === cab.id ? 'bg-amber-700 text-white' : 'bg-amber-600 text-white hover:bg-amber-700'}`}>
                          {pendingItem?.id === cab.id ? '✓ Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200"><Car size={24} className="text-slate-400" /></div>
              <p className="text-sm font-semibold text-slate-600">No cabs found in {params.pickup}</p>
            </div>
          )}
        </div>
      </div>
      {pendingItem && onAddToPlan && (
        <ReplaceConfirmBar newItemTitle={pendingItem.title} newItemPrice={fareFor(pendingItem).price != null ? `₹${fareFor(pendingItem).price!.toLocaleString()}` : undefined}
          tripContext={tripContext} confirmColor="bg-amber-600 hover:bg-amber-700"
          onCancel={() => setPendingItem(null)} onConfirm={handleConfirmReplace} />
      )}
    </div>
  );
}
