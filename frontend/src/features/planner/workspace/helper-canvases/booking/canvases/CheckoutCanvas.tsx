'use client';

import React, { useState } from 'react';
import { X, CreditCard, Check, Loader2, ShieldCheck, Building, Plane, Car } from 'lucide-react';
import { MockTripData } from '../../../plan-canvas/types';
import { parsePriceToInteger } from '../../../plan-canvas/utils/priceParser';
import PassengerDetailsForm from '../forms/PassengerDetailsForm';
 
interface CheckoutCanvasProps {
  planData: MockTripData;
  workspaceId?: string | null;
  onClose: () => void;
  /** Must actually perform the booking and throw on failure — checkout only shows success once this resolves. */
  onConfirmBooking: () => Promise<void>;
}

type CheckoutStep = 'summary' | 'processing' | 'success' | 'error';

export default function CheckoutCanvas({ planData, workspaceId, onClose, onConfirmBooking }: CheckoutCanvasProps) {
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [errorMessage, setErrorMessage] = useState('');
  // A booking reference derived from the real trip id — never a fabricated,
  // identical-for-everyone string. Honest about what it is: a reference to
  // find this booking in Your Wallet, not an airline/rail PNR.
  const bookingRef = `NN-${(workspaceId || 'TRIP').replace(/-/g, '').slice(-8).toUpperCase()}`;
 
  // 1. Gather bookings from active trip planData
  const hotels: any[] = [];
  const transits: any[] = [];
  let totalCost = 0;
 
  // Extract travelersCount
  let travelersCount = 1;
  const travelersMatch = planData?.stats?.match(/(\d+)\s+traveller/i);
  if (travelersMatch && travelersMatch[1]) {
    travelersCount = parseInt(travelersMatch[1], 10) || 1;
  }
 
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
    email.trim() !== '' &&
    phone.trim() !== '' &&
    passengers.every(p => p.name?.trim() !== '' && p.age?.trim() !== '');
 
  if (planData?.cities) {
    planData.cities.forEach(city => {
      // Check city-to-city transit
      if (city.transitToNext && !city.transitToNext.isInactive && city.transitToNext.price) {
        const val = parsePriceToInteger(city.transitToNext.price);
        totalCost += val;
        transits.push({
          title: city.transitToNext.title,
          subtitle: city.transitToNext.subtitle || 'Transit Connection',
          price: city.transitToNext.price,
          type: city.transitToNext.type,
        });
      }
 
      // Check daily itinerary items
      city.days.forEach(day => {
        day.items.forEach(item => {
          if (!item.isInactive && item.price) {
            const val = parsePriceToInteger(item.price);
            totalCost += val;
            if (item.type === 'hotel') {
              hotels.push({
                ...item,
                cityName: city.cityName,
                dayNumber: day.dayNumber
              });
            } else if (['flight', 'train', 'bus', 'cab', 'taxi', 'transit'].includes(item.type)) {
              transits.push({
                ...item,
                cityName: city.cityName,
                dayNumber: day.dayNumber
              });
            }
          }
        });
      });
    });
  }
 
  const hasItems = hotels.length > 0 || transits.length > 0;
  const platformFee = hasItems ? 250 : 0;
  const tax = Math.round(totalCost * 0.05); // 5% mock GST
  const grandTotal = totalCost + platformFee + tax;
 
  const handlePay = async () => {
    setStep('processing');
    setErrorMessage('');
    try {
      // The real, server-authoritative booking call — success is only shown
      // once this has actually happened, never on a fixed timer.
      await onConfirmBooking();
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
          <h3 className="text-lg font-black uppercase tracking-wider text-slate-900">Checkout OS</h3>
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
              <span className="text-3xl mb-3">🛒</span>
              <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Cart is empty</h4>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                Configure stays, flights, or transit options in your timeline first. Once selected, confirmed items will list here for single-click payment checkouts.
              </p>
            </div>
          ) : (
            <>
              {/* Item lists */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">Booking Items</span>
                
                {/* 1. Accommodations */}
                {hotels.map((h, i) => (
                  <div key={`hotel-${i}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                      <Building size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-xs font-bold text-slate-900 truncate">{h.title}</h5>
                        <span className="text-xs font-black text-slate-800 shrink-0">{h.price}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">Stay • {h.cityName} (Day {h.dayNumber})</p>
                    </div>
                  </div>
                ))}
 
                {/* 2. Transits */}
                {transits.map((t, i) => (
                  <div key={`transit-${i}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                      {t.type === 'flight' ? <Plane size={16} /> : <Car size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-xs font-bold text-slate-900 truncate">{t.title}</h5>
                        <span className="text-xs font-black text-slate-800 shrink-0">{t.price}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">Transit • {t.subtitle}</p>
                    </div>
                  </div>
                ))}
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
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Base Bookings Cost:</span>
                  <span className="text-slate-800">₹{totalCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>GST & Service Taxes (5%):</span>
                  <span className="text-slate-800">₹{tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Nomadic Booking Fee:</span>
                  <span className="text-slate-800">₹{platformFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-black text-slate-950">
                  <span>Total Amount:</span>
                  <span className="text-blue-600">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>
 
              {/* Payment selection */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between text-xs font-bold text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-base">💳</span>
                  <span>UPI / NetBanking / Cards</span>
                </div>
                <span className="text-[9px] uppercase font-black text-blue-600 tracking-wider bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
                  1-Click Select
                </span>
              </div>
 
              {/* Security Shield badge */}
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold justify-center">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>PCI-DSS Compliant Secure Encrypted Connection</span>
              </div>
 
              {/* Checkout Button */}
              <button
                onClick={handlePay}
                disabled={!isFormValid}
                className="mt-auto rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-3.5 text-sm font-black text-white shadow-md hover:scale-[1.01] hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CreditCard size={16} />
                Pay & Confirm All Booking (₹{grandTotal.toLocaleString()})
              </button>
            </>
          )}
        </div>
      )}
 
      {step === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest animate-pulse">
            Confirming Your Booking
          </h4>
          <p className="mt-1 text-xs text-slate-400 font-medium">
            Talking to NeuralNomad's booking service — this usually takes a few seconds.
          </p>
        </div>
      )}

      {step === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600 border-2 border-red-100 shadow-md mb-5">
            <X size={32} strokeWidth={3} />
          </div>

          <h3 className="text-xl font-black text-slate-900 tracking-tight">Booking didn't go through</h3>
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
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border-2 border-emerald-100 shadow-md mb-5 animate-bounce">
            <Check size={32} strokeWidth={3} />
          </div>

          <h3 className="text-xl font-black text-slate-900 tracking-tight">Booking Confirmed!</h3>
          <p className="mt-1.5 max-w-xs text-xs text-slate-500 font-medium leading-relaxed">
            Your flights, stays, and transit blocks are now marked booked. Reference: <strong className="text-slate-800">{bookingRef}</strong>.
          </p>

          <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xs flex flex-col gap-1.5 text-xs font-semibold text-slate-600">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-emerald-600 font-bold">Successfully Booked</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1.5">
              <span>Details:</span>
              <span className="text-slate-800">Available in your Wallet</span>
            </div>
            <div className="flex justify-between">
              <span>Travel Date:</span>
              <span className="text-slate-800">{planData.cities[0]?.dateRange?.split(' to ')[0] || 'Upcoming'}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-8 w-full rounded-xl bg-slate-900 p-3 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Go Back to Workspace
          </button>
        </div>
      )}
    </div>
  );
}
