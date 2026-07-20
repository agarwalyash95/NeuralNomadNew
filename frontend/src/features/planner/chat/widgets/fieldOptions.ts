// Shared per-field chip options + currency helpers, used by both the legacy
// OptionalDetailsWidget (kept for rollback safety) and the new ClusterWidget
// (docs/ai-chat-implementation-plan.md Phase 1). Extracted so both widgets
// render preferences identically without duplicating these static tables.

export const CURRENCY_CONFIGS: Record<
  string,
  { min: number; max: number; step: number; defaultValue: number; budgetThreshold: number; midThreshold: number }
> = {
  USD: { min: 200, max: 10000, step: 100, defaultValue: 2000, budgetThreshold: 1000, midThreshold: 3000 },
  EUR: { min: 200, max: 10000, step: 100, defaultValue: 2000, budgetThreshold: 1000, midThreshold: 3000 },
  GBP: { min: 150, max: 8000, step: 100, defaultValue: 1500, budgetThreshold: 800, midThreshold: 2400 },
  INR: { min: 15000, max: 800000, step: 5000, defaultValue: 150000, budgetThreshold: 75000, midThreshold: 220000 },
  JPY: { min: 30000, max: 1500000, step: 10000, defaultValue: 300000, budgetThreshold: 150000, midThreshold: 450000 },
};

export function getLocalCurrency() {
  if (typeof window === 'undefined') return { code: 'USD', symbol: '$' };
  let code = 'USD';
  const locale = navigator.language || 'en-US';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz?.includes('Kolkata') || tz?.includes('Calcutta')) code = 'INR';
    else if (locale.endsWith('-IN') || locale.startsWith('hi')) code = 'INR';
    else if (locale.endsWith('-GB') || tz?.includes('Europe/London')) code = 'GBP';
    else if (locale.endsWith('-JP') || locale.startsWith('ja')) code = 'JPY';
    else {
      const euroLocales = ['de', 'fr', 'es', 'it', 'nl', 'be', 'at', 'fi', 'ie', 'pt', 'gr'];
      if (euroLocales.some(el => locale.startsWith(el))) code = 'EUR';
    }
  } catch { /* noop */ }

  let symbol = '$';
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).formatToParts(1);
    symbol = parts.find(p => p.type === 'currency')?.value ?? symbol;
  } catch {
    if (code === 'INR') symbol = '₹';
    else if (code === 'GBP') symbol = '£';
    else if (code === 'JPY') symbol = '¥';
    else if (code === 'EUR') symbol = '€';
  }
  return { code, symbol };
}

export function getBudgetTier(val: number, code: string) {
  const conf = (CURRENCY_CONFIGS[code] || CURRENCY_CONFIGS.USD) as NonNullable<(typeof CURRENCY_CONFIGS)[string]>;
  if (val < conf.budgetThreshold) return 'budget';
  if (val < conf.midThreshold) return 'mid_range';
  return 'premium';
}

export const FIELD_OPTIONS: Record<string, string[]> = {
  flight_class: ['Economy', 'Premium Economy', 'Business', 'First Class'],
  train_class: ['Sleeper', '3rd AC', '2nd AC', '1st AC', 'Chair Car'],
  cabin_class: ['Interior', 'Oceanview', 'Balcony', 'Suite'],
  car_type: ['Hatchback', 'Sedan', 'SUV', 'Luxury'],
  vehicle_type: ['Hatchback', 'Sedan', 'SUV', 'Luxury'],
  bus_type: ['AC Sleeper', 'Non-AC Sleeper', 'AC Seater', 'Volvo'],
  time_window: ['Morning', 'Afternoon', 'Evening', 'Night'],
  preferred_mode: ['Flight', 'Train', 'Bus', 'Cab', 'Mixed'],
  star_rating: ['3 Star', '4 Star', '5 Star', 'Luxury Resort'],
  meal_type: ['Breakfast Included', 'Half Board', 'All Inclusive'],
  cuisine: ['Local', 'North Indian', 'South Indian', 'Asian', 'Continental'],
  trip_pace: ['Relaxed', 'Balanced', 'Fast-Paced'],
  stay_amenities: ['Pool', 'Spa & Wellness', 'Free Breakfast', 'Beachfront', 'Gym'],
  property_type: ['Hotel', 'Resort', 'Villa', 'Boutique Stay'],
  non_stop: ['Direct Only', 'Any Flight'],
  tatkal: ['Standard Booking', 'Tatkal / Urgent'],
  meal_preference: ['Veg', 'Non-Veg', 'Jain'],
  journey_timing: ['Day Journey', 'Overnight'],
  return_trip: ['One Way', 'Round Trip'],
  transmission: ['Automatic', 'Manual'],
  priority: ['Cheapest', 'Fastest Route', 'Max Comfort'],
  intensity_level: ['Light & Easy', 'Moderate', 'Action-Packed'],
  dining_package: ['Standard Dining', 'Gourmet Package', 'Chef Table'],
  dietary: ['Vegetarian', 'Vegan', 'Jain', 'Halal', 'No Restrictions'],
  ambiance: ['Romantic', 'Family Friendly', 'Fine Dining', 'Casual Vibes'],
  group_type: ['Solo', 'Couple', 'Family', 'Friends', 'Corporate', 'Honeymoon'],
  insurance_coverage: ['Basic', 'Standard', 'Comprehensive', 'None'],
  spice_level: ['Mild', 'Medium', 'Spicy', 'Extra Spicy'],
  ferry_class: ['Economy Deck', 'Business Class', 'Cabin', 'Luxury Suite'],
  // Phase 5 (M4 depth): FIELD_OPTIONS had no `accessibility` entry at all —
  // the fine_tune card's accessibility multi-select (ClusterWidget.tsx
  // MULTI_SELECT_FIELDS) rendered zero buttons, a silent dead field, no
  // matter what the user needed. Mirrors the legacy SpecialRequirementWidget's
  // options, minus "Veg meals" (a direct duplicate of the adjacent `dietary`
  // field on the same card — offering both risked contradictory input).
  accessibility: ['Wheelchair', 'Stroller', 'Elderly care', 'Pets', 'Medical assist'],
};
