import type { Suggestion } from '../../../plan-canvas/types';
import type { TripContext } from '../../../types';

// ── Label taxonomy ────────────────────────────────────────────────────────
export type ActivityLabel =
  | 'Thrill Seeker'
  | 'Cultural Immersion'
  | 'Best for Beginners'
  | 'Family Activity'
  | 'Scenic Adventure'
  | 'Budget Pick'
  | 'Popular Choice';

export type DifficultyTier = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export interface ActivityRecommendation {
  suggestion: Suggestion;
  label: ActivityLabel;
  confidence: 'High' | 'Medium' | 'Low';
  confidenceReason: string;
  strengths: string[];
  tradeOffs: string[];
  difficulty: DifficultyTier;
  /** 1–5 effort score driving the dot bar */
  difficultyScore: number;
  durationMins: number;
  durationLabel: string;
  pricePerPerson: number;
  priceLabel: string;
  bookingRequired: boolean;
  bookingLeadTimeHours: number; // e.g. 2 = "book 2h before"
  slotsAvailableLabel: string;  // "Walk-in" | "3 slots today" | "Pre-book online"
  whatIncluded: string[];
  whatToBring: string[];
  ageRequirement: string | null;
  groupSizeLabel: string;
  cancellationPolicy: string;
  itineraryContext: string;
}

// ── Heuristic activity profiles ─────────────────────────────────────────
interface ActivityProfile {
  difficulty: DifficultyTier;
  difficultyScore: number;
  durationMins: number;
  bookingRequired: boolean;
  bookingLeadHours: number;
  slotsLabel: string;
  included: string[];
  bring: string[];
  ageReq: string | null;
  groupSize: string;
  cancellation: string;
  label: ActivityLabel;
}

