'use client';

import React from 'react';
import PlanLoadingScreen from '../../chat/PlanLoadingScreen';

interface PlanStreamerLoaderProps {
  destination?: string;
  durationDays?: number;
  travelersCount?: number;
  budgetText?: string;
}

export default function PlanStreamerLoader({
  destination = 'Goa, India',
  durationDays = 4,
  travelersCount = 2,
  budgetText = '₹45,000',
}: PlanStreamerLoaderProps) {
  return (
    <PlanLoadingScreen
      destination={destination === 'Manali' ? 'Goa, India' : destination}
      durationDays={durationDays}
      travelersCount={travelersCount}
      budgetText={budgetText}
    />
  );
}
