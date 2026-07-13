import React from 'react';

interface Passenger {
  name: string;
  age: string;
  gender: string;
}

interface PassengerDetailsFormProps {
  travelersCount: number;
  passengers: Passenger[];
  onChange: (index: number, field: keyof Passenger, value: string) => void;
  email: string;
  setEmail: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
}

export default function PassengerDetailsForm({
  travelersCount,
  passengers,
  onChange,
  email,
  setEmail,
  phone,
  setPhone,
}: PassengerDetailsFormProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-3.5 shadow-surface">
      <div className="border-b border-line pb-1.5">
        <h4 className="text-xs font-black uppercase tracking-wider text-ink-700">Contact Details</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-line p-2 text-xs text-ink-800 placeholder-ink-400 focus:border-[rgb(var(--color-booking))] focus:ring-1 focus:ring-[rgb(var(--color-booking))] focus:outline-none transition-colors"
            required
            placeholder="passenger@example.com"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-line p-2 text-xs text-ink-800 placeholder-ink-400 focus:border-[rgb(var(--color-booking))] focus:ring-1 focus:ring-[rgb(var(--color-booking))] focus:outline-none transition-colors"
            required
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      <div className="border-b border-line pb-1.5">
        <h4 className="text-xs font-black uppercase tracking-wider text-ink-700">Passenger Information</h4>
      </div>
      <div className="space-y-2">
        {Array.from({ length: travelersCount }).map((_, idx) => (
          <div key={idx} className="space-y-1.5 rounded-xl bg-paper-0 p-2.5 border border-line">
            <p className="text-[10px] font-black uppercase tracking-wider text-ink-400">
              Passenger #{idx + 1}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={passengers[idx]?.name || ''}
                  onChange={(e) => onChange(idx, 'name', e.target.value)}
                  className="w-full rounded-xl border border-line p-2 text-xs text-ink-800 placeholder-ink-400 focus:border-[rgb(var(--color-booking))] focus:outline-none bg-white transition-colors"
                  required
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Age"
                  value={passengers[idx]?.age || ''}
                  onChange={(e) => onChange(idx, 'age', e.target.value)}
                  className="w-full rounded-xl border border-line p-2 text-xs text-ink-800 placeholder-ink-400 focus:border-[rgb(var(--color-booking))] focus:outline-none bg-white transition-colors"
                  required
                  min="0"
                  max="120"
                />
                <select
                  value={passengers[idx]?.gender || 'Male'}
                  onChange={(e) => onChange(idx, 'gender', e.target.value)}
                  className="w-full rounded-xl border border-line p-2 text-xs text-ink-800 focus:border-[rgb(var(--color-booking))] focus:outline-none bg-white transition-colors"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