const ACTIVITY_PROFILES: { keywords: string[]; profile: ActivityProfile }[] = [
  {
    keywords: ['paragliding', 'para gliding', 'parasailing'],
    profile: {
      difficulty: 'Intermediate',
      difficultyScore: 3,
      durationMins: 30,
      bookingRequired: true,
      bookingLeadHours: 2,
      slotsLabel: '4 slots today',
      included: ['Tandem pilot', 'Safety harness', 'Helmet', 'GoPro footage'],
      bring: ['Sunglasses', 'Closed-toe shoes', 'Jacket'],
      ageReq: '12+ years',
      groupSize: '1–2 per flight',
      cancellation: 'Full refund if cancelled 6h before',
      label: 'Thrill Seeker',
    },
  },
  {
    keywords: ['trekking', 'trek', 'hiking', 'hike'],
    profile: {
      difficulty: 'Advanced',
      difficultyScore: 4,
      durationMins: 240,
      bookingRequired: false,
      bookingLeadHours: 0,
      slotsLabel: 'Walk-in',
      included: ['Trail map', 'Basic guide'],
      bring: ['Trek shoes', 'Water (2L)', 'Sunscreen', 'Light jacket', 'Snacks'],
      ageReq: '10+ years',
      groupSize: 'Any size',
      cancellation: 'Not applicable',
      label: 'Scenic Adventure',
    },
  },
  {
    keywords: ['river rafting', 'rafting', 'kayaking', 'kayak'],
    profile: {
      difficulty: 'Intermediate',
      difficultyScore: 3,
      durationMins: 90,
      bookingRequired: true,
      bookingLeadHours: 3,
      slotsLabel: '2 slots left',
      included: ['Life jacket', 'Helmet', 'Paddle', 'Trained guide', 'Safety kayak'],
      bring: ['Change of clothes', 'Waterproof bag for valuables', 'Sunscreen'],
      ageReq: '14+ years',
      groupSize: '6–12 per raft',
      cancellation: 'Full refund if cancelled 24h before',
      label: 'Thrill Seeker',
    },
  },
  {
    keywords: ['skiing', 'ski', 'snowboarding', 'snow'],
    profile: {
      difficulty: 'Intermediate',
      difficultyScore: 3,
      durationMins: 120,
      bookingRequired: true,
      bookingLeadHours: 1,
      slotsLabel: '6 slots today',
      included: ['Ski rental', 'Basic instructor', 'Lift pass'],
      bring: ['Warm layers', 'Waterproof gloves', 'Ski goggles', 'Thermal socks'],
      ageReq: '5+ years',
      groupSize: 'Individual or group',
      cancellation: 'No refund on same-day cancellations',
      label: 'Scenic Adventure',
    },
  },
  {
    keywords: ['cooking', 'cook', 'culinary', 'cuisine', 'food tour', 'food walk'],
    profile: {
      difficulty: 'Beginner',
      difficultyScore: 1,
      durationMins: 150,
      bookingRequired: true,
      bookingLeadHours: 12,
      slotsLabel: 'Pre-book online',
      included: ['All ingredients', 'Recipe booklet', 'Apron', 'Lunch/dinner'],
      bring: ['Enthusiasm', 'Appetite'],
      ageReq: null,
      groupSize: '4–10 people',
      cancellation: 'Full refund 48h before',
      label: 'Cultural Immersion',
    },
  },
  {
    keywords: ['yoga', 'meditation', 'wellness', 'spa'],
    profile: {
      difficulty: 'Beginner',
      difficultyScore: 1,
      durationMins: 90,
      bookingRequired: true,
      bookingLeadHours: 6,
      slotsLabel: 'Walk-in welcome',
      included: ['Mat', 'Instructor', 'Herbal tea'],
      bring: ['Comfortable clothing'],
      ageReq: null,
      groupSize: '2–15 people',
      cancellation: 'Full refund 24h before',
      label: 'Best for Beginners',
    },
  },
  {
    keywords: ['camping', 'camp', 'bonfire', 'stargazing'],
    profile: {
      difficulty: 'Beginner',
      difficultyScore: 2,
      durationMins: 480,
      bookingRequired: true,
      bookingLeadHours: 24,
      slotsLabel: '3 tents available',
      included: ['Tent', 'Sleeping bag', 'Dinner + breakfast', 'Bonfire setup', 'Guide'],
      bring: ['Personal toiletries', 'Warm clothes', 'Torch/headlamp'],
      ageReq: null,
      groupSize: '2–20 people',
      cancellation: 'Full refund 48h before',
      label: 'Family Activity',
    },
  },
  {
    keywords: ['cycling', 'cycle', 'bike tour', 'mountain bike'],
    profile: {
      difficulty: 'Intermediate',
      difficultyScore: 3,
      durationMins: 120,
      bookingRequired: false,
      bookingLeadHours: 0,
      slotsLabel: 'Walk-in',
      included: ['Bicycle rental', 'Helmet', 'Route map'],
      bring: ['Sunglasses', 'Water bottle', 'Comfortable clothing'],
      ageReq: '10+ years',
      groupSize: 'Individual or group',
      cancellation: 'Not applicable',
      label: 'Scenic Adventure',
    },
  },
  {
    keywords: ['workshop', 'pottery', 'art', 'craft', 'painting', 'weaving'],
    profile: {
      difficulty: 'Beginner',
      difficultyScore: 1,
      durationMins: 120,
      bookingRequired: true,
      bookingLeadHours: 6,
      slotsLabel: 'Pre-book online',
      included: ['All materials', 'Expert instructor', 'Take home your creation'],
      bring: ['Clothes you can get dirty in'],
      ageReq: null,
      groupSize: '4–15 people',
      cancellation: 'Full refund 24h before',
      label: 'Cultural Immersion',
    },
  },
];

const DEFAULT_ACTIVITY_PROFILE: ActivityProfile = {
  difficulty: 'Beginner',
  difficultyScore: 2,
  durationMins: 90,
  bookingRequired: false,
  bookingLeadHours: 0,
  slotsLabel: 'Walk-in',
  included: ['Guide', 'Equipment basics'],
  bring: ['Comfortable shoes', 'Water'],
  ageReq: null,
  groupSize: 'Flexible',
  cancellation: 'Check with operator',
  label: 'Popular Choice',
};

function getActivityProfile(name: string, category: string): ActivityProfile {
  const lower = `${name} ${category}`.toLowerCase();
  for (const entry of ACTIVITY_PROFILES) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.profile;
    }
  }
  return DEFAULT_ACTIVITY_PROFILE;
}

function derivePricePerPerson(suggestion: Suggestion): number {
  if (suggestion.cost?.amount) return suggestion.cost.amount;
  if (suggestion.price_label) {
    const len = suggestion.price_label.replace(/[^$₹]/g, '').length;
    return len === 1 ? 300 : len === 2 ? 800 : len === 3 ? 1800 : 3000;
  }
  return 800;
}

