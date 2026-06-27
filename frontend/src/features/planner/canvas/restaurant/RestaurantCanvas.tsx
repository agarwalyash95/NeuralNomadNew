'use client';

import React, { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { StandardCanvas, CanvasSearchBar, ResultCard, AddToTripButton, EmptyCanvasState } from '../shared/StandardCanvas';

const MOCK_RESTAURANTS = [
  { id: '1', name: 'Trishna', cuisine: 'Seafood', location: 'Fort, Mumbai', price: '₹₹₹', rating: 4.7, type: 'Fine Dining', recommended: true, reason: 'Legendary seafood, must-visit for food lovers' },
  { id: '2', name: 'Leopold Cafe', cuisine: 'Multi-Cuisine', location: 'Colaba, Mumbai', price: '₹₹', rating: 4.1, type: 'Casual', recommended: false },
  { id: '3', name: 'Bastian', cuisine: 'Asian', location: 'Bandra, Mumbai', price: '₹₹₹₹', rating: 4.5, type: 'Fine Dining', recommended: false },
  { id: '4', name: 'Bademiya', cuisine: 'Street Food', location: 'Colaba, Mumbai', price: '₹', rating: 4.3, type: 'Street Food', recommended: false },
];

export default function RestaurantCanvas({ workspaceId }: { workspaceId: string }) {
  const [search, setSearch] = useState('');
  const filtered = MOCK_RESTAURANTS.filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.cuisine.toLowerCase().includes(search.toLowerCase()));

  return (
    <StandardCanvas canvasType="restaurant" searchBar={<CanvasSearchBar canvasType="restaurant" placeholder="Search restaurants, cuisines..." value={search} onChange={setSearch} />}>
      {filtered.length === 0 ? (
        <EmptyCanvasState icon={<UtensilsCrossed size={20} className="text-rose-500" />} title="No restaurants found" description="Discover dining options for your trip." />
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <ResultCard key={r.id} canvasType="restaurant" title={r.name} subtitle={`${r.cuisine} · ${r.location} · ${r.type}`} price={r.price} rating={r.rating} tags={[r.cuisine, r.type]} isRecommended={r.recommended} reason={r.reason}>
              <AddToTripButton canvasType="restaurant" label="Add to Itinerary" />
            </ResultCard>
          ))}
        </div>
      )}
    </StandardCanvas>
  );
}
