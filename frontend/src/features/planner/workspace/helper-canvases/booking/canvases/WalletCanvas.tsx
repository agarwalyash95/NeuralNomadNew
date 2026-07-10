'use client';

import React, { useState } from 'react';
import { X, Plane, Building, QrCode } from 'lucide-react';
import { MockTripData } from '../../../plan-canvas/types';

interface WalletCanvasProps {
  planData: MockTripData;
  onClose: () => void;
}

export default function WalletCanvas({ planData, onClose }: WalletCanvasProps) {
  const [activePassId, setActivePassId] = useState<string | null>(null);

  // A per-item booking reference derived from the item's own real id —
  // never a single fabricated string shared by every item of a type.
  const refFor = (id: string) => `NN-${id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || '000000'}`;

  // 1. Gather all booked items
  const passes: any[] = [];

  if (planData?.cities) {
    planData.cities.forEach(city => {
      if (city.transitToNext && city.transitToNext.status === 'Confirmed') {
        passes.push({
          id: city.transitToNext.id,
          type: city.transitToNext.type,
          title: city.transitToNext.title,
          subtitle: city.transitToNext.subtitle || 'Airport Transfer',
          pnr: refFor(city.transitToNext.id),
          details: city.transitToNext.details || 'Confirmed',
          price: city.transitToNext.price || 'Included',
          date: 'Day 1 connect',
          city: city.cityName,
        });
      }

      city.days.forEach(day => {
        day.items.forEach(item => {
          if (item.status === 'Confirmed') {
            if (item.type === 'hotel') {
              passes.push({
                id: item.id,
                type: 'hotel',
                title: item.title,
                subtitle: `Stay • Day ${day.dayNumber} check-in`,
                pnr: refFor(item.id),
                room: item.subtitle || 'Room details in confirmation',
                checkIn: item.startTime || 'See confirmation',
                checkOut: item.endTime || 'See confirmation',
                details: item.details || 'Confirmed stay',
                price: item.price || 'Included',
                date: day.dateStr,
                city: city.cityName,
              });
            } else if (['flight', 'train', 'bus', 'cab', 'taxi', 'transit'].includes(item.type)) {
              passes.push({
                id: item.id,
                type: item.type,
                title: item.title,
                subtitle: item.subtitle || 'Transit Connect',
                pnr: refFor(item.id),
                gate: 'See confirmation email',
                seat: 'Assigned at check-in',
                details: item.details || 'Confirmed',
                price: item.price || 'Included',
                date: day.dateStr,
                city: city.cityName,
              });
            }
          }
        });
      });
    });
  }

  return (
    <div className="flex h-full w-full flex-col bg-paper-1 p-4 lg:p-6 select-none overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎟️</span>
          <h3 className="text-lg font-black uppercase tracking-wider text-slate-900">Travel Wallet</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {passes.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4 bg-white rounded-2xl border border-slate-200">
            <span className="text-3xl mb-3">🎫</span>
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">No Active Passes</h4>
            <p className="mt-1 max-w-xs text-xs text-slate-400">
              Confirm your bookings via checkout first! Booked flights, hotel reservations, and cab tickets will display here as active passes.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block px-1">
              Active Vouchers ({passes.length})
            </span>

            {passes.map((pass) => {
              const isExpanded = activePassId === pass.id;
              const isHotel = pass.type === 'hotel';

              return (
                <div
                  key={pass.id}
                  onClick={() => setActivePassId(isExpanded ? null : pass.id)}
                  className={`relative rounded-2xl border overflow-hidden cursor-pointer shadow-xs transition-all duration-300 ${
                    isExpanded 
                      ? 'border-indigo-400 bg-white ring-2 ring-indigo-500/10' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Top Bar: Ticket Theme Color depending on type */}
                  <div className={`h-1.5 w-full ${isHotel ? 'bg-indigo-600' : 'bg-blue-600'}`} />

                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isHotel ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                          {isHotel ? <Building size={16} /> : <Plane size={16} />}
                        </div>
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-900 truncate max-w-[180px]">{pass.title}</h4>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{pass.subtitle}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Booking Ref</span>
                        <h5 className="text-xs font-black text-slate-950 mt-0.5">{pass.pnr}</h5>
                      </div>
                    </div>

                    {/* Details row */}
                    <div className="grid grid-cols-3 gap-2 border-t border-dashed border-slate-100 pt-3 text-left">
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-400 tracking-wider">Date / Day</span>
                        <p className="text-[10px] font-bold text-slate-700 mt-0.5 truncate">{pass.date}</p>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-400 tracking-wider">{isHotel ? 'Check-In' : 'Gate / Platform'}</span>
                        <p className="text-[10px] font-bold text-slate-700 mt-0.5 truncate">{isHotel ? pass.checkIn : pass.gate}</p>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-400 tracking-wider">{isHotel ? 'Room Class' : 'Seat Allocation'}</span>
                        <p className="text-[10px] font-bold text-slate-700 mt-0.5 truncate">{isHotel ? pass.room : pass.seat}</p>
                      </div>
                    </div>

                    {/* QR Code and check-in summary when clicked */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 pt-4 mt-1 flex flex-col items-center gap-3 bg-slate-50/50 rounded-xl p-3 animate-slide-down">
                        {/* Barcode/QR Mockup */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-3xs flex flex-col items-center gap-1.5">
                          <QrCode className="text-slate-800" size={80} strokeWidth={1.5} />
                          <span className="text-[8px] font-bold tracking-widest text-slate-400 uppercase">{pass.pnr}-{pass.id.substring(0, 4).toUpperCase()}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold max-w-[200px] text-center">
                          Show this QR code at checkout counter or airport check-in gate for boarding.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
