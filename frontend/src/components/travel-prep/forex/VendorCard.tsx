'use client';

import { useState } from 'react';
import { Star, MapPin, Phone, Clock, Truck, Store, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import GlassCard from '@/components/ui-custom/glass-card';
import { ForexVendor, ForexRequestType } from '@/types/forex';
import { forexService } from '@/services/forex.service';

const CURRENCY_FLAGS: Record<string, string> = {
  INR: '🇮🇳', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧',
  AED: '🇦🇪', SGD: '🇸🇬', MYR: '🇲🇾', JPY: '🇯🇵',
  AUD: '🇦🇺', CAD: '🇨🇦',
};

interface VendorCardProps {
  vendor: ForexVendor;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
}

type FormState = {
  preferred_date: string;
  preferred_time: string;
  contact_number: string;
  delivery_address: string;
  notes: string;
};

export default function VendorCard({ vendor, fromCurrency, toCurrency, amount }: VendorCardProps) {
  const [requestType, setRequestType] = useState<ForexRequestType>('PICKUP');
  const [form, setForm] = useState<FormState>({
    preferred_date: '',
    preferred_time: '',
    contact_number: '',
    delivery_address: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find the vendor's rate for toCurrency from their inventory
  const inventoryItem = vendor.inventory.find((inv) => inv.currency === toCurrency && inv.is_available);
  const vendorRate = inventoryItem?.exchange_rate;

  const handleSubmit = async () => {
    if (!form.preferred_date || !form.preferred_time || !form.contact_number) {
      setError('Please fill in all required fields.');
      return;
    }
    if (requestType === 'DELIVERY' && !form.delivery_address) {
      setError('Please provide a delivery address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await forexService.createDeliveryRequest({
        vendor: vendor.id,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        amount,
        request_type: requestType,
        preferred_date: form.preferred_date,
        preferred_time: form.preferred_time,
        contact_number: form.contact_number,
        delivery_address: requestType === 'DELIVERY' ? form.delivery_address : undefined,
        notes: form.notes,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard className="p-5 flex flex-col gap-4 hover:shadow-xl transition-shadow duration-300">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-base leading-tight">{vendor.name}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
            <MapPin size={11} />
            <span className="line-clamp-1">{vendor.address}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1">
          <Star size={12} className="fill-amber-400 text-amber-400" />
          <span className="text-xs font-bold text-amber-700">{Number(vendor.rating).toFixed(1)}</span>
        </div>
      </div>

      {/* Meta Row */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {vendor.opening_hours && (
          <div className="flex items-center gap-1.5">
            <Clock size={12} />
            <span>{vendor.opening_hours}</span>
          </div>
        )}
        {vendor.contact_number && (
          <div className="flex items-center gap-1.5">
            <Phone size={12} />
            <span>{vendor.contact_number}</span>
          </div>
        )}
        {vendor.is_delivery_available ? (
          <span className="flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-green-700 font-medium">
            <Truck size={11} /> Delivery Available
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-slate-500 font-medium">
            <Store size={11} /> Pickup Only
          </span>
        )}
      </div>

      {/* Rate Chip */}
      {vendorRate && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700 font-semibold">
          {CURRENCY_FLAGS[fromCurrency]} {fromCurrency} → {CURRENCY_FLAGS[toCurrency]} {toCurrency} &nbsp;·&nbsp;
          Rate: <strong>1 {toCurrency} = {(1 / Number(vendorRate)).toFixed(4)} {fromCurrency}</strong>
        </div>
      )}

      {/* Request Type Toggle */}
      <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          onClick={() => setRequestType('PICKUP')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            requestType === 'PICKUP'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Store size={13} /> Store Pickup
        </button>
        {vendor.is_delivery_available && (
          <button
            onClick={() => setRequestType('DELIVERY')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              requestType === 'DELIVERY'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Truck size={13} /> Home Delivery
          </button>
        )}
      </div>

      {/* Success State */}
      {success ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle size={36} className="text-green-500" />
          <p className="text-sm font-semibold text-green-700">Request Submitted!</p>
          <p className="text-xs text-slate-500">The vendor will confirm your {requestType === 'DELIVERY' ? 'delivery' : 'pickup'} shortly.</p>
          <button onClick={() => { setSuccess(false); setForm({ preferred_date: '', preferred_time: '', contact_number: '', delivery_address: '', notes: '' }); }}
            className="mt-1 text-xs text-blue-600 hover:underline">
            Make another request
          </button>
        </div>
      ) : (
        /* Booking Form */
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Date *</label>
              <input
                type="date"
                value={form.preferred_date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setForm((f) => ({ ...f, preferred_date: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Time *</label>
              <input
                type="time"
                value={form.preferred_time}
                onChange={(e) => setForm((f) => ({ ...f, preferred_time: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Contact Number *</label>
            <input
              type="tel"
              value={form.contact_number}
              onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
              placeholder="e.g. 9876543210"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {requestType === 'DELIVERY' && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Delivery Address *</label>
              <textarea
                rows={2}
                value={form.delivery_address}
                onChange={(e) => setForm((f) => ({ ...f, delivery_address: e.target.value }))}
                placeholder="Full delivery address..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md shadow-blue-600/20 disabled:opacity-60"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : (
              requestType === 'DELIVERY' ? <><Truck size={14} /> Request Delivery</> : <><Store size={14} /> Book Store Pickup</>
            )}
          </button>
        </div>
      )}
    </GlassCard>
  );
}
