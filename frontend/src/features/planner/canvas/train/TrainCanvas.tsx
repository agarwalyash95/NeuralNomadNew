'use client';

import React, { useState } from 'react';
import { TrainFront } from 'lucide-react';
import { StandardCanvas, CanvasSearchBar, ResultCard, AddToTripButton, EmptyCanvasState } from '../shared/StandardCanvas';

const MOCK_TRAINS = [
  { id: '1', name: 'Rajdhani Express', number: '12951', from: 'NDLS', to: 'BCT', price: '₹2,100', duration: '15h 50m', departs: '16:55', classes: '1A, 2A, 3A', recommended: true, reason: 'Fastest premium train on this route' },
  { id: '2', name: 'Shatabdi Express', number: '12009', from: 'NDLS', to: 'ADI', price: '₹1,350', duration: '6h 30m', departs: '06:15', classes: 'CC, EC', recommended: false },
  { id: '3', name: 'Duronto Express', number: '12267', from: 'NDLS', to: 'BCT', price: '₹1,800', duration: '17h 10m', departs: '23:00', classes: '2A, 3A, SL', recommended: false },
];

interface TrainCanvasProps {
  workspaceId: string;
}

export default function TrainCanvas({ workspaceId }: TrainCanvasProps) {
  const [search, setSearch] = useState('');

  const filtered = MOCK_TRAINS.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.number.includes(search)
  );

  return (
    <StandardCanvas
      canvasType="train"
      searchBar={
        <CanvasSearchBar
          canvasType="train"
          placeholder="Search trains by name, number..."
          value={search}
          onChange={setSearch}
        />
      }
    >
      {filtered.length === 0 ? (
        <EmptyCanvasState
          icon={<TrainFront size={20} className="text-orange-500" />}
          title="No trains found"
          description="Try different stations or dates."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((train) => (
            <ResultCard
              key={train.id}
              canvasType="train"
              title={`${train.name} (${train.number})`}
              subtitle={`${train.from} → ${train.to} · ${train.duration} · Departs ${train.departs}`}
              price={train.price}
              tags={train.classes.split(', ')}
              isRecommended={train.recommended}
              reason={train.reason}
            >
              <AddToTripButton canvasType="train" />
            </ResultCard>
          ))}
        </div>
      )}
    </StandardCanvas>
  );
}
