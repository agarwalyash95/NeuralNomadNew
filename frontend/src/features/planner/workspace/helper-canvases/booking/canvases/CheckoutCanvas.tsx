'use client';

import React, { useState, useMemo } from 'react';
import { X, CreditCard, Check, Loader2, ShieldCheck, Building, Plane, Car, AlertTriangle, ShoppingCart } from 'lucide-react';
import { MockTripData } from '../../../plan-canvas/types';
import { parsePriceToInteger } from '../../../plan-canvas/utils/priceParser';
import PassengerDetailsForm from '../forms/PassengerDetailsForm';

interface CheckoutCanvasProps {
  planData: MockTripData;
  workspaceId?: string | null;
  onClose: () => void;
  /** Must actually perform the booking and throw on failure — checkout only
   *  shows success once this resolves. Receives exactly the block ids the
   *  traveler checked — never a wholesale re-scan of the plan. */
  onConfirmBooking: (blockIds: string[]) => Promise<void>;
  /** Verify a block's price — unblocks its checkout row once it resolves. */
  onVerifyLivePrice?: (itemId: string) => void;
}

type CheckoutStep = 'summary' | 'processing' | 'success' | 'error';
const BOOKABLE_TRANSIT_TYPES = ['flight', 'train', 'bus', 'cab', 'taxi'];

