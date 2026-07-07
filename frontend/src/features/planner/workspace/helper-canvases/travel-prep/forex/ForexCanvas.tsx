'use client';

import React, { useState, useEffect } from 'react';
import { Banknote, Star, MapPin, AlertTriangle, Info } from 'lucide-react';
import { forexService } from '@/services/forex.service';
import { TripContext } from '../../../types';
import CanvasHeader from '../../shared/CanvasHeader';
import SearchSummaryBar from '../../shared/SearchSummaryBar';
import QuickFilterBar from '../../shared/QuickFilterBar';

interface ForexCanvasProps {
  onClose?: () => void;
  tripContext: TripContext;
}

const FILTER_TAGS = ['Best Rate', 'Home Delivery', 'No Commission', 'Instant'];

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

/**
 * ForexCanvas — Two modes:
 * 1. DOMESTIC (INR→INR): Shows cash planning advisory for Himalayan trips
 *    (ATM warnings, recommended cash, local vendors)
 * 2. INTERNATIONAL: Shows currency exchange vendors and live rates
 */
export default function ForexCanvas({ onClose, tripContext }: ForexCanvasProps) {
  const [fromCurrency] = useState('INR');
  const [toCurrency] = useState('USD');
  const [amount] = useState(50000);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState<ForexVendorUI[]>([]);
  const [convertedAmount, setConvertedAmount] = useState<string>('0.00');
  const [liveRate, setLiveRate] = useState<number>(83.50);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Best Rate']);

  // Detect domestic trip (all cities are India — no currency exchange needed)
  const isDomesticTrip = tripContext.currency === 'INR' && !tripContext.allCities.some(c =>
    ['bali', 'bangkok', 'dubai', 'singapore', 'london', 'paris', 'nepal', 'europe'].some(intl => c.toLowerCase().includes(intl))
  );

  useEffect(() => {
    if (!isDomesticTrip) {
      fetchRates();
      fetchVendors();
    }
  }, [isDomesticTrip]);

  const fetchRates = async () => {
    try {
      const rateData: any = await forexService.getCurrency(toCurrency);
      if (rateData?.exchange_rate) {
        setLiveRate(parseFloat(rateData.exchange_rate));
        setConvertedAmount((amount / parseFloat(rateData.exchange_rate)).toFixed(2));
      }
    } catch (err) { console.error('Rate fetch error:', err); }
  };

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const data = await forexService.getVendors(toCurrency);
      const mapped = (data || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        location: v.address?.split(',')[0] || 'N/A',
        rating: parseFloat(v.rating) || 4.0,
        buyRate: v.inventory?.find((i: any) => i.currency === toCurrency)?.exchange_rate?.toString() ?? '-',
        sellRate: '-',
        commission: v.commission || 'Standard',
        delivery: v.is_delivery_available ? 'Home Delivery' : 'Store Pickup',
      }));
      setVendors(mapped);
    } catch (err) { console.error('Vendor fetch error:', err); }
    finally { setLoading(false); }
  };

  const searchSummary = isDomesticTrip ? `Cash Planning — ${tripContext.destination}` : `${fromCurrency} → ${toCurrency} Exchange`;

  // ─── DOMESTIC MODE: Cash planning advisory ──────────────────────────────
  if (isDomesticTrip) {
    return (
      <div className="flex h-full flex-col bg-white">
        <CanvasHeader icon={<Banknote size={18} />} iconColor="bg-emerald-700" label="Cash Planning" title={searchSummary} tripContext={tripContext} onClose={onClose} />
        <div className="custom-scrollbar flex-1 overflow-y-auto p-4 space-y-4">
          {/* No forex needed card */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100"><Info size={18} className="text-emerald-700" /></div>
              <div>
                <h3 className="text-sm font-bold text-emerald-900">No currency exchange needed</h3>
                <p className="mt-1 text-xs text-emerald-700">{tripContext.destination} is a domestic destination &mdash; you&apos;re all set with INR!</p>
              </div>
            </div>
          </div>

          {/* ATM Warning */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-amber-900">⚠️ ATM Advisory for {tripContext.destination}</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-amber-800">
                  <li>• ATMs in <strong>Kasol, Tosh, and Kheerganga</strong> are often out of cash or out of service</li>
                  <li>• <strong>Bhuntar</strong> (near KUU airport) has the most reliable ATMs in the area</li>
                  <li>• Withdraw cash at <strong>Delhi or Chandigarh</strong> before reaching Manali if possible</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Cash recommendations */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Recommended Cash for {tripContext.travellers} traveller(s)</h3>
            <div className="space-y-2">
              {[
                { label: 'Local food (dhabas & cafes)', amount: 800 * tripContext.travellers, per: 'per day' },
                { label: 'Activities (paragliding, trekking)', amount: 2500 * tripContext.travellers, per: 'estimate' },
                { label: 'Local transport (shared cabs)', amount: 600 * tripContext.travellers, per: 'per day' },
                { label: 'Emergency buffer', amount: 5000, per: 'total' },
              ].map(({ label, amount: amt, per }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{label}</span>
                  <span className="font-bold text-slate-900">₹{amt.toLocaleString()} <span className="text-slate-400 font-normal">/ {per}</span></span>
                </div>
              ))}
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-sm font-bold">
                <span className="text-slate-900">Carry at least</span>
                <span className="text-emerald-700">₹{(7000 * tripContext.travellers).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Denomination tip */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-bold text-blue-900">💡 Denomination Tips</h3>
            <ul className="space-y-1 text-xs text-blue-800">
              <li>• Keep plenty of <strong>₹500 & ₹100 notes</strong> — local dhabas rarely have change for ₹2000</li>
              <li>• UPI works in Manali town & Kasol but <strong>NOT in Kheerganga, Tosh, or Chalal</strong></li>
              <li>• Petrol pumps near Bhuntar accept cards reliably</li>
            </ul>
          </div>

          {/* Nearby ATMs / Forex */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Nearest ATMs & Forex</h3>
            <div className="space-y-3">
              {[
                { name: 'SBI ATM — Manali Mall Road', dist: '0.5 km from town center', note: 'May run out Oct–Nov' },
                { name: 'HDFC ATM — Bhuntar', dist: 'Near KUU Airport, Bhuntar', note: 'Most reliable in the valley' },
                { name: 'Bhuntar Forex Exchange', dist: 'Near Bus Stand, Bhuntar', note: 'USD/EUR — limited stock' },
              ].map(atm => (
                <div key={atm.name} className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{atm.name}</p>
                    <p className="text-[11px] text-slate-500">{atm.dist} • {atm.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── INTERNATIONAL MODE: Currency exchange ──────────────────────────────
  return (
    <div className="flex h-full flex-col bg-white">
      <CanvasHeader icon={<Banknote size={18} />} iconColor="bg-violet-600" label="Forex" title={searchSummary} tripContext={tripContext} onClose={onClose} />
      <div className="custom-scrollbar flex-1 overflow-y-auto">
        {!isSearchExpanded && (
          <SearchSummaryBar primary={searchSummary} secondary={`₹${amount.toLocaleString()} → ${convertedAmount} ${toCurrency}`}
            accentColor="group-hover:text-violet-600" onClick={() => setIsSearchExpanded(true)}>
            <QuickFilterBar tags={FILTER_TAGS} selected={selectedTags}
              activeColor="border-violet-600 bg-violet-600 text-white shadow-sm"
              hoverColor="border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:bg-violet-50"
              onToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} />
          </SearchSummaryBar>
        )}
        <div className="p-4">
          {/* Rate card */}
          <div className="mb-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider">Live Rate</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">1 {toCurrency} = ₹{liveRate.toFixed(2)}</p>
            <p className="mt-0.5 text-xs text-slate-500">Rates vary by vendor. Compare below.</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8">
              <div className="mb-3 h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-violet-600" />
              <p className="text-sm font-semibold text-slate-600">Loading vendors...</p>
            </div>
          ) : vendors.length > 0 ? (
            <div className="space-y-3">
              {vendors.map(vendor => (
                <div key={vendor.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-violet-300 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{vendor.name}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={11} />{vendor.location}</div>
                      <div className="mt-1.5 flex items-center gap-1">
                        {[...Array(5)].map((_, i) => <Star key={i} size={11} fill={i < Math.floor(vendor.rating) ? '#8b5cf6' : 'none'} className={i < Math.floor(vendor.rating) ? 'text-violet-500' : 'text-slate-300'} />)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-900">₹{vendor.buyRate}</p>
                      <p className="text-[10px] text-slate-500">buy rate</p>
                      <span className="mt-1 inline-block rounded bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">{vendor.delivery}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <div className="mx-auto mb-3 text-4xl">💱</div>
              <p className="text-sm font-semibold text-slate-600">No vendors found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
