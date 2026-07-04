export interface ItineraryItem {
  id: string;
  type: 'flight' | 'taxi' | 'hotel' | 'food' | 'activity' | 'train' | 'bus';
  startTime?: string;
  endTime?: string;
  title: string;
  subtitle: string;
  details?: string;
  price?: string;
  status?: 'Confirmed' | 'Pending' | 'Book Now' | 'inactive';
  aiTip?: string;
  image?: string;
  rating?: number;
  geoTag?: string;
  distanceToNext?: string;
  latitude?: number;
  longitude?: number;
  isInactive?: boolean;
  isDeleting?: boolean;
  _rawActivity?: any;
}

export interface ItineraryDay {
  id: string;
  dayNumber: number;
  dateStr: string;
  title: string;
  items: ItineraryItem[];
}

export interface ItineraryCity {
  id: string;
  cityName: string;
  nights: number;
  dateRange: string;
  weather: string;
  iconBgColor: string;
  icon: string;
  days: ItineraryDay[];
  transitToNext?: ItineraryItem;
}

export interface MockTripData {
  title: string;
  stats: string;
  checklist: {
    id: string;
    label: string;
    status: 'Completed' | 'Pending' | 'Book Now';
    type: string;
  }[];
  cities: ItineraryCity[];
}

export const mockTripData: MockTripData = {
  title: 'Himalayan Escape: Manali & Parvati',
  stats: '7 days • 3 locations • Rs 45,000 budget • 4 travellers',
  checklist: [
    { id: 'bus-tickets', label: 'Volvo Bus Tickets', status: 'Completed', type: 'transport' },
    { id: 'hotels', label: 'Hotel Bookings', status: 'Completed', type: 'accommodation' },
    { id: 'winter-wear', label: 'Heavy Winter Wear', status: 'Pending', type: 'packing' },
    { id: 'cash', label: 'ATM Cash (Limited up there)', status: 'Pending', type: 'forex' },
  ],
  cities: [
    {
      id: 'city-1',
      cityName: 'Manali',
      nights: 3,
      dateRange: 'Oct 15 - Oct 18',
      weather: '12°C • Clear & Chilly',
      iconBgColor: 'bg-indigo-500',
      icon: 'MN',
      days: [
        {
          id: 'day-1',
          dayNumber: 1,
          dateStr: 'Oct 15',
          title: 'Arrival & Acclimatization',
          items: [
            {
              id: 'item-1',
              type: 'bus',
              startTime: '08:30',
              endTime: '09:00',
              title: 'Zingbus Volvo Arrival',
              subtitle: 'Delhi to Manali • Semi-Sleeper',
              price: 'Rs 1,400',
              status: 'Confirmed',
            },
            {
              id: 'item-2',
              type: 'taxi',
              startTime: '09:15',
              endTime: '09:45',
              title: 'Auto to Old Manali',
              subtitle: 'Manali Bus Stand to Hotel',
              aiTip: 'Autos charge a fixed rate of Rs 200-300 to Old Manali. Negotiate before boarding.',
              price: 'Rs 250',
              status: 'Pending',
            },
            {
              id: 'item-3',
              type: 'hotel',
              startTime: '11:00',
              title: 'Zostel Manali',
              subtitle: 'Old Manali • Backpacker Vibe',
              details: 'Private Room • Mountain View • Check-in 12 PM',
              aiTip: 'Great place to meet fellow travelers. They have a bonfire every night.',
              price: 'Rs 3,500 / night',
              status: 'Confirmed',
              image: 'https://images.unsplash.com/photo-1542315024-4fc6e7fb6369?auto=format&fit=crop&q=80&w=400',
              rating: 4,
              geoTag: 'Old Manali • 1.5 km from Mall Road',
              distanceToNext: '0.5 km'
            },
            {
              id: 'item-4',
              type: 'food',
              startTime: '13:30',
              endTime: '15:00',
              title: 'Lunch at Cafe 1947',
              subtitle: 'Italian & Continental • Riverside',
              aiTip: 'Try their wood-fired pizza and sit by the river for the best experience.',
              image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=400',
            },
            {
              id: 'item-5',
              type: 'activity',
              startTime: '16:00',
              endTime: '18:00',
              title: 'Hadimba Temple & Cedar Forest',
              subtitle: 'Local Sightseeing • 2 hours',
              details: 'Entry free • 1.5 km walk from Old Manali',
              aiTip: 'Beautiful spot for photos amid towering deodar trees.',
              image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=400',
              rating: 5,
              geoTag: 'Manali • Surrounded by Cedar Forest'
            },
          ],
        },
        {
          id: 'day-2',
          dayNumber: 2,
          dateStr: 'Oct 16',
          title: 'Snow, Altitude & Adventure',
          items: [
            {
              id: 'item-6',
              type: 'taxi',
              startTime: '08:00',
              endTime: '16:00',
              title: 'Cab to Solang Valley & Atal Tunnel',
              subtitle: 'Full day cab rental',
              price: 'Rs 3,000',
              status: 'Confirmed',
            },
            {
              id: 'item-7',
              type: 'activity',
              startTime: '09:30',
              endTime: '12:00',
              title: 'Solang Valley Adventure',
              subtitle: 'Paragliding & ATV Rides',
              details: 'Prices vary (approx Rs 3,000 for long flight)',
              aiTip: 'Haggle hard for adventure activities. Weather dictates paragliding.',
              image: 'https://images.unsplash.com/photo-1520668045995-103bcad2c358?auto=format&fit=crop&q=80&w=400',
            },
            {
              id: 'item-8',
              type: 'activity',
              startTime: '13:00',
              endTime: '15:00',
              title: 'Drive through Atal Tunnel',
              subtitle: 'World\'s longest highway tunnel above 10,000 ft',
              aiTip: 'Stop at the North Portal in Sissu for spectacular Lahaul valley views.',
              image: 'https://images.unsplash.com/photo-1616421453228-40e94bbba737?auto=format&fit=crop&q=80&w=400',
            },
            {
              id: 'item-9',
              type: 'food',
              startTime: '19:30',
              title: 'Dinner at The Lazy Dog',
              subtitle: 'Old Manali • Live Music',
              image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=400',
            },
          ],
        },
        {
          id: 'day-3',
          dayNumber: 3,
          dateStr: 'Oct 17',
          title: 'Chill vibes in Old Manali',
          items: [
            {
              id: 'item-10',
              type: 'food',
              startTime: '10:00',
              endTime: '11:30',
              title: 'Breakfast at Dylan\'s Toasted & Roasted',
              subtitle: 'Famous for coffee and cookies',
              aiTip: 'A must-visit for classic rock lovers and coffee aficionados.',
            },
            {
              id: 'item-11',
              type: 'activity',
              startTime: '12:00',
              endTime: '15:00',
              title: 'Cafe Hopping & Shopping',
              subtitle: 'Explore Old Manali streets',
              details: 'Buy woolens, dreamcatchers, and silver jewelry',
            },
            {
              id: 'item-12',
              type: 'food',
              startTime: '20:00',
              title: 'Dinner at Johnson\'s Bar & Restaurant',
              subtitle: 'Iconic spot for Trout Fish',
              price: 'Rs 1,500 / person',
              status: 'Pending',
            }
          ]
        }
      ],
      transitToNext: {
        id: 'transit-1',
        type: 'taxi',
        title: 'Private Cab to Kasol',
        subtitle: 'Via Kullu • 75 km • 3 hours',
        details: 'Beautiful drive along the Beas and Parvati rivers.',
        price: 'Rs 2,500',
        status: 'Confirmed',
        image: 'https://images.unsplash.com/photo-1596767562854-5e197d1dfc14?auto=format&fit=crop&q=80&w=400',
      },
    },
    {
      id: 'city-2',
      cityName: 'Kasol',
      nights: 2,
      dateRange: 'Oct 18 - Oct 20',
      weather: '15°C • Crisp & Sunny',
      iconBgColor: 'bg-emerald-500',
      icon: 'KS',
      days: [
        {
          id: 'day-4',
          dayNumber: 4,
          dateStr: 'Oct 18',
          title: 'Parvati Valley Magic',
          items: [
            {
              id: 'item-13',
              type: 'hotel',
              startTime: '14:00',
              title: 'The Hosteller Kasol',
              subtitle: 'Central Kasol • Vibrant atmosphere',
              price: 'Rs 1,200 / bed',
              status: 'Confirmed',
              image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&q=80&w=400',
            },
            {
              id: 'item-14',
              type: 'activity',
              startTime: '15:30',
              endTime: '18:00',
              title: 'Trek to Chalal Village',
              subtitle: 'Easy 30-min trek from Kasol',
              aiTip: 'Walk along the Parvati river. Try the cafes in Chalal for a quieter vibe.',
              image: 'https://images.unsplash.com/photo-1601758124277-f0086d5ebb07?auto=format&fit=crop&q=80&w=400',
            },
            {
              id: 'item-15',
              type: 'food',
              startTime: '19:00',
              title: 'Dinner at Evergreen Cafe',
              subtitle: 'Israeli & Indian cuisine',
              aiTip: 'One of the oldest and most famous cafes in Kasol. Try their Shakshuka.',
              image: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&q=80&w=400',
            },
          ],
        },
        {
          id: 'day-5',
          dayNumber: 5,
          dateStr: 'Oct 19',
          title: 'Manikaran & Tosh Exploration',
          items: [
            {
              id: 'item-16',
              type: 'taxi',
              startTime: '09:00',
              title: 'Cab to Manikaran',
              subtitle: '5 km from Kasol',
            },
            {
              id: 'item-17',
              type: 'activity',
              startTime: '09:30',
              endTime: '11:30',
              title: 'Manikaran Sahib Gurudwara',
              subtitle: 'Hot springs and spiritual visit',
              details: 'Take a dip in the natural hot springs',
              aiTip: 'Don\'t miss the Langar (community kitchen meal) here. It is cooked in the hot springs!',
              image: 'https://images.unsplash.com/photo-1610014761044-6338fbcc211e?auto=format&fit=crop&q=80&w=400',
            },
            {
              id: 'item-18',
              type: 'taxi',
              startTime: '12:00',
              title: 'Cab/Bus to Barshaini (for Tosh)',
              subtitle: 'Base for Tosh and Kheerganga treks',
            },
            {
              id: 'item-19',
              type: 'activity',
              startTime: '13:00',
              endTime: '17:00',
              title: 'Explore Tosh Village',
              subtitle: 'Short hike & Cafe hopping',
              aiTip: 'Tosh offers stunning views of snow-capped peaks. Pink Floyd cafe is popular.',
              image: 'https://images.unsplash.com/photo-1589308454676-e62118274712?auto=format&fit=crop&q=80&w=400',
            }
          ]
        }
      ],
      transitToNext: {
        id: 'transit-2',
        type: 'bus',
        title: 'Overnight Volvo to Delhi',
        subtitle: 'Departs from Bhuntar / Kasol • 12 hours',
        details: 'Booked via RedBus',
        price: 'Rs 1,500',
        status: 'Confirmed',
      }
    },
    {
      id: 'city-3',
      cityName: 'Delhi',
      nights: 1,
      dateRange: 'Oct 21',
      weather: '28°C • Hazy',
      iconBgColor: 'bg-orange-500',
      icon: 'DL',
      days: [
        {
          id: 'day-6',
          dayNumber: 6,
          dateStr: 'Oct 21',
          title: 'Arrival & Wrap-up',
          items: [
            {
              id: 'item-20',
              type: 'bus',
              startTime: '07:30',
              title: 'Arrival at Majnu Ka Tilla',
              subtitle: 'Delhi ISBT',
            },
            {
              id: 'item-21',
              type: 'food',
              startTime: '08:00',
              title: 'Breakfast at AMA Cafe',
              subtitle: 'Majnu Ka Tilla',
              aiTip: 'Perfect spot for pancakes and coffee after a long bus journey.',
              image: 'https://images.unsplash.com/photo-1495474472201-1372545d15c7?auto=format&fit=crop&q=80&w=400',
            }
          ]
        }
      ]
    }
  ],
};
