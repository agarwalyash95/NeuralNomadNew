'use client';

import React, { useState } from 'react';
import { Bus } from 'lucide-react';
import { StandardCanvas, CanvasSearchBar, ResultCard, AddToTripButton, EmptyCanvasState } from '../shared/StandardCanvas';

const MOCK_BUSES = [
  { id: '1', operator: 'VRL Travels', type: 'AC Sleeper', from: 'Bangalore', to: 'Goa', price: '₹1,200', duration: '10h', departs: '21:00', rating: 4.1, recommended: true, reason: 'Most popular overnight bus with best reviews' },
  { id: '2', operator: 'Orange Tours', type: 'Multi-Axle Volvo', from: 'Bangalore', to: 'Goa', price: '₹1,500', duration: '9h 30m', departs: '22:00', rating: 4.3, recommended: false },
  { id: '3', operator: 'SRS Travels', type: 'Non-AC Seater', from: 'Bangalore', to: 'Goa', price: '₹650', duration: '11h', departs: '20:30', rating: 3.6, recommended: false },
];

export default function BusCanvas({ workspaceId }: { workspaceId: string }) {
  const [search, setSearch] = useState('');
  const filtered = MOCK_BUSES.filter((b) => !search || b.operator.toLowerCase().includes(search.toLowerCase()));

  return (
    <StandardCanvas canvasType="bus" searchBar={<CanvasSearchBar canvasType="bus" placeholder="Search buses..." value={search} onChange={setSearch} />}>
      {filtered.length === 0 ? (
        <EmptyCanvasState icon={<Bus size={20} className="text-amber-500" />} title="No buses found" description="Try different routes or dates." />
      ) : (
        <div className="space-y-2">
          {filtered.map((bus) => (
            <ResultCard key={bus.id} canvasType="bus" title={bus.operator} subtitle={`${bus.type} · ${bus.from} → ${bus.to} · ${bus.duration}`} price={bus.price} rating={bus.rating} tags={[bus.type, `Departs ${bus.departs}`]} isRecommended={bus.recommended} reason={bus.reason}>
              <AddToTripButton canvasType="bus" />
            </ResultCard>
          ))}
        </div>
      )}
    </StandardCanvas>
  );
}
