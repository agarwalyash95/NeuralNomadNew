'use client';

import React, { useState } from 'react';
import GlassCard from '@/components/ui-custom/glass-card';
import { useBookings } from '@/hooks/use-bookings';
import { Booking } from '@/types/booking';
import { Plane, Train, Bus, Hotel, Car, Calendar, MapPin, CheckCircle2, XCircle, CreditCard, Clock } from 'lucide-react';

type Tab = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export default function VaultBookingsPage() {
  const { bookings, loading, error, bookOption, cancelOption, actionBookingId } = useBookings();
  const [activeTab, setActiveTab] = useState<Tab>('confirmed');

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');
  
  const completedBookings = bookings.filter((b) => {
    if (b.status === 'completed') return true;
    if (b.status === 'confirmed') {
      const startDate = new Date(b.start_date);
      startDate.setHours(0, 0, 0, 0);
      return startDate < now;
    }
    return false;
  });

  const confirmedBookings = bookings.filter((b) => {
    if (b.status === 'confirmed') {
      const startDate = new Date(b.start_date);
      startDate.setHours(0, 0, 0, 0);
      return startDate >= now;
    }
    return false;
  });

  const getActiveBookings = () => {
    switch (activeTab) {
      case 'pending': return pendingBookings;
      case 'confirmed': return confirmedBookings;
      case 'completed': return completedBookings;
      case 'cancelled': return cancelledBookings;
      default: return [];
    }
  };

  const currentList = getActiveBookings();

  const getIcon = (type: string) => {
    switch (type) {
      case 'flight': return <Plane size={24} />;
      case 'train': return <Train size={24} />;
      case 'bus': return <Bus size={24} />;
      case 'hotel': return <Hotel size={24} />;
      case 'cab': return <Car size={24} />;
      default: return <Calendar size={24} />;
    }
  };

  const renderDetails = (booking: Booking) => {
    const { details, booking_type } = booking;
    if (!details) return null;

    if (booking_type === 'flight') {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-slate-700">
            <span className="font-bold text-lg">{details.origin}</span>
            <div className="flex-1 border-t-2 border-dashed border-slate-300 relative mx-2">
              <Plane size={16} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-400 rotate-90" />
            </div>
            <span className="font-bold text-lg">{details.destination}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
            <div>
              <p className="text-slate-500">Flight</p>
              <p className="font-medium">{details.flight_number}</p>
            </div>
            <div>
              <p className="text-slate-500">Class</p>
              <p className="font-medium">{details.class || 'Economy'}</p>
            </div>
          </div>
        </div>
      );
    }

    if (booking_type === 'hotel') {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2 text-slate-700">
            <MapPin size={18} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="font-medium line-clamp-2">{details.address || details.city}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
            <div>
              <p className="text-slate-500">Room</p>
              <p className="font-medium">{details.room_type}</p>
            </div>
            <div>
              <p className="text-slate-500">Guests</p>
              <p className="font-medium">{details.guests}</p>
            </div>
          </div>
        </div>
      );
    }

    if (booking_type === 'train') {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 text-slate-700">
            <span className="font-bold text-lg">{details.from}</span>
            <div className="flex-1 border-t-2 border-dashed border-slate-300 relative mx-2">
              <Train size={16} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <span className="font-bold text-lg">{details.to}</span>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
            <div>
              <p className="text-slate-500">Train</p>
              <p className="font-medium">{details.train_name} ({details.train_number})</p>
            </div>
            <div>
              <p className="text-slate-500">Class</p>
              <p className="font-medium">{details.class}</p>
            </div>
          </div>
        </div>
      );
    }

    if (booking_type === 'cab') {
      return (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 text-slate-700">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
              <p className="font-medium text-sm">{details.pickup}</p>
            </div>
            <div className="border-l-2 border-dashed border-slate-200 ml-1 h-4"></div>
            <div className="flex items-start gap-2 text-slate-700">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
              <p className="font-medium text-sm">{details.dropoff || details.drop}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-1 text-sm">
            <div>
              <p className="text-slate-500">Car Type</p>
              <p className="font-medium">{details.car_type}</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
        {JSON.stringify(details, null, 2)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-200">
        <div className="flex space-x-8 min-w-max px-1">
          {[
            { id: 'pending', label: 'Pending', count: pendingBookings.length },
            { id: 'confirmed', label: 'Confirmed', count: confirmedBookings.length },
            { id: 'completed', label: 'Completed', count: completedBookings.length },
            { id: 'cancelled', label: 'Cancelled', count: cancelledBookings.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`
                relative py-4 text-sm font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-900'}
              `}
            >
              <span className="flex items-center gap-2">
                {tab.label}
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                  {tab.count}
                </span>
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 font-medium">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500 font-medium">Loading your bookings...</div>
      ) : currentList.length === 0 ? (
        <div className="py-16 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Calendar size={32} className="text-slate-400" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No {activeTab} bookings</h3>
          <p className="text-slate-500 mt-2">You don&apos;t have any {activeTab} travel plans right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {currentList.map((booking) => (
            <GlassCard 
              key={booking.id} 
              className={`flex flex-col h-full transition-all hover:shadow-md ${activeTab === 'cancelled' ? 'border-red-100 bg-red-50/10' : ''}`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${activeTab === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                    {getIcon(booking.booking_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-slate-900 text-lg leading-tight">{booking.provider}</h3>
                      {/* Honest source tag — this row came from a trip's own
                          commitment ladder (reserved, no payment collected),
                          not the direct booking/payment flow. */}
                      {booking.source === 'trip_planner' && (
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                          From your trip
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5 tracking-wide uppercase">
                      {booking.reference_number}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-slate-900">
                    {booking.currency === 'INR' ? '₹' : booking.currency} {booking.amount}
                  </p>
                  {activeTab === 'cancelled' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 mt-1 uppercase tracking-wide">
                      <XCircle size={12} />
                      Cancelled
                    </span>
                  ) : activeTab === 'completed' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 mt-1 uppercase tracking-wide">
                      <CheckCircle2 size={12} />
                      Completed
                    </span>
                  ) : activeTab === 'pending' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 mt-1 uppercase tracking-wide">
                      <Clock size={12} />
                      Pending
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 mt-1 uppercase tracking-wide">
                      <CheckCircle2 size={12} />
                      Confirmed
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body - Dynamic Details */}
              <div className="flex-1 mb-6">
                <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-slate-900">
                  <Calendar size={16} className="text-slate-400" />
                  {new Date(booking.start_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  {booking.end_date && booking.end_date !== booking.start_date && (
                    <>
                      <span className="text-slate-300">-</span>
                      {new Date(booking.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </>
                  )}
                </div>
                
                {renderDetails(booking)}
              </div>

              {/* Card Footer - Actions */}
              {activeTab === 'pending' && (
                <div className="flex gap-3 pt-4 border-t border-slate-100 mt-auto">
                  <button 
                    onClick={() => cancelOption(booking.id)}
                    disabled={actionBookingId === booking.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Cancel Booking
                  </button>
                  <button 
                    onClick={() => bookOption(booking.id)}
                    disabled={actionBookingId === booking.id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-lg transition-all disabled:opacity-50"
                  >
                    <CreditCard size={16} />
                    {actionBookingId === booking.id ? 'Processing...' : 'Pay Now'}
                  </button>
                </div>
              )}

              {activeTab === 'confirmed' && booking.provider_booking_id && (
                <div className="pt-4 border-t border-slate-100 mt-auto">
                  <p className="text-xs text-slate-500 text-center">
                    Provider ID: <span className="font-semibold text-slate-700">{booking.provider_booking_id}</span>
                  </p>
                </div>
              )}
              
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
