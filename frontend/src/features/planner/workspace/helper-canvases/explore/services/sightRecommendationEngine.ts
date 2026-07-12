import type { Suggestion } from '../../../plan-canvas/types';
import type { TripContext } from '../../../types';

// ── Label taxonomy ────────────────────────────────────────────────────────
export type AttractionLabel =
  | 'Must Visit'
  | 'Best View'
  | 'Hidden Gem'
  | 'Sunset Pick'
  | 'Family Favorite'
  | 'Easy Walk'
  | 'Heritage Highlight';

export type TimingSlot = 'sunrise' | 'morning' | 'golden_hour' | 'evening' | 'anytime';
export type WeatherSuitability = 'outdoor_sunny' | 'outdoor_cloudy' | 'indoor_only' | 'any';
export type CrowdLevel = 'Low' | 'Moderate' | 'Busy' | 'Peak';

// ── Experience quality model ───────────────────────────────────────────────
// Six dimensions replace a single numeric rating. Each 1–5 so they can be
// rendered as filled/unfilled dots at a glance without reading a number.
export interface ExperienceQualities {
  /** How photogenic the location is */
  photography: number;
  /** Natural/landscape scenic value */
  scenic: number;
  /** Cultural, historical, or architectural depth */
  history: number;
  /** Suitability for families with children */
  familyFriendly: number;
  /** Wheelchair / limited-mobility accessibility */
  accessibility: number;
  /** Physical walking effort required (5 = strenuous, 1 = effortless) */
  walkingEffort: number;
}

export interface AttractionRecommendation {
  suggestion: Suggestion;
  label: AttractionLabel;
  confidence: 'High' | 'Medium' | 'Low';
  confidenceReason: string;
  strengths: string[];
  tradeOffs: string[];
  highlights: string[];
  experienceQualities: ExperienceQualities;
  timingSlot: TimingSlot;
  /** Human-readable best-time string e.g. "7:00–9:00 AM" */
  bestTimeWindow: string;
  weatherSuitability: WeatherSuitability;
  crowdLevel: CrowdLevel;
  /** When it's most crowded */
  crowdPeakTime: string;
  /** When it's quietest */
  quietTime: string;
  visitDurationMins: number;
  /** "Free" | "₹50" | "₹200–500" */
  entryFee: string;
  /** Itinerary position sentence */
  routePosition: string;
  walkTimeMins: number;
  itineraryContext: string;
  /** Inline amber warning chips e.g. ["Crowded 11am–2pm", "Bring water"] */
  contextualWarnings: string[];
}

// ── Heuristic knowledge base ───────────────────────────────────────────────
interface AttractionProfile {
  qualities: Partial<ExperienceQualities>;
  timing: TimingSlot;
  weather: WeatherSuitability;
  visitMins: number;
  crowdPeak: string;
  quietTime: string;
  highlights: string[];
  warnings: string[];
  entryHint?: string; // "Free" or a price hint
}

