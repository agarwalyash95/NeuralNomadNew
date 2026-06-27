'use client';

import React, { useState } from 'react';
import { Hotel, Star, Wifi, Car, Coffee } from 'lucide-react';
import { StandardCanvas, CanvasSearchBar, ResultCard, AddToTripButton, EmptyCanvasState } from '../shared/StandardCanvas';

const MOCK_HOTELS = [
  { id: '1', name: 'Taj Mahal Palace', stars: 5, price: '₹18,500', rating: 4.8, location: 'Colaba, Mumbai', amenities: ['Pool', 'Spa', 'Breakfast', 'WiFi'], recommended: true, reason: 'Best rated luxury hotel near your attractions' },
  { id: '2', name: 'ITC Maratha', stars: 5, price: '₹14,200', rating: 4.6, location: 'Andheri East, Mumbai', amenities: ['Pool', 'Gym', 'Breakfast'], recommended: false },
  { id: '3', name: 'Trident Nariman Point', stars: 5, price: '₹12,800', rating: 4.5, location: 'Nariman Point, Mumbai', amenities: ['Sea View', 'Spa', 'WiFi'], recommended: false },
  { id: '4', name: 'Hotel Bawa Regency', stars: 3, price: '₹4,200', rating: 3.9, location: 'Juhu, Mumbai', amenities: ['WiFi', 'Breakfast'], recommended: false },
];

interface HotelCanvasProps {
  workspaceId: string;
}

export default function HotelCanvas({ workspaceId }: HotelCanvasProps) {
  const [search, setSearch] = useState('');

  const filtered = MOCK_HOTELS.filter((h) =>
    !search || h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.location.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <StandardCanvas
      canvasType="hotel"
      searchBar={
        <CanvasSearchBar
          canvasType="hotel"
          placeholder="Search hotels by name, area..."
          value={search}
          onChange={setSearch}
        />
      }
    >
      {filtered.length === 0 ? (
        <EmptyCanvasState
          icon={<Hotel size={20} className="text-violet-500" />}
          title="No hotels found"
          description="Try different search terms or adjust your filters."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((hotel) => (
            <ResultCard
              key={hotel.id}
              canvasType="hotel"
              title={hotel.name}
              subtitle={`${'★'.repeat(hotel.stars)} · ${hotel.location}`}
              price={hotel.price + '/night'}
              rating={hotel.rating}
              tags={hotel.amenities}
              isRecommended={hotel.recommended}
              reason={hotel.reason}
            >
              <AddToTripButton canvasType="hotel" />
            </ResultCard>
          ))}
        </div>
      )}
    </StandardCanvas>
  );
}
