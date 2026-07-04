'use client';

import React, { useState, useEffect } from 'react';
import { Banknote, X, Edit2, Check, ArrowRightLeft, Star, MapPin } from 'lucide-react';
import { forexService } from '@/services/forex.service';

interface ForexCanvasProps {
  onClose?: () => void;
}

interface ForexVendorUI {
  id: string;
  name: string;
  location: string;
  rating: number;
  buyRate: string;
  sellRate: string;
  commission: string;
  delivery: string;
}

export default function ForexCanvas({ onClose }: ForexCanvasProps) {
  const [fromCurrency, setFromCurrency] = useState('INR');
  const [toCurrency, setToCurrency] = useState('USD');
  const [amount, setAmount] = useState(50000);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ForexVendorUI[]>([]);
  const [convertedAmount, setConvertedAmount] = useState<string>('0.00');
  const [liveRate, setLiveRate] = useState<number>(83.50);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Best Rate']);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const recommendedTags = [
    'Best Rate',
    'Home Delivery',
    'Near Me',
    'No Commission',
    'Verified'
  ];

  const fetchForexData = async () => {
    setLoading(true);
    try {
      // 1. Get exchange rates and convert amount
      let calculatedAmount = amount.toString();
      let rate = 1.0;
      if (fromCurrency !== toCurrency) {
        try {
          const conversion = await forexService.convert(fromCurrency, toCurrency, amount);
          calculatedAmount = conversion.converted_amount.toFixed(2);
          rate = conversion.rate;
        } catch (err) {
          console.error('Conversion error:', err);
        }
      }
      setConvertedAmount(Number(calculatedAmount).toFixed(2));
      
      // Calculate friendly rate for standard UI representation (e.g. 1 unit of foreign currency = X INR)
      const friendlyRate = fromCurrency === 'INR' && rate !== 0 ? (1 / rate) : rate;
      setLiveRate(friendlyRate);

      // 2. Fetch live vendors supporting this currency
      const vendors = await forexService.getVendors(toCurrency);
      const mappedVendors: ForexVendorUI[] = vendors.map((vendor: any) => {
        // Find matching inventory item for rate details
        const inv = vendor.inventory?.find((i: any) => i.currency === toCurrency);
        const invRate = inv ? inv.exchange_rate : friendlyRate;
        
        return {
          id: vendor.id,
          name: vendor.name,
          location: vendor.address,
          rating: Number(vendor.rating || 4.5),
          buyRate: (Number(invRate) * 0.985).toFixed(2),
          sellRate: Number(invRate).toFixed(2),
          commission: vendor.is_delivery_available ? 'Zero Commission' : 'Best Rates Guaranteed',
          delivery: vendor.is_delivery_available ? 'Home Delivery & Pickup' : 'Branch Pickup Only',
        };
      });
      setResults(mappedVendors);
    } catch (error) {
      console.error('Error fetching forex data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Run on mount and whenever search criteria is modified via search form
  useEffect(() => {
    fetchForexData();
  }, []);

  // Filter results locally based on quick action tags
  const filteredResults = results.filter(vendor => {
    if (selectedTags.length === 0) return true;
    return selectedTags.every(tag => {
      if (tag === 'Home Delivery') return vendor.delivery.includes('Home');
      if (tag === 'No Commission' || tag === 'Best Rate') {
        return vendor.commission.includes('Zero') || vendor.commission.includes('Best');
      }
      if (tag === 'Verified' || tag === 'Near Me') return vendor.rating >= 4.5;
      return true;
    });
  });

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-white">
              <Banknote size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Forex Exchange</p>
              <h2 className="text-sm font-semibold text-slate-900">{fromCurrency} to {toCurrency}</h2>
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
              className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-cyan-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {fromCurrency === 'INR' ? '₹' : `${fromCurrency} `}{amount.toLocaleString()}
                    </span>
                    <ArrowRightLeft size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-900">
                      {toCurrency === 'INR' ? '₹' : `${toCurrency} `}{convertedAmount}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {fromCurrency} → {toCurrency} • Live Rate: {liveRate.toFixed(4)}
                  </p>
                </div>
                <Edit2 size={16} className="text-slate-400 group-hover:text-cyan-600" />
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
                        ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50'
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
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Edit Exchange</h3>
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={fromCurrency}
                  onChange={(e) => setFromCurrency(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="AED">AED</option>
                  <option value="SGD">SGD</option>
                  <option value="JPY">JPY</option>
                </select>

                <button
                  onClick={() => {
                    const temp = fromCurrency;
                    setFromCurrency(toCurrency);
                    setToCurrency(temp);
                  }}
                  className="rounded-lg bg-slate-100 p-2 hover:bg-slate-200"
                >
                  <ArrowRightLeft size={16} />
                </button>

                <select
                  value={toCurrency}
                  onChange={(e) => setToCurrency(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="AED">AED</option>
                  <option value="SGD">SGD</option>
                  <option value="JPY">JPY</option>
                  <option value="INR">INR</option>
                </select>
              </div>

              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Enter amount"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-cyan-500 focus:outline-none"
              />

              <button
                onClick={() => {
                  fetchForexData();
                  setIsSearchExpanded(false);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-sm font-semibold text-white transition-all hover:bg-cyan-700"
              >
                Find Vendors
              </button>
            </div>
          </div>
        )}

        {/* Results Section */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-cyan-600" />
              <p className="text-sm font-semibold text-slate-600">Finding vendors...</p>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500">{filteredResults.length} vendors found</p>

              {/* Vendor Cards */}
              {filteredResults.map((vendor) => (
                <div
                  key={vendor.id}
                  className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-cyan-300 hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{vendor.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <MapPin size={12} />
                        <span>{vendor.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700">
                      <span>{vendor.rating.toFixed(1)}</span>
                      <Star size={12} className="fill-cyan-600 text-cyan-600" />
                    </div>
                  </div>

                  <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                    <div>
                      <p className="text-[10px] text-slate-500">Buy Rate</p>
                      <p className="text-sm font-bold text-slate-900">₹{vendor.buyRate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500">Sell Rate</p>
                      <p className="text-sm font-bold text-slate-900">₹{vendor.sellRate}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">
                      <p className="font-semibold text-green-600">{vendor.commission}</p>
                      <p className="text-slate-500 text-[11px]">{vendor.delivery}</p>
                    </div>
                    <button className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-700">
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <Banknote size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No vendors found for {toCurrency}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
