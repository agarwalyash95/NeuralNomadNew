export const mockTrainResults = [
  {
    id: 1,
    trainNumber: '12951',
    name: 'Mumbai Rajdhani',
    departure: { time: '16:55', station: 'NDLS', city: 'New Delhi' },
    arrival: { time: '08:35', station: 'MMCT', city: 'Mumbai Central' },
    duration: '15h 40m',
    classes: [
      { name: '1A', price: 3500, seats: 'Available' },
      { name: '2A', price: 2200, seats: 'Available' },
      { name: '3A', price: 1600, seats: 'RAC 12' }
    ],
    days: 'Daily',
    rating: 4.5
  },
  {
    id: 2,
    trainNumber: '12137',
    name: 'Punjab Mail',
    departure: { time: '19:40', station: 'NDLS', city: 'New Delhi' },
    arrival: { time: '14:05', station: 'CSTM', city: 'Mumbai CST' },
    duration: '18h 25m',
    classes: [
      { name: 'SL', price: 450, seats: 'Available' },
      { name: '3A', price: 1350, seats: 'Available' },
      { name: '2A', price: 1950, seats: 'WL 5' }
    ],
    days: 'Daily',
    rating: 4.2
  },
  {
    id: 3,
    trainNumber: '12909',
    name: 'Maharashtra Express',
    departure: { time: '11:05', station: 'NDLS', city: 'New Delhi' },
    arrival: { time: '06:00', station: 'CSTM', city: 'Mumbai CST' },
    duration: '18h 55m',
    classes: [
      { name: 'SL', price: 455, seats: 'Available' },
      { name: '3A', price: 1360, seats: 'RAC 8' },
      { name: '2A', price: 1960, seats: 'WL 12' }
    ],
    days: 'Daily',
    rating: 4.3
  }
];

export const mockBusResults = [
  {
    id: 1,
    operator: 'IntrCity SmartBus',
    busType: 'AC Sleeper (2+1)',
    departure: { time: '20:30', location: 'Kashmiri Gate' },
    arrival: { time: '12:45', location: 'Dadar TT' },
    duration: '16h 15m',
    price: 1850,
    seats: '12 seats available',
    rating: 4.4,
    amenities: ['WiFi', 'Charging Point', 'Water Bottle', 'Blanket']
  },
  {
    id: 2,
    operator: 'VRL Travels',
    busType: 'Volvo Multi-Axle AC Sleeper',
    departure: { time: '18:00', location: 'RK Ashram' },
    arrival: { time: '11:30', location: 'Borivali' },
    duration: '17h 30m',
    price: 1650,
    seats: '8 seats available',
    rating: 4.3,
    amenities: ['Charging Point', 'Water Bottle', 'Blanket']
  },
  {
    id: 3,
    operator: 'Manish Travels',
    busType: 'AC Seater (2+2)',
    departure: { time: '19:45', location: 'Anand Vihar' },
    arrival: { time: '13:00', location: 'Thane' },
    duration: '17h 15m',
    price: 950,
    seats: '20 seats available',
    rating: 4.0,
    amenities: ['Water Bottle', 'Charging Point']
  }
];

export const mockCabResults = [
  {
    id: 1,
    provider: 'Uber',
    carType: 'Sedan',
    model: 'Maruti Dzire',
    capacity: '4 seats',
    price: 2800,
    estimatedTime: '45 mins',
    rating: 4.5,
    features: ['AC', 'GPS Tracking', 'Sanitized']
  },
  {
    id: 2,
    provider: 'Ola',
    carType: 'SUV',
    model: 'Toyota Innova',
    capacity: '6 seats',
    price: 4200,
    estimatedTime: '40 mins',
    rating: 4.6,
    features: ['AC', 'GPS Tracking', 'Extra Luggage Space']
  },
  {
    id: 3,
    provider: 'Meru Cabs',
    carType: 'Sedan',
    model: 'Honda City',
    capacity: '4 seats',
    price: 3100,
    estimatedTime: '42 mins',
    rating: 4.4,
    features: ['AC', 'GPS Tracking', 'Professional Driver']
  }
];
