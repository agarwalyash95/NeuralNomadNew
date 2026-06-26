'use client';

import React, { useState } from 'react';
import { MapPin, Star, Heart, CalendarPlus } from 'lucide-react';
import { Attraction } from '@/services/attraction.service';
import Link from 'next/link';

interface AttractionCardProps {
  attraction: Attraction;
}

export function AttractionCard({ attraction }: AttractionCardProps) {
  const [isSaved, setIsSaved] = useState(false);

  const handleSavePlace = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to the details page
    setIsSaved(!isSaved);
    // TODO: Wire into SavedPlace backend endpoint when Planner module is active
  };

  const handleAddToTrip = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to the details page
    // Trigger lightweight modal concept
    alert(`Placeholder: Open "Add to Trip" Modal for ${attraction.name}`);
  };

  return (
    <div className="group bg-card rounded-xl overflow-hidden border shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
      <Link href={`/attractions/${attraction.id}`} className="block relative h-48 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${attraction.image_url})` }}
        />
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            className={`p-2 bg-background/80 backdrop-blur-sm rounded-full transition-colors ${
              isSaved ? 'text-rose-500' : 'text-foreground hover:text-rose-500'
            }`}
            onClick={handleSavePlace}
          >
            <Heart size={16} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        </div>
        {attraction.is_featured && (
          <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-xs font-semibold px-2 py-1 rounded">
            Featured
          </div>
        )}
      </Link>

      <div className="p-4">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
            <Link href={`/attractions/${attraction.id}`}>{attraction.name}</Link>
          </h3>
          <div className="flex items-center text-sm font-medium bg-secondary px-1.5 py-0.5 rounded">
            <Star size={12} className="mr-1 fill-primary text-primary" />
            {attraction.rating}
          </div>
        </div>

        <div className="flex items-center text-xs text-muted-foreground mt-1 mb-2">
          <MapPin size={12} className="mr-1" />
          {attraction.destination.city}, {attraction.destination.country}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
          {attraction.description}
        </p>

        <div className="flex items-center justify-between pt-3 border-t">
          <div className="text-sm font-medium">{attraction.ticket_price || 'Free'}</div>
          <button
            className="text-xs flex items-center font-medium text-primary hover:underline"
            onClick={handleAddToTrip}
          >
            <CalendarPlus size={14} className="mr-1" />
            Add to Trip
          </button>
        </div>
      </div>
    </div>
  );
}
