'use client';

import { useState } from 'react';
import { Banknote, Stamp } from 'lucide-react';
import ForexTab from '@/components/travel-prep/forex/ForexTab';
import VisaTab from '@/components/travel-prep/visa/VisaTab';

type ActiveTab = 'forex' | 'visa';

export default function TravelPrepPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('forex');

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 pt-28 pb-20 px-4">
      <div className="mx-auto max-w-5xl">

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Travel Preparation
          </h1>
          <p className="mt-1.5 text-slate-500 text-sm max-w-xl">
            Everything you need before you fly — currency exchange and visa requirements in one place.
          </p>
        </div>

        {/* Secondary Navbar */}
        <div className="mb-8 flex gap-3 rounded-2xl bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm p-2">
          <button
            onClick={() => setActiveTab('forex')}
            className={`flex flex-1 items-center justify-center gap-3 rounded-xl py-4 px-6 text-base font-semibold transition-all duration-200 ${
              activeTab === 'forex'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            <Banknote size={20} />
            Foreign Exchange
          </button>
          <button
            onClick={() => setActiveTab('visa')}
            className={`flex flex-1 items-center justify-center gap-3 rounded-xl py-4 px-6 text-base font-semibold transition-all duration-200 ${
              activeTab === 'visa'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
            }`}
          >
            <Stamp size={20} />
            Visa Requirements
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'forex' && <ForexTab />}
          {activeTab === 'visa' && <VisaTab />}
        </div>

      </div>
    </main>
  );
}
