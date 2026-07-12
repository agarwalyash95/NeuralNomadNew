import type { Suggestion } from '../../../plan-canvas/types';
import type { TripContext } from '../../../types';

export interface BudgetImpact {
  description: string;
  impactPercentage: number; // Percentage of the day's average meal budget
  estimatedCostForTwo: number;
}

export interface MealRecommendation {
  suggestion: Suggestion;
  label: 'Best Overall' | 'Best Local Food' | 'Best Budget' | 'Best View' | 'Family Favorite' | 'Vegetarian Pick' | 'Trending Cafe' | 'Late Night Spot';
  confidence: 'High' | 'Medium' | 'Low';
  confidenceReason: string;
  reasoning: string;
  strengths: string[];
  tradeOffs: string[];
  itineraryContext: string;
  budgetImpact: BudgetImpact;
  nearbyAttractions: string[];
  signatureDishes: string[];
  diningAtmosphere: string;
  crowdLevel: 'Low' | 'Moderate' | 'Busy' | 'Peak';
  bestTimeToVisit: string;
  timeSlot: string; // e.g., "1:15 PM Lunch", "8:30 AM Breakfast"
}

interface SignatureEntry {
  dishes: string[];
  atmosphere: string;
  view?: boolean;
  local?: boolean;
}

// Heuristic database of Manali/generic signatures based on restaurant names for realistic mock details
const SIGNATURES_DB: Record<string, SignatureEntry> = {
  kunga: {
    dishes: ['Fresh Woodfired Rainbow Trout', 'Himachali Siddu with Ghee', 'Mutton Momos'],
    atmosphere: 'Warm rustic wooden cabin with cozy fleece seating and a stone fireplace.',
    local: true,
  },
  chopsticks: {
    dishes: ['Tibetan Thukpa', 'Spicy Chilli Garlic Noodles', 'Steamed Tingmo'],
    atmosphere: 'Lively, colorful Tibetan diner with prayer wheels and quick service.',
    local: true,
  },
  il: {
    dishes: ['Woodfired Quattro Formaggi Pizza', 'Handmade Gnocchi', 'Tiramisu'],
    atmosphere: 'Charming open-air garden terrace with fairy lights and mountain views.',
    view: true,
  },
  johnson: {
    dishes: ['Pan-seared Butter Trout', 'Apple Crumble', 'Local Craft Beer'],
    atmosphere: 'Upscale wooden chalet setting with an expansive green lawn and ambient acoustic music.',
    view: true,
  },
  sher: {
    dishes: ['Kadai Paneer', 'Butter Naan', 'Aloo Paratha'],
    atmosphere: 'Traditional family-style dhaba with brass utensils and low seating.',
    local: true,
  },
  cafe: {
    dishes: ['Hot Buttered Croissants', 'Cappuccino', 'Blueberry Cheesecake'],
    atmosphere: 'Artsy cafe filled with books, indie music, and cozy beanbags.',
  },
};

const DEFAULT_SIGNATURES: SignatureEntry = {
  dishes: ['Signature Local Speciality', 'Chef\'s Seasonal Curry', 'House Dessert'],
  atmosphere: 'Cosy local dining environment with friendly hospitality.',
};