export default function CheckoutCanvas({ planData, workspaceId, onClose, onConfirmBooking, onVerifyLivePrice }: CheckoutCanvasProps) {
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [errorMessage, setErrorMessage] = useState('');
  // Items the traveler has explicitly unchecked — everything priced starts
  // checked, so a newly-verified price defaults to included automatically
  // rather than requiring the user to re-discover and re-check it.
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  // A booking reference derived from the real trip id — never a fabricated,
  // identical-for-everyone string. Honest about what it is: a reference to
  // find this booking in Your Wallet, not an airline/rail PNR.
  const bookingRef = `NN-${(workspaceId || 'TRIP').replace(/-/g, '').slice(-8).toUpperCase()}`;

  // Gather bookable items from active trip planData — every hotel/transit
  // block regardless of price, so an unpriced one can still show up as a
  // disabled row with a way to unblock it, instead of silently vanishing.
  const { hotels, transits } = useMemo(() => {
    const hotels: any[] = [];
    const transits: any[] = [];
    if (planData?.cities) {
      planData.cities.forEach(city => {
        const transit = city.transitToNext;
        if (transit && !transit.isInactive && transit.blockStatus !== 'booked') {
          transits.push({ ...transit, cityName: city.cityName });
        }
        city.days.forEach(day => {
          day.items.forEach(item => {
            if (item.isInactive || item.blockStatus === 'booked') return;
            if (item.type === 'hotel') {
              hotels.push({ ...item, cityName: city.cityName, dayNumber: day.dayNumber });
            } else if (BOOKABLE_TRANSIT_TYPES.includes(item.type)) {
              transits.push({ ...item, cityName: city.cityName, dayNumber: day.dayNumber });
            }
          });
        });
      });
    }
    return { hotels, transits };
  }, [planData]);

  const allItems = useMemo(() => [...hotels, ...transits], [hotels, transits]);
  const isChecked = (item: any) => Boolean(item.price) && !excludedIds.has(item.id);
  const toggleItem = (item: any) => {
    if (!item.price) return; // unpriced rows aren't togglable — verify first
    setExcludedIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };
  const checkedItems = allItems.filter(isChecked);
  const totalCost = checkedItems.reduce((sum, i) => sum + parsePriceToInteger(i.price), 0);

  // Structured field — never parsed back out of the display `stats` string.
  const travelersCount = planData?.travelers && planData.travelers > 0 ? planData.travelers : 1;

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [passengers, setPassengers] = useState<any[]>(
    Array.from({ length: travelersCount }).map(() => ({ name: '', age: '', gender: 'Male' }))
  );
 
  const handlePassengerChange = (index: number, field: string, value: string) => {
    setPassengers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };
 
  const isFormValid =
    checkedItems.length > 0 &&
    email.trim() !== '' &&
    phone.trim() !== '' &&
    passengers.every(p => p.name?.trim() !== '' && p.age?.trim() !== '');

  const hasItems = allItems.length > 0;
  // No fabricated fees — taxes/service charges are the provider's to disclose
  // at their own checkout. What we show here is exactly what we can commit to.
  const grandTotal = totalCost;

  const handlePay = async () => {
    setStep('processing');
    setErrorMessage('');
    try {
      // The real, server-authoritative booking call — success is only shown
      // once this has actually happened, never on a fixed timer. Only the
      // items the traveler left checked are sent.
      await onConfirmBooking(checkedItems.map(i => i.id));
      setStep('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not confirm this booking. Nothing was charged.');
      setStep('error');
    }
  };
 
  return (
    <div className="flex h-full w-full flex-col bg-paper-1 p-4 lg:p-6 select-none overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="text-blue-600" size={20} />
          <h3 className="text-lg font-black uppercase tracking-wider text-ink-900">Checkout</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
 
      {step === 'summary' && (
        <div className="flex-1 flex flex-col gap-4">
          {!hasItems ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-4 bg-white rounded-2xl border border-slate-200">
              <ShoppingCart size={28} className="mb-3 text-slate-300" />
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Cart is empty</h4>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                Configure stays, flights, or transit options in your timeline first. Once selected, confirmed items will list here for single-click payment checkouts.
              </p>
            </div>
          ) : (
            <>
              {/* Item lists */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">
                  Booking Items — {checkedItems.length} of {allItems.length} selected
                </span>

                {/* 1. Accommodations */}
                {hotels.map((h, i) => {
                  const priced = Boolean(h.price);
                  const checked = isChecked(h);
                  return (
                    <div key={`hotel-${i}`} className={`flex items-center gap-3 rounded-xl border p-3 shadow-2xs transition-opacity ${priced ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50/40'} ${!checked && priced ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!priced}
                        onChange={() => toggleItem(h)}
                        className="h-4 w-4 shrink-0 accent-indigo-600 disabled:opacity-30"
                        aria-label={`Include ${h.title} in booking`}
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                        <Building size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs font-bold text-slate-900 truncate">{h.title}</h5>
                          <span className="text-xs font-black text-slate-800 shrink-0">{h.price || 'No price yet'}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">Stay • {h.cityName} (Day {h.dayNumber})</p>
                      </div>
                      {!priced && (
                        <button
                          type="button"
                          onClick={() => onVerifyLivePrice?.(h.id)}
                          disabled={!onVerifyLivePrice}
                          className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
                        >
                          <AlertTriangle size={11} /> Verify price
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* 2. Transits */}
                {transits.map((t, i) => {
                  const priced = Boolean(t.price);
                  const checked = isChecked(t);
                  return (
                    <div key={`transit-${i}`} className={`flex items-center gap-3 rounded-xl border p-3 shadow-2xs transition-opacity ${priced ? 'border-slate-200 bg-white' : 'border-amber-200 bg-amber-50/40'} ${!checked && priced ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!priced}
                        onChange={() => toggleItem(t)}
                        className="h-4 w-4 shrink-0 accent-blue-600 disabled:opacity-30"
                        aria-label={`Include ${t.title} in booking`}
                      />
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                        {t.type === 'flight' ? <Plane size={16} /> : <Car size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs font-bold text-slate-900 truncate">{t.title}</h5>
                          <span className="text-xs font-black text-slate-800 shrink-0">{t.price || 'No price yet'}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">Transit • {t.subtitle || 'Transit Connection'}</p>
                      </div>
                      {!priced && (
                        <button
                          type="button"
                          onClick={() => onVerifyLivePrice?.(t.id)}
                          disabled={!onVerifyLivePrice}
                          className="shrink-0 flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50"
                        >
                          <AlertTriangle size={11} /> Verify price
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
 
              {/* Passenger details form */}
              <PassengerDetailsForm
                travelersCount={travelersCount}
                passengers={passengers}
                onChange={handlePassengerChange}
                email={email}
                setEmail={setEmail}
                phone={phone}
                setPhone={setPhone}
              />
 
              {/* Price Invoice */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs mt-2 flex flex-col gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-1.5 mb-1">
                  Fare Summary
                </span>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-black text-slate-950">
                  <span>Total Amount:</span>
                  <span className="text-blue-600">₹{grandTotal.toLocaleString()}</span>
                </div>
                <p className="text-[10px] font-medium text-slate-400 leading-relaxed">
                  Provider taxes and service fees, if any, are disclosed at the provider&apos;s own checkout — not collected here.
                </p>
              </div>

              {/* Honest state: this confirms the booking commitment in your plan;
                  no payment is actually collected by this screen yet. */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold justify-center">
                <ShieldCheck size={13} className="text-slate-400" />
                <span>No payment is collected here — confirming reserves these items in your plan</span>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handlePay}
                disabled={!isFormValid}
                className="mt-auto rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-3.5 text-sm font-black text-white shadow-md hover:scale-[1.01] hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CreditCard size={16} />
                Confirm Booking (₹{grandTotal.toLocaleString()})
              </button>
            </>
          )}
        </div>
      )}
 
      {step === 'processing' && (
        <div role="status" aria-live="polite" className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest motion-safe:animate-pulse">
            Confirming Your Booking
          </h4>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            Reserving these items in your plan — this usually takes a few seconds.
          </p>
        </div>
      )}

      {step === 'error' && (
        <div role="status" aria-live="assertive" className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600 border-2 border-red-100 shadow-md mb-5">
            <X size={32} strokeWidth={3} />
          </div>

          <h3 className="text-xl font-black text-slate-900 tracking-tight">Booking didn&apos;t go through</h3>
          <p className="mt-1.5 max-w-xs text-xs text-slate-500 font-medium leading-relaxed">
            {errorMessage} Nothing has been booked or charged — you can try again.
          </p>

          <div className="mt-6 flex w-full gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-300 bg-white p-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Go Back
            </button>
            <button
              onClick={handlePay}
              className="flex-1 rounded-xl bg-slate-900 p-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div role="status" aria-live="polite" className="flex-1 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border-2 border-emerald-100 shadow-md mb-5 motion-safe:animate-bounce">
            <Check size={32} strokeWidth={3} />
          </div>

          <h3 className="text-xl font-black text-ink-900 tracking-tight">Booking Confirmed!</h3>
          <p className="mt-1.5 max-w-xs text-xs text-ink-500 font-medium leading-relaxed">
            Your flights, stays, and transit blocks are now marked booked. Reference: <strong className="text-ink-900">{bookingRef}</strong>.
          </p>

          <div className="mt-6 w-full rounded-2xl border border-line bg-paper-2 p-4 text-left shadow-2xs flex flex-col gap-1.5 text-xs font-semibold text-ink-700">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-emerald-600 font-bold">Successfully Booked</span>
            </div>
            <div className="flex justify-between border-t border-line pt-1.5">
              <span>Details:</span>
              <span className="text-ink-900">Available in your Wallet</span>
            </div>
            <div className="flex justify-between">
              <span>Travel Date:</span>
              <span className="text-ink-900">{planData.cities[0]?.dateRange?.split(' to ')[0] || 'Upcoming'}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-8 w-full rounded-xl bg-ink-900 p-3 text-xs font-bold text-white shadow-md hover:opacity-90 transition-opacity cursor-pointer"
          >
            Go Back to Workspace
          </button>
        </div>
      )}
    </div>
  );
}