const PROFILES: { keywords: string[]; profile: AttractionProfile }[] = [
  {
    keywords: ['sunrise', 'peak', 'summit', 'top', 'view point', 'viewpoint', 'rooftop'],
    profile: {
      qualities: { photography: 5, scenic: 5, history: 1, walkingEffort: 4, accessibility: 2 },
      timing: 'sunrise',
      weather: 'outdoor_sunny',
      visitMins: 45,
      crowdPeak: '10am–12pm',
      quietTime: 'before 7am',
      highlights: ['Panoramic 360° views', 'Best light at golden hour', 'Photography haven'],
      warnings: ['Bring warm layers — wind chill intensifies at altitude', 'Slippery paths in wet weather'],
      entryHint: 'Free',
    },
  },
  {
    keywords: ['sunset', 'dusk', 'golden'],
    profile: {
      qualities: { photography: 5, scenic: 5, history: 1, familyFriendly: 3, accessibility: 3 },
      timing: 'golden_hour',
      weather: 'outdoor_sunny',
      visitMins: 60,
      crowdPeak: '5pm–7pm',
      quietTime: 'before 4pm',
      highlights: ['Dramatic evening light', "Popular photographer's spot", 'Romantic ambiance'],
      warnings: ['Crowds peak at sunset — arrive 45 min early for a prime spot'],
      entryHint: 'Free',
    },
  },
  {
    keywords: ['temple', 'mandir', 'shrine', 'gurudwara', 'mosque', 'church'],
    profile: {
      qualities: { history: 5, familyFriendly: 4, accessibility: 4, scenic: 3, photography: 3, walkingEffort: 2 },
      timing: 'morning',
      weather: 'any',
      visitMins: 40,
      crowdPeak: '9am–11am',
      quietTime: 'early morning (6–8am)',
      highlights: ['Active place of worship', 'Intricate local architecture', 'Spiritual atmosphere'],
      warnings: ['Remove footwear at the entrance', 'Dress modestly — avoid shorts and sleeveless', 'Photography may be restricted inside'],
    },
  },
  {
    keywords: ['fort', 'palace', 'castle', 'mahal', 'qila'],
    profile: {
      qualities: { history: 5, photography: 4, scenic: 4, familyFriendly: 3, accessibility: 3, walkingEffort: 3 },
      timing: 'morning',
      weather: 'any',
      visitMins: 90,
      crowdPeak: '11am–2pm',
      quietTime: 'before 10am',
      highlights: ['UNESCO heritage significance', 'Sweeping views from ramparts', 'Living history'],
      warnings: ['Allow 90 min minimum — often larger than expected', 'Audio guide available at entrance'],
    },
  },
  {
    keywords: ['museum', 'gallery', 'exhibition', 'heritage'],
    profile: {
      qualities: { history: 5, accessibility: 5, familyFriendly: 4, photography: 2, scenic: 1, walkingEffort: 1 },
      timing: 'morning',
      weather: 'indoor_only',
      visitMins: 75,
      crowdPeak: '11am–1pm',
      quietTime: 'weekday mornings',
      highlights: ['Curated historical artefacts', 'Air-conditioned refuge on hot days', 'Family-friendly exhibits'],
      warnings: ['Photography often restricted inside display halls'],
    },
  },
  {
    keywords: ['waterfall', 'falls', 'jharna'],
    profile: {
      qualities: { photography: 5, scenic: 5, familyFriendly: 4, walkingEffort: 3, history: 1, accessibility: 2 },
      timing: 'morning',
      weather: 'outdoor_cloudy',
      visitMins: 50,
      crowdPeak: '12pm–3pm',
      quietTime: 'before 9am',
      highlights: ['Mist-spray photography', 'Natural cooling effect in summer', 'Lush surroundings'],
      warnings: ['Rocks can be extremely slippery — wear grip shoes', 'Flow is best post-monsoon (July–Sept)'],
    },
  },
  {
    keywords: ['lake', 'kund', 'reservoir', 'pond'],
    profile: {
      qualities: { photography: 4, scenic: 5, familyFriendly: 3, accessibility: 3, history: 2, walkingEffort: 2 },
      timing: 'golden_hour',
      weather: 'outdoor_sunny',
      visitMins: 45,
      crowdPeak: '2pm–5pm',
      quietTime: 'early morning',
      highlights: ['Mirror-like reflections at dawn', 'Serene natural setting', 'Good boating options'],
      warnings: ['Swimming is typically prohibited — check local rules'],
    },
  },
  {
    keywords: ['park', 'garden', 'botanical', 'nature reserve'],
    profile: {
      qualities: { familyFriendly: 5, scenic: 4, accessibility: 5, photography: 3, history: 1, walkingEffort: 2 },
      timing: 'morning',
      weather: 'outdoor_sunny',
      visitMins: 60,
      crowdPeak: '10am–12pm',
      quietTime: 'early morning',
      highlights: ['Great for a leisurely walk', 'Picnic-friendly space', 'Kids can explore freely'],
      warnings: [],
    },
  },
  {
    keywords: ['market', 'bazaar', 'mall road', 'shopping'],
    profile: {
      qualities: { familyFriendly: 4, accessibility: 5, history: 2, photography: 3, scenic: 2, walkingEffort: 1 },
      timing: 'evening',
      weather: 'any',
      visitMins: 60,
      crowdPeak: '6pm–9pm',
      quietTime: 'mid-morning',
      highlights: ['Local crafts and woolens', 'Street food stalls in the evening', 'Evening vibe'],
      warnings: ['Bargain actively — marked prices are typically negotiable by 20–40%'],
    },
  },
];

