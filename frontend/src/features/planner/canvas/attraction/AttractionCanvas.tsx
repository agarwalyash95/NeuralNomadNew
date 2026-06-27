'use client';

import React, { useState } from 'react';
import { Landmark } from 'lucide-react';
import { StandardCanvas, CanvasSearchBar, ResultCard, AddToTripButton, EmptyCanvasState } from '../shared/StandardCanvas';

const MOCK_ATTRACTIONS = [
  { id: '1', name: 'Gateway of India', category: 'Monument', location: 'Colaba, Mumbai', price: 'Free', rating: 4.5, duration: '1h', recommended: true, reason: 'Iconic landmark, 5 min walk from your hotel' },
  { id: '2', name: 'Elephanta Caves', category: 'Heritage', location: 'Elephanta Island', price: '₹40', rating: 4.3, duration: '3h', recommended: false },
  { id: '3', name: 'Marine Drive', category: 'Scenic', location: 'Churchgate, Mumbai', price: 'Free', rating: 4.6, duration: '1.5h', recommended: false },
  { id: '4', name: 'Siddhivinayak Temple', category: 'Religious', location: 'Prabhadevi, Mumbai', price: 'Free', rating: 4.7, duration: '1h', recommended: false },
];

export default function AttractionCanvas({ workspaceId }: { workspaceId: string }) {
  const [search, setSearch] = useState('');
  const filtered = MOCK_ATTRACTIONS.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <StandardCanvas canvasType="attraction" searchBar={<CanvasSearchBar canvasType="attraction" placeholder="Search attractions..." value={search} onChange={setSearch} />}>
      {filtered.length === 0 ? (
        <EmptyCanvasState icon={<Landmark size={20} className="text-orange-500" />} title="No attractions found" description="Search for landmarks, museums, temples, and more." />
      ) : (
        <div className="space-y-2">
          {filtered.map((attr) => (
            <ResultCard key={attr.id} canvasType="attraction" title={attr.name} subtitle={`${attr.category} · ${attr.location} · ${attr.duration}`} price={attr.price} rating={attr.rating} isRecommended={attr.recommended} reason={attr.reason}>
              <AddToTripButton canvasType="attraction" label="Add to Itinerary" />
            </ResultCard>
          ))}
        </div>
      )}
    </StandardCanvas>
  );
}
