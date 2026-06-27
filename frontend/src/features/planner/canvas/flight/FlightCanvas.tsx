'use client';

import React, { useState } from 'react';
import { Plane, Clock, ArrowRight } from 'lucide-react';
import { StandardCanvas, CanvasSearchBar, ResultCard, AddToTripButton, EmptyCanvasState } from '../shared/StandardCanvas';

// Mock flight data for demonstration
const MOCK_FLIGHTS = [
  { id: '1', airline: 'IndiGo', code: '6E 2345', from: 'DEL', to: 'BOM', price: '₹4,200', duration: '2h 10m', stops: 'Nonstop', time: '06:30 → 08:40', rating: 4.2, recommended: true, reason: 'Best value with shortest travel time' },
  { id: '2', airline: 'Air India', code: 'AI 865', from: 'DEL', to: 'BOM', price: '₹5,100', duration: '2h 15m', stops: 'Nonstop', time: '09:00 → 11:15', rating: 3.8, recommended: false },
  { id: '3', airline: 'Vistara', code: 'UK 944', from: 'DEL', to: 'BOM', price: '₹6,800', duration: '2h 05m', stops: 'Nonstop', time: '14:30 → 16:35', rating: 4.5, recommended: false },
  { id: '4', airline: 'SpiceJet', code: 'SG 158', from: 'DEL', to: 'BOM', price: '₹3,600', duration: '4h 30m', stops: '1 Stop', time: '07:15 → 11:45', rating: 3.5, recommended: false },
];

interface FlightCanvasProps {
  workspaceId: string;
}

export default function FlightCanvas({ workspaceId }: FlightCanvasProps) {
  const [search, setSearch] = useState('');

  const filtered = MOCK_FLIGHTS.filter((f) =>
    !search || f.airline.toLowerCase().includes(search.toLowerCase()) ||
    f.from.toLowerCase().includes(search.toLowerCase()) ||
    f.to.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <StandardCanvas
      canvasType="flight"
      searchBar={
        <CanvasSearchBar
          canvasType="flight"
          placeholder="Search flights by airline, city..."
          value={search}
          onChange={setSearch}
        />
      }
    >
      {filtered.length === 0 ? (
        <EmptyCanvasState
          icon={<Plane size={20} className="text-blue-500" />}
          title="No flights found"
          description="Try searching for a different route or adjusting your dates."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((flight) => (
            <ResultCard
              key={flight.id}
              canvasType="flight"
              title={`${flight.airline} ${flight.code}`}
              subtitle={`${flight.from} → ${flight.to} · ${flight.stops} · ${flight.duration}`}
              price={flight.price}
              rating={flight.rating}
              tags={[flight.time, flight.stops]}
              isRecommended={flight.recommended}
              reason={flight.reason}
            >
              <AddToTripButton canvasType="flight" />
            </ResultCard>
          ))}
        </div>
      )}
    </StandardCanvas>
  );
}