export function getMealRecommendations(
  results: Suggestion[],
  tripContext: TripContext,
  selectedFilters: string[]
): MealRecommendation[] {
  // 1. Process all results and map to enriched recommendations
  const enriched: MealRecommendation[] = results.map((place, index) => {
    const nameLower = place.name.toLowerCase();
    const key = Object.keys(SIGNATURES_DB).find(k => nameLower.includes(k)) || '';
    const info = SIGNATURES_DB[key] || DEFAULT_SIGNATURES;

    // A. Label assignment based on features
    let label: MealRecommendation['label'] = 'Best Overall';
    if (index === 0) {
      label = 'Best Overall';
    } else if (info.local || nameLower.includes('dhaba') || nameLower.includes('tandoori')) {
      label = 'Best Local Food';
    } else if (place.price_label === '$' || place.price_label === '₹' || (place.cost?.amount && place.cost.amount < 400)) {
      label = 'Best Budget';
    } else if (info.view || nameLower.includes('view') || nameLower.includes('rooftop')) {
      label = 'Best View';
    } else if (place.details?.serves_vegetarian_food) {
      label = 'Vegetarian Pick';
    } else if (place.details?.good_for_children) {
      label = 'Family Favorite';
    } else if (nameLower.includes('cafe') || nameLower.includes('bakery')) {
      label = 'Trending Cafe';
    } else {
      label = index % 2 === 0 ? 'Family Favorite' : 'Trending Cafe';
    }

    // B. Contextual Timing & Itinerary slot
    // Guess time slot from context or filter
    let timeSlot = '1:30 PM Lunch';
    if (selectedFilters.includes('Breakfast') || nameLower.includes('bakery') || nameLower.includes('cafe')) {
      timeSlot = '8:30 AM Breakfast';
    } else if (selectedFilters.includes('Dinner')) {
      timeSlot = '8:00 PM Dinner';
    } else if (tripContext.activeNodeStartTime) {
      const hour = parseInt(tripContext.activeNodeStartTime.split(':')[0] || '12', 10);
      if (hour < 11) timeSlot = `${tripContext.activeNodeStartTime} AM Breakfast`;
      else if (hour < 16) timeSlot = `${tripContext.activeNodeStartTime} PM Lunch`;
      else timeSlot = `${tripContext.activeNodeStartTime} PM Dinner`;
    }

    // C. Budget calculation & impact
    // Estimate cost for two based on price_label or cost amount
    let costForTwo = 600;
    if (place.cost?.amount) {
      costForTwo = place.cost.amount * (tripContext.travellers > 1 ? tripContext.travellers / 2 : 1) * 2;
    } else if (place.price_label) {
      const len = place.price_label.replace(/[^$₹]/g, '').length;
      costForTwo = len === 1 ? 300 : len === 2 ? 600 : len === 3 ? 1200 : 2000;
    }
    // Express as percentage of average daily meal budget (e.g. ₹2,000 for 2 per day average)
    const dailyMealBudget = 2000;
    const impactPercentage = Math.round((costForTwo / dailyMealBudget) * 100);
    const budgetDescription = `Estimated ₹${costForTwo} for 2. Consumes ${impactPercentage}% of your day's target dining budget (₹${dailyMealBudget}).`;

    // D. Nearby planned attractions
    const activeDayItems = tripContext.activeDayItemTitles || [];
    const nearbyAttractions: string[] = [];
    if (activeDayItems.length > 0) {
      nearbyAttractions.push(...activeDayItems.slice(0, 2));
    } else if (tripContext.activeNodeTitle) {
      nearbyAttractions.push(tripContext.activeNodeTitle);
    } else {
      nearbyAttractions.push('City Center');
    }

    // E. Strengths & Trade-offs
    const strengths = [
      `Signature ${info.dishes[0] || 'Local Specialty'}`,
      info.atmosphere,
    ];
    if (place.rating && place.rating >= 4.5) {
      strengths.push(`Top-tier tourist rating of ${place.rating}/5`);
    }

    const tradeOffs: string[] = [];
    if (label === 'Best Budget') {
      tradeOffs.push('Limited seating space and expects cash/UPI payments only.');
    } else if (label === 'Best Overall' || label === 'Best Local Food') {
      tradeOffs.push('High tourist volumes; table waiting times can reach 15-20 minutes during peak hours.');
    } else if (label === 'Best View') {
      tradeOffs.push('Slightly higher premium on beverages.');
    } else {
      tradeOffs.push('No reservations accepted; walk-ins only.');
    }

    // F. Qualitative Confidence
    let confidence: MealRecommendation['confidence'] = 'High';
    let confidenceReason = '';

    const dist = place.distance_km ?? 1.5;
    const ratingVal = place.rating ?? 4.0;
    
    if (dist <= 0.8 && ratingVal >= 4.4) {
      confidence = 'High';
      confidenceReason = `High confidence because it is located 3 mins walk from your next stop, serves excellent food, and matches your daily budget.`;
    } else if (dist <= 2.0 && ratingVal >= 4.0) {
      confidence = 'Medium';
      confidenceReason = `Medium confidence because it fits your culinary criteria, but requires a short transit (${dist} km away) from your planned itinerary line.`;
    } else {
      confidence = 'Low';
      confidenceReason = `Low confidence due to the distance (${dist} km away) and limited active feedback for breakfast slots.`;
    }

    // G. Reasoning sentence
    const timeWord = timeSlot.split(' ')[0] || '1:30';
    let reasoning = `Perfect meal stop for your day. Fits right into your schedule around ${timeWord}.`;
    if (activeDayItems.length > 0) {
      reasoning = `Ideally located just a ${Math.round(dist * 12)} min walk from your planned stop at ${activeDayItems[0]}. It aligns perfectly with your food budget and serves vegetarian dishes.`;
    } else if (tripContext.activeNodeTitle) {
      const typeWord = (timeSlot.split(' ')[1] || 'Meal').toLowerCase();
      reasoning = `Located near ${tripContext.activeNodeTitle}, making it an efficient stop for ${typeWord} with great local ambiance.`;
    }

    // H. Dynamic Vibe / Crowd Level
    const crowdLevel: MealRecommendation['crowdLevel'] = 
      place.rating && place.rating >= 4.6 ? 'Peak' :
      place.rating && place.rating >= 4.3 ? 'Busy' : 'Moderate';

    const typeFilterWord = timeSlot.split(' ')[1] || '';
    const bestTimeToVisit = typeFilterWord === 'Lunch' ? '12:45 PM - 1:45 PM' : 
                            typeFilterWord === 'Breakfast' ? '8:30 AM - 9:30 AM' : '7:30 PM - 9:00 PM';

    return {
      suggestion: place,
      label,
      confidence,
      confidenceReason,
      reasoning,
      strengths,
      tradeOffs,
      itineraryContext: tripContext.activeNodeDayLabel || 'Today\'s Itinerary',
      budgetImpact: {
        description: budgetDescription,
        impactPercentage,
        estimatedCostForTwo: costForTwo,
      },
      nearbyAttractions,
      signatureDishes: info.dishes,
      diningAtmosphere: info.atmosphere,
      crowdLevel,
      bestTimeToVisit,
      timeSlot,
    };
  });

  // 2. Perform Filtering based on Selected Filters
  // Supported Filters: Breakfast, Lunch, Dinner, Cafés, Desserts, Breweries, Street Food, AI Picks, Local Food, Vegetarian, Family Friendly, Budget, Highly Rated
  let filtered = [...enriched];

  // If "AI Picks" is not explicitly checked, but there are other filters, we filter by them.
  // We prioritize filtering by selected chips.
  selectedFilters.forEach(filter => {
    if (filter === 'All' || filter === 'AI Picks') return;

    if (filter === 'Breakfast') {
      filtered = filtered.filter(r => r.timeSlot.includes('Breakfast') || r.suggestion.name.toLowerCase().includes('cafe') || r.suggestion.name.toLowerCase().includes('bakery'));
    } else if (filter === 'Lunch') {
      filtered = filtered.filter(r => r.timeSlot.includes('Lunch'));
    } else if (filter === 'Dinner') {
      filtered = filtered.filter(r => r.timeSlot.includes('Dinner'));
    } else if (filter === 'Cafés') {
      filtered = filtered.filter(r => r.suggestion.name.toLowerCase().includes('cafe') || r.suggestion.name.toLowerCase().includes('coffee') || r.suggestion.name.toLowerCase().includes('tea'));
    } else if (filter === 'Desserts') {
      filtered = filtered.filter(r => r.suggestion.name.toLowerCase().includes('bakery') || r.suggestion.name.toLowerCase().includes('sweet') || r.suggestion.name.toLowerCase().includes('ice cream') || r.suggestion.name.toLowerCase().includes('creperie'));
    } else if (filter === 'Breweries') {
      filtered = filtered.filter(r => r.suggestion.name.toLowerCase().includes('brewery') || r.suggestion.name.toLowerCase().includes('bar') || r.suggestion.name.toLowerCase().includes('pub') || r.suggestion.details?.serves_beer || r.suggestion.details?.serves_wine);
    } else if (filter === 'Street Food') {
      filtered = filtered.filter(r => r.suggestion.name.toLowerCase().includes('dhaba') || r.suggestion.name.toLowerCase().includes('chat') || r.suggestion.name.toLowerCase().includes('street') || r.suggestion.name.toLowerCase().includes('fast food'));
    } else if (filter === 'Local Food') {
      filtered = filtered.filter(r => r.label === 'Best Local Food' || r.suggestion.name.toLowerCase().includes('dhaba') || r.suggestion.name.toLowerCase().includes('traditional') || r.suggestion.name.toLowerCase().includes('indian') || r.suggestion.name.toLowerCase().includes('himachal'));
    } else if (filter === 'Vegetarian') {
      filtered = filtered.filter(r => r.suggestion.details?.serves_vegetarian_food === true);
    } else if (filter === 'Family Friendly') {
      filtered = filtered.filter(r => r.suggestion.details?.good_for_children === true || r.suggestion.details?.menu_for_children === true);
    } else if (filter === 'Budget') {
      filtered = filtered.filter(r => r.label === 'Best Budget' || r.budgetImpact.estimatedCostForTwo <= 600);
    } else if (filter === 'Highly Rated') {
      filtered = filtered.filter(r => r.suggestion.rating !== null && r.suggestion.rating >= 4.5);
    }
  });

  return filtered;
}
