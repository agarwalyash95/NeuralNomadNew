'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plane, Train, BedDouble, Bus, Car, MapPin, Clock, ArrowLeft } from 'lucide-react';
import AppShell from '@/components/ui-custom/app-shell';
import { useBookingSelectionStore } from '@/store/booking-selection.store';
import { bookingService } from '@/services/booking.service';
import { mapSearchResultToBooking } from '@/services/booking-mapper.service';
import { TrainMeta, HotelMeta } from '@/types/search';
import PassengerDetailsForm from '@/features/planner/workspace/helper-canvases/booking/forms/PassengerDetailsForm';
 
const serviceIcons: Record<string, React.ElementType> = {
  flight: Plane,
  train: Train,
  hotel: BedDouble,
  bus: Bus,
  cab: Car,
};
 
export default function BookNowPage() {
  const router = useRouter();
  const selected = useBookingSelectionStore((state) => state.selected);
  const clear = useBookingSelectionStore((state) => state.clear);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
 
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [passengers, setPassengers] = useState<any[]>([{ name: '', age: '', gender: 'Male' }]);
 
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
 
  if (!selected) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto mt-12 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-12 text-center">
          <p className="text-lg font-bold text-slate-500">No booking selected.</p>
          <button onClick={() => router.push('/bookings')} className="mt-4 text-blue-600 font-bold underline">Go back to search</button>
        </div>
      </AppShell>
    );
  }
 
  const ServiceIcon = serviceIcons[selected.service_type] || Plane;
  const isTrain = selected.service_type === 'train';
 
  const lowestProvider = selected.providers && selected.providers.length > 0
    ? [...selected.providers].sort((a, b) => a.price - b.price)[0]
    : null;
 
  const lowestTrainClass = isTrain && (selected.meta as TrainMeta).classes?.length > 0
    ? [...(selected.meta as TrainMeta).classes].sort((a, b) => a.price - b.price)[0]
    : null;
 
  const displayPrice = lowestProvider?.price ?? lowestTrainClass?.price ?? 0;
  const displayProvider = lowestProvider?.provider ?? 'IRCTC';
 
  async function confirmBooking() {
    if (!selected) return;
    try {
      setLoading(true);
      setError(null);
      const payload: any = mapSearchResultToBooking(selected, lowestProvider || undefined);
      payload.details = {
        ...payload.details,
        passengers,
        contact_email: email,
        contact_phone: phone,
      };
      await bookingService.createBooking(payload);
      clear();
      router.push('/booking-success');
    } catch (err: any) {
      setError(err?.message || 'Unable to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  }
 
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto py-10 px-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold mb-8 transition-colors">
          <ArrowLeft size={18} /> Back to results
        </button>
 
        <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <ServiceIcon size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black">{selected.title}</h1>
                <p className="text-blue-200 font-semibold">{selected.code}</p>
              </div>
            </div>
 
            {selected.service_type !== 'hotel' && (
              <div className="flex items-center gap-4 mt-6">
                <div>
                  <p className="text-3xl font-black">{selected.departure_time}</p>
                  <p className="text-blue-200 font-semibold mt-1">{selected.origin_city}</p>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <p className="text-xs text-blue-300 flex items-center gap-1"><Clock size={12}/> {selected.duration}</p>
                  <div className="w-full h-px bg-white/30 mt-1" />
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black">{selected.arrival_time}</p>
                  <p className="text-blue-200 font-semibold mt-1">{selected.destination_city}</p>
                </div>
              </div>
            )}
 
            {selected.service_type === 'hotel' && (
              <p className="mt-4 flex items-center gap-2 text-blue-100">
                <MapPin size={16} /> {selected.destination_city} • {(selected.meta as HotelMeta).address}
              </p>
            )}
          </div>
 
          {/* Details */}
          <div className="p-8 space-y-6">
            <div className="flex justify-between items-center py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Provider</p>
                <p className="text-lg font-black text-slate-800 mt-1">{displayProvider}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Price</p>
                <p className="text-3xl font-black text-green-600 mt-1">₹{displayPrice.toLocaleString('en-IN')}</p>
              </div>
            </div>
 
            {/* Passenger details form */}
            <PassengerDetailsForm
              travelersCount={1}
              passengers={passengers}
              onChange={handlePassengerChange}
              email={email}
              setEmail={setEmail}
              phone={phone}
              setPhone={setPhone}
            />
 
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold">
                {error}
              </div>
            )}
 
            <button
              onClick={confirmBooking}
              disabled={loading || !isFormValid}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-lg shadow-lg shadow-blue-500/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Creating Booking...' : 'Confirm Booking'}
            </button>
            <p className="text-center text-xs text-slate-400">By confirming, you agree to our Terms of Service</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
