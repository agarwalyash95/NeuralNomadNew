'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TravelSearchResult, FlightMeta, TrainMeta, HotelMeta, CabMeta } from '@/types/search';
import { useRouter } from 'next/navigation';
import { useBookingSelectionStore } from '@/store/booking-selection.store';
import { ChevronDown, ChevronUp, Clock, MapPin, Plane, Train, BedDouble, Bus, Car } from 'lucide-react';

interface Props {
  results: TravelSearchResult[];
}

export default function SearchResults({ results }: Props) {
  const router = useRouter();
  const setSelected = useBookingSelectionStore((state) => state.setSelected);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-12 text-center">
        <p className="text-lg font-bold text-slate-500">No results found for your search.</p>
        <p className="text-sm text-slate-400 mt-2">Try adjusting your filters or destination.</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleBook = (result: TravelSearchResult, _specificDetails?: unknown) => {
    void _specificDetails; // reserved for passing class/provider selection in future
    setSelected(result);
    router.push('/book-now');
  };

  return (
    <div className="space-y-6">
      {results.map((result) => {
        const isExpanded = expandedId === result.id;
        const isTrain = result.service_type === 'train';

        // Get cheapest price for the main card display
        let lowestPrice = 0;
        if (isTrain) {
          const trainMeta = result.meta as TrainMeta;
          lowestPrice = Math.min(...(trainMeta.classes?.map((c) => c.price) || [0]));
        } else if (result.providers && result.providers.length > 0) {
          lowestPrice = Math.min(...result.providers.map((p) => p.price));
        } else if (result.service_type === 'hotel') {
          const hotelMeta = result.meta as HotelMeta;
          lowestPrice = Math.min(...(hotelMeta.rooms?.map((r) => r.price_per_night) || [0]));
        } else if (result.service_type === 'cab') {
          const cabMeta = result.meta as CabMeta;
          lowestPrice = Math.min(...(cabMeta.cab_types?.map((c) => c.price_per_km) || [0]));
        } else {
           // flights/buses fallback if providers array is missing but classes exist
           const flightMeta = result.meta as FlightMeta;
           lowestPrice = Math.min(...(flightMeta.cabin_classes?.map((c) => c.price) || [0]));
        }

        return (
          <div key={result.id} className="rounded-[1.5rem] border border-white/60 bg-white/80 backdrop-blur-xl shadow-lg shadow-slate-200/50 overflow-hidden transition-all hover:shadow-xl hover:bg-white">
            
            {/* Top Main Card */}
            <div className="p-6 sm:p-8">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                
                {/* Left: Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                      {result.service_type === 'flight' && <Plane size={20} />}
                      {result.service_type === 'train' && <Train size={20} />}
                      {result.service_type === 'hotel' && <BedDouble size={20} />}
                      {result.service_type === 'bus' && <Bus size={20} />}
                      {result.service_type === 'cab' && <Car size={20} />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800">{result.title}</h3>
                      <p className="text-sm font-semibold text-slate-500 tracking-wide">{result.code}</p>
                    </div>
                  </div>

                  {result.service_type !== 'hotel' ? (
                    <div className="flex items-center gap-4 mt-6">
                      <div className="text-center sm:text-left">
                        <p className="text-2xl font-black text-slate-800">{result.departure_time}</p>
                        <p className="text-sm font-semibold text-slate-500 mt-1">{result.origin_city}</p>
                      </div>
                      
                      <div className="flex-1 flex flex-col items-center px-4">
                        <p className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-1"><Clock size={12}/> {result.duration}</p>
                        <div className="w-full h-px bg-slate-300 relative">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-300" />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                          {result.stops === 0 ? 'Non-Stop' : `${result.stops} Stop(s)`}
                        </p>
                      </div>

                      <div className="text-center sm:text-right">
                        <p className="text-2xl font-black text-slate-800">{result.arrival_time}</p>
                        <p className="text-sm font-semibold text-slate-500 mt-1">{result.destination_city}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 text-slate-600">
                      <MapPin size={16} />
                      <span className="font-semibold">{result.destination_city} • {(result.meta as HotelMeta).address}</span>
                    </div>
                  )}
                </div>

                {/* Right: Price & CTA */}
                <div className="flex flex-col items-end justify-center border-t md:border-t-0 md:border-l border-slate-200 pt-6 md:pt-0 md:pl-8">
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Starts From</p>
                  <p className="text-3xl font-black text-green-600 mb-4">
                    ₹{lowestPrice.toLocaleString('en-IN')}
                    {result.service_type === 'cab' && <span className="text-sm text-slate-500">/km</span>}
                  </p>
                  
                  <Button 
                    onClick={() => toggleExpand(result.id)}
                    className="w-full sm:w-40 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center gap-2"
                  >
                    {isTrain ? 'Check Classes' : 'Compare Prices'}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Expanded Section */}
            {isExpanded && (
              <div className="bg-slate-50 border-t border-slate-200 p-6 sm:p-8 animate-in slide-in-from-top-4 fade-in duration-200">
                
                {isTrain ? (
                  // TRAIN LAYOUT (Classes & Availability)
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Train size={16} className="text-blue-600"/> Class Availability
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(result.meta as TrainMeta).classes?.map((trainClass, idx) => {
                        const isAvailable = trainClass.availability.startsWith('AVAILABLE');
                        return (
                          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <p className="text-lg font-black text-slate-800">{trainClass.class}</p>
                                <p className="text-xs font-semibold text-slate-500">{trainClass.label}</p>
                              </div>
                              <p className="text-xl font-black text-slate-800">₹{trainClass.price}</p>
                            </div>
                            
                            <div className={`text-sm font-bold px-3 py-1.5 rounded-lg inline-block mb-4 ${isAvailable ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {trainClass.availability}
                            </div>
                            
                            <Button 
                              onClick={() => handleBook(result, trainClass)}
                              variant={isAvailable ? 'default' : 'outline'}
                              className="w-full rounded-lg font-bold"
                            >
                              Book Now
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  // FLIGHT/HOTEL/BUS/CAB LAYOUT (Multi-Provider Comparison)
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-600 inline-block"/> Compare Provider Prices
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Sort providers by price */}
                      {[...(result.providers || [])].sort((a, b) => a.price - b.price).map((provider, idx) => {
                        const isCheapest = idx === 0;
                        return (
                          <div key={idx} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border transition-all ${isCheapest ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                            <div className="mb-4 sm:mb-0">
                              <p className="text-lg font-black text-slate-800 flex items-center gap-2">
                                {provider.provider}
                                {isCheapest && <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-wider bg-green-200 text-green-800">Lowest</span>}
                              </p>
                              {result.service_type === 'flight' && (
                                <p className="text-xs font-semibold text-slate-500 mt-1">
                                  Included: {(result.meta as FlightMeta).baggage} Baggage • {(result.meta as FlightMeta).meal} Meal
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                              <p className="text-2xl font-black text-slate-800">
                                ₹{provider.price.toLocaleString('en-IN')}
                                {result.service_type === 'cab' && <span className="text-sm text-slate-500">/km</span>}
                              </p>
                              <Button 
                                onClick={() => handleBook(result, provider)}
                                className={`rounded-xl font-bold px-6 ${isCheapest ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                              >
                                Book Now
                              </Button>
                            </div>
                          </div>
                        )
                      })}

                      {(!result.providers || result.providers.length === 0) && (
                        <p className="text-sm text-slate-500 italic">No price comparisons available.</p>
                      )}
                    </div>
                  </div>
                )}
                
              </div>
            )}
            
          </div>
        );
      })}
    </div>
  );
}
