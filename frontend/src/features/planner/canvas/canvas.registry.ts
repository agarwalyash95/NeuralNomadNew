/**
 * Canvas plugin registry — lazy-loaded components.
 * Future canvases register here without touching the engine.
 */

import { lazy } from 'react';
import type { CanvasType } from '@/services/planner.types';

export interface CanvasDefinition {
  type: CanvasType;
  label: string;
  icon: string;
  component: React.LazyExoticComponent<React.ComponentType<{ workspaceId: string }>>;
  searchable: boolean;
  referenceTable?: string;
}

export const canvasRegistry: Record<string, CanvasDefinition> = {
  flight: {
    type: 'flight',
    label: 'Flights',
    icon: 'Plane',
    component: lazy(() => import('./flight/FlightCanvas')),
    searchable: true,
    referenceTable: 'airport_routes',
  },
  hotel: {
    type: 'hotel',
    label: 'Hotels',
    icon: 'Hotel',
    component: lazy(() => import('./hotel/HotelCanvas')),
    searchable: true,
    referenceTable: 'hotel_master',
  },
  train: {
    type: 'train',
    label: 'Trains',
    icon: 'TrainFront',
    component: lazy(() => import('./train/TrainCanvas')),
    searchable: true,
    referenceTable: 'train_routes',
  },
  bus: {
    type: 'bus',
    label: 'Buses',
    icon: 'Bus',
    component: lazy(() => import('./bus/BusCanvas')),
    searchable: true,
    referenceTable: 'bus_routes',
  },
  cab: {
    type: 'cab',
    label: 'Cabs',
    icon: 'Car',
    component: lazy(() => import('./cab/CabCanvas')),
    searchable: true,
  },
  attraction: {
    type: 'attraction',
    label: 'Attractions',
    icon: 'Landmark',
    component: lazy(() => import('./attraction/AttractionCanvas')),
    searchable: true,
    referenceTable: 'attraction_master',
  },
  activity: {
    type: 'activity',
    label: 'Activities',
    icon: 'Activity',
    component: lazy(() => import('./activity/ActivityCanvas')),
    searchable: true,
    referenceTable: 'activity_master',
  },
  restaurant: {
    type: 'restaurant',
    label: 'Restaurants',
    icon: 'UtensilsCrossed',
    component: lazy(() => import('./restaurant/RestaurantCanvas')),
    searchable: true,
    referenceTable: 'restaurant_master',
  },
  visa: {
    type: 'visa',
    label: 'Visa',
    icon: 'FileCheck',
    component: lazy(() => import('./visa/VisaCanvas')),
    searchable: false,
    referenceTable: 'visa_requirement',
  },
  forex: {
    type: 'forex',
    label: 'Forex',
    icon: 'Coins',
    component: lazy(() => import('./forex/ForexCanvas')),
    searchable: false,
  },
  booking: {
    type: 'booking',
    label: 'Booking',
    icon: 'ShoppingCart',
    component: lazy(() => import('./booking/BookingCanvas')),
    searchable: false,
  },
};

export function registerCanvas(definition: CanvasDefinition) {
  canvasRegistry[definition.type] = definition;
}
