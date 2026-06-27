'use client';

import React from 'react';
import { Car, MapPin } from 'lucide-react';
import { StandardCanvas, EmptyCanvasState } from '../shared/StandardCanvas';

export default function CabCanvas({ workspaceId }: { workspaceId: string }) {
  return (
    <StandardCanvas canvasType="cab">
      <EmptyCanvasState
        icon={<Car size={20} className="text-emerald-500" />}
        title="Cab bookings"
        description="Airport transfers and local rides will appear here based on your itinerary."
      />
      <div className="space-y-2 mt-4">
        {[
          { type: 'Airport Transfer', desc: 'Airport → Hotel', price: '₹800', provider: 'Uber' },
          { type: 'Local Sightseeing', desc: '8 hours package', price: '₹2,500', provider: 'Ola' },
        ].map((cab, i) => (
          <div key={i} className="p-3 rounded-xl bg-white/60 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-700/30">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{cab.type}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">{cab.desc} · {cab.provider}</p>
              </div>
              <span className="text-sm font-bold text-emerald-600">{cab.price}</span>
            </div>
          </div>
        ))}
      </div>
    </StandardCanvas>
  );
}