const DEFAULT_PROFILE: AttractionProfile = {
  qualities: { photography: 3, scenic: 3, history: 2, familyFriendly: 3, accessibility: 3, walkingEffort: 2 },
  timing: 'anytime',
  weather: 'any',
  visitMins: 45,
  crowdPeak: '11am–2pm',
  quietTime: 'early morning',
  highlights: ['Local point of interest', 'Worth a visit on your route'],
  warnings: [],
};

function getProfile(name: string, category: string): AttractionProfile {
  const lower = `${name} ${category}`.toLowerCase();
  for (const entry of PROFILES) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.profile;
    }
  }
  return DEFAULT_PROFILE;
}

function buildQualities(profile: AttractionProfile, suggestion: Suggestion): ExperienceQualities {
  const base: ExperienceQualities = {
    photography: 3,
    scenic: 3,
    history: 2,
    familyFriendly: 3,
    accessibility: 3,
    walkingEffort: 2,
    ...profile.qualities,
  };
  // Boost from real data
  const d = suggestion.details || {};
  if (d.wheelchair_accessible) base.accessibility = Math.min(5, base.accessibility + 1);
  if (d.good_for_children) base.familyFriendly = Math.min(5, base.familyFriendly + 1);
  if (d.good_for_groups) base.familyFriendly = Math.min(5, base.familyFriendly + 0.5);
  if (suggestion.rating && suggestion.rating >= 4.5) {
    base.photography = Math.min(5, base.photography + 1);
    base.scenic = Math.min(5, base.scenic + 1);
  }
  // Round all to integers
  return {
    photography: Math.round(base.photography),
    scenic: Math.round(base.scenic),
    history: Math.round(base.history),
    familyFriendly: Math.round(base.familyFriendly),
    accessibility: Math.round(base.accessibility),
    walkingEffort: Math.round(base.walkingEffort),
  };
}

function deriveLabel(
  profile: AttractionProfile,
  suggestion: Suggestion,
  index: number,
): AttractionLabel {
  const q = buildQualities(profile, suggestion);
  const nameLower = suggestion.name.toLowerCase();
  if (index === 0 && (suggestion.rating ?? 0) >= 4.3) return 'Must Visit';
  if (q.scenic >= 4 && q.photography >= 4) return profile.timing === 'golden_hour' ? 'Sunset Pick' : 'Best View';
  if (q.history >= 4) return 'Heritage Highlight';
  if (q.familyFriendly >= 4 && q.walkingEffort <= 2) return 'Family Favorite';
  if (q.walkingEffort <= 1 && q.accessibility >= 4) return 'Easy Walk';
  if (
    nameLower.includes('hidden') ||
    nameLower.includes('secret') ||
    ((suggestion.rating ?? 0) < 4.0 && (suggestion.ratings_count ?? 0) < 100)
  ) return 'Hidden Gem';
  if (profile.timing === 'golden_hour') return 'Sunset Pick';
  return index % 2 === 0 ? 'Must Visit' : 'Easy Walk';
}

function deriveEntryFee(suggestion: Suggestion, profile: AttractionProfile): string {
  if (profile.entryHint) return profile.entryHint;
  if (suggestion.price_label) return suggestion.price_label;
  if (suggestion.cost?.amount) return `₹${suggestion.cost.amount}`;
  const name = suggestion.name.toLowerCase();
  if (name.includes('park') || name.includes('temple') || name.includes('lake')) return 'Free';
  return 'Varies';
}