// ── Main engine ────────────────────────────────────────────────────────────
export function getActivityRecommendations(
  suggestions: Suggestion[],
  tripContext: TripContext,
): ActivityRecommendation[] {
  return suggestions.map((suggestion, index) => {
    const profile = getActivityProfile(suggestion.name, suggestion.category);
    const pricePerPerson = derivePricePerPerson(suggestion);
    const priceLabel = `₹${pricePerPerson}/person`;

    // Bookings logic — if reservable field available, prefer it
    const bookingRequired = suggestion.details?.reservable ?? profile.bookingRequired;

    // Duration — prefer backend label, fallback to profile
    const durationMins = (() => {
      if (suggestion.duration_label) {
        const match = suggestion.duration_label.match(/(\d+)/);
        if (match && match[1]) return parseInt(match[1], 10) * (suggestion.duration_label!.includes('h') ? 60 : 1);
      }
      return profile.durationMins;
    })();
    const durationLabel =
      durationMins >= 60
        ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ''}`
        : `${durationMins}m`;

    // Difficulty from details if available
    const difficultyFromDetails = suggestion.details?.difficulty_level;
    const difficulty: DifficultyTier = (
      difficultyFromDetails === 'Easy' ? 'Beginner' :
      difficultyFromDetails === 'Moderate' ? 'Intermediate' :
      difficultyFromDetails === 'Hard' ? 'Advanced' :
      profile.difficulty
    );

    const difficultyScore = { Beginner: 1, Intermediate: 3, Advanced: 4, Expert: 5 }[difficulty];

    // Equipment included from details if available
    const whatIncluded = suggestion.details?.equipment_included
      ? ['Equipment included', ...profile.included.slice(1)]
      : profile.included;

    // Label assignment
    let label: ActivityLabel = profile.label;
    if (index === 0 && (suggestion.rating ?? 0) >= 4.4) label = 'Popular Choice';
    if (pricePerPerson < 500) label = 'Budget Pick';
    if (suggestion.details?.good_for_children) label = 'Family Activity';

    // Confidence
    const rating = suggestion.rating ?? 4.0;
    void (suggestion.distance_km); // not used in activity confidence, only ratings matter
    let confidence: 'High' | 'Medium' | 'Low';
    let confidenceReason: string;
    if (rating >= 4.4 && bookingRequired === false) {
      confidence = 'High';
      confidenceReason = `Walk-in activity with excellent reviews — no pre-planning needed.`;
    } else if (rating >= 4.0) {
      confidence = 'Medium';
      confidenceReason = `Well-rated experience${bookingRequired ? ' — book ahead to secure your slot' : ''}.`;
    } else {
      confidence = 'Low';
      confidenceReason = `Limited review data — check availability directly with the operator.`;
    }

    const strengths: string[] = [];
    if (suggestion.details?.equipment_included) strengths.push('All equipment provided — nothing to hire separately');
    if (suggestion.details?.guided_tour) strengths.push('Expert guide included — safe for first-timers');
    if (!bookingRequired) strengths.push('Walk-in friendly — no advance booking needed');
    if (pricePerPerson < 600) strengths.push(`Budget-friendly at ${priceLabel}`);
    if (strengths.length === 0) strengths.push(`${durationLabel} well-spent — highly rated by similar travellers`);

    const tradeOffs: string[] = [];
    if (bookingRequired) tradeOffs.push(`Advance booking required — book at least ${profile.bookingLeadHours}h before`);
    if (difficultyScore >= 4) tradeOffs.push('Not suitable for guests with heart or joint conditions');

    return {
      suggestion,
      label,
      confidence,
      confidenceReason,
      strengths,
      tradeOffs,
      difficulty,
      difficultyScore,
      durationMins,
      durationLabel,
      pricePerPerson,
      priceLabel,
      bookingRequired,
      bookingLeadTimeHours: profile.bookingLeadHours,
      slotsAvailableLabel: profile.slotsLabel,
      whatIncluded,
      whatToBring: profile.bring,
      ageRequirement: profile.ageReq,
      groupSizeLabel: profile.groupSize,
      cancellationPolicy: profile.cancellation,
      itineraryContext: tripContext.activeNodeDayLabel || "Today's plan",
    };
  });
}
