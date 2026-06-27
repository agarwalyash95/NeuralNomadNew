'use client';

import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { StandardCanvas, CanvasSearchBar, ResultCard, AddToTripButton, EmptyCanvasState } from '../shared/StandardCanvas';

const MOCK_ACTIVITIES = [
  { id: '1', name: 'Heritage Walking Tour', category: 'Culture', price: '₹1,200', duration: '3h', rating: 4.6, difficulty: 'Easy', recommended: true, reason: 'Highest rated experience for first-time visitors' },
  { id: '2', name: 'Street Food Trail', category: 'Food', price: '₹800', duration: '2.5h', rating: 4.8, difficulty: 'Easy', recommended: false },
  { id: '3', name: 'Bollywood Tour', category: 'Entertainment', price: '₹2,500', duration: '4h', rating: 4.2, difficulty: 'Easy', recommended: false },
  { id: '4', name: 'Dharavi Art Walk', category: 'Culture', price: '₹600', duration: '2h', rating: 4.4, difficulty: 'Easy', recommended: false },
];

export default function ActivityCanvas({ workspaceId }: { workspaceId: string }) {
  const [search, setSearch] = useState('');
  const filtered = MOCK_ACTIVITIES.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <StandardCanvas canvasType="activity" searchBar={<CanvasSearchBar canvasType="activity" placeholder="Search activities..." value={search} onChange={setSearch} />}>
      {filtered.length === 0 ? (
        <EmptyCanvasState icon={<Activity size={20} className="text-teal-500" />} title="No activities found" description="Discover experiences, tours, and things to do." />
      ) : (
        <div className="space-y-2">
          {filtered.map((act) => (
            <ResultCard key={act.id} canvasType="activity" title={act.name} subtitle={`${act.category} · ${act.duration} · ${act.difficulty}`} price={act.price} rating={act.rating} tags={[act.category, act.difficulty]} isRecommended={act.recommended} reason={act.reason}>
              <AddToTripButton canvasType="activity" label="Add to Itinerary" />
            </ResultCard>
          ))}
        </div>
      )}
    </StandardCanvas>
  );
}
