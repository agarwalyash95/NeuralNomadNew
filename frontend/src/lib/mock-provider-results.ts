import { SearchResult } from '@/types/booking';

export const mockFlightComparisons: SearchResult[] = [
  {
    id: '1',

    service: 'flight',

    title: 'IndiGo 6E2451',

    origin: 'Delhi',

    destination: 'Mumbai',

    departureTime: '06:15',

    arrivalTime: '08:20',

    duration: '2h 05m',

    offers: [
      {
        provider: 'Ixigo',
        price: 5420,
        currency: 'INR',
        badge: 'Lowest',
      },

      {
        provider: 'Goibibo',
        price: 5450,
        currency: 'INR',
      },

      {
        provider: 'Cleartrip',
        price: 5480,
        currency: 'INR',
      },

      {
        provider: 'MakeMyTrip',
        price: 5499,
        currency: 'INR',
      },
    ],
  },
];