function deriveRoutePosition(
  suggestion: Suggestion,
  tripContext: TripContext,
  walkMins: number,
): string {
  const nearby = (tripContext.activeDayItemTitles || []).filter(
    (t) => t.trim().toLowerCase() !== suggestion.name.trim().toLowerCase(),
  );
  if (nearby.length >= 2) {
    return `${walkMins} min walk · fits between ${nearby[0]} and ${nearby[1]}`;
  }
  if (nearby.length === 1) {
    return `${walkMins} min walk from ${nearby[0]}`;
  }
  if (tripContext.activeNodeTitle) {
    return `${walkMins} min walk from your current stop`;
  }
  return `${walkMins} min walk from city centre`;
}

// ── Main engine ────────────────────────────────────────────────────────────
export function getAttractionRecommendations(
  suggestions: Suggestion[],
  tripContext: TripContext,
): AttractionRecommendation[] {
  return suggestions.map((suggestion, index) => {
    const profile = getProfile(suggestion.name, suggestion.category);
    const qualities = buildQualities(profile, suggestion);
    const label = deriveLabel(profile, suggestion, index);

    const dist = suggestion.distance_km ?? 1.2;
    const walkMins = Math.round(dist * 12);
    const visitMins = profile.visitMins;

    const entryFee = deriveEntryFee(suggestion, profile);
    const routePosition = deriveRoutePosition(suggestion, tripContext, walkMins);

    // Confidence based on distance + rating
    const rating = suggestion.rating ?? 4.0;
    let confidence: 'High' | 'Medium' | 'Low' = 'Medium';
    let confidenceReason = '';
    if (dist <= 1.0 && rating >= 4.4) {
      confidence = 'High';
      confidenceReason = `Highly rated and only ${walkMins} min walk — perfect for your route.`;
    } else if (dist <= 2.5 && rating >= 4.0) {
      confidence = 'Medium';
      confidenceReason = `Good match — ${walkMins} min walk, well-rated by travellers.`;
    } else {
      confidence = 'Low';
      confidenceReason = `Interesting option but ${walkMins} min walk may extend your day.`;
    }

    // Best time window from timing slot
    const bestTimeWindow: Record<TimingSlot, string> = {
      sunrise: '6:00–8:00 AM',
      morning: '9:00–11:00 AM',
      golden_hour: '5:30–7:00 PM',
      evening: '6:00–9:00 PM',
      anytime: '9:00 AM–5:00 PM',
    };

    // Strengths & trade-offs
    const strengths: string[] = [...profile.highlights.slice(0, 2)];
    if (qualities.photography >= 4) strengths.push('Excellent photography opportunity');
    if (entryFee === 'Free') strengths.push('No entry fee');

    const tradeOffs: string[] = [];
    if (profile.crowdPeak) tradeOffs.push(`Gets busy during ${profile.crowdPeak}`);
    if (qualities.walkingEffort >= 4) tradeOffs.push('Steep or uneven terrain — not ideal for mobility issues');

    // Contextual warnings
    const contextualWarnings: string[] = [...profile.warnings.slice(0, 2)];
    if (qualities.walkingEffort >= 4) contextualWarnings.unshift('Moderate physical effort required');

    return {
      suggestion,
      label,
      confidence,
      confidenceReason,
      strengths,
      tradeOffs,
      highlights: profile.highlights,
      experienceQualities: qualities,
      timingSlot: profile.timing,
      bestTimeWindow: bestTimeWindow[profile.timing],
      weatherSuitability: profile.weather,
      crowdLevel:
        rating >= 4.6 ? 'Peak' : rating >= 4.3 ? 'Busy' : rating >= 4.0 ? 'Moderate' : 'Low',
      crowdPeakTime: profile.crowdPeak,
      quietTime: profile.quietTime,
      visitDurationMins: visitMins,
      entryFee,
      routePosition,
      walkTimeMins: walkMins,
      itineraryContext: tripContext.activeNodeDayLabel || "Today's route",
      contextualWarnings,
    };
  });
}
