/**
 * TripContext — computed from planData in PlannerWorkspace and passed
 * as props to every Helper Canvas so they can auto-prefill search fields
 * and know which Plan Canvas node triggered them (for Replace flow).
 */

import type { BlockCost } from './plan-canvas/types';

export interface TripContext {
  /** The workspace / trip ID */
  tripId: string | null;
  /** Primary destination — first city in the trip (e.g. "Manali") */
  destination: string;
  /** All cities in the trip in order (e.g. ["Manali", "Kasol", "Delhi"]) */
  allCities: string[];
  /** Trip start date string (e.g. "Oct 15") */
  startDate: string;
  /** Trip end date string (e.g. "Oct 21") */
  endDate: string;
  /** Number of travellers */
  travellers: number;
  /** Currency code (default "INR") */
  currency: string;

  // ── Replace Node Flow ──────────────────────────────────────
  /** ID of the node that triggered the canvas open — used for Replace */
  activeNodeId?: string;
  /** Day ID that contains the active node */
  activeNodeDayId?: string;
  /** City ID that contains the active node */
  activeNodeCityId?: string;
  /** Type of the active node (e.g. "hotel", "flight", "food") */
  activeNodeType?: string;
  /** Human-readable name of the active node (e.g. "Zostel Manali") */
  activeNodeTitle?: string;
  /** Display price of the active node right now (e.g. "₹3,500 / night") — lets a Helper Canvas show "currently: X" */
  activeNodePrice?: string;
  /** Structured cost + provenance of the active node, if it has one — source of truth over activeNodePrice */
  activeNodeCost?: BlockCost;
  /** Human-readable day label (e.g. "Day 1 — Oct 15") */
  activeNodeDayLabel?: string;
  /** Subtitle of the active node (often holds origin/destination or location) */
  activeNodeSubtitle?: string;
  /** Start time of the active node */
  activeNodeStartTime?: string;
  /** Name of the city where the node is located */
  activeNodeCityName?: string;
  /** Date of the node */
  activeNodeDateStr?: string;
  /** Nights the active node's city segment covers — for stay-context bars (hotels) */
  activeNodeCityNights?: number;
  /** "Oct 15 to Oct 18" — the active node's city segment's arrival→departure range */
  activeNodeCityDateRange?: string;
  /** Latitude of the active node */
  activeNodeLatitude?: number;
  /** Longitude of the active node */
  activeNodeLongitude?: number;
  /** Titles already planned for the day in play — lets Helper Canvases skip suggesting duplicates */
  activeDayItemTitles?: string[];
  /** Geo-tagged items across every day of the active city segment (not just
   *  the active day) — a hotel booking spans the whole stay, so itinerary-
   *  impact math needs the full segment, not one day. Real coordinates only;
   *  items without lat/lng are omitted rather than estimated. */
  activeCityItems?: {
    id: string;
    title: string;
    type: string;
    latitude: number;
    longitude: number;
    dayLabel: string;
    dayNumber: number;
    startTime?: string;
  }[];
}

/** Emitted by ItineraryTimeline when any item is clicked */
export interface NodeClickPayload {
  nodeId: string;
  nodeType: string;
  nodeTitle: string;
  dayId: string;
  dayNumber: number;
  dayLabel: string;
  cityId: string;
  cityName: string;
  dateStr: string;
  subtitle: string;
  startTime: string;
  latitude?: number;
  longitude?: number;
  /** The clicked item's current display price, if it has one — carried into the Helper Canvas */
  price?: string;
  /** The clicked item's structured cost + provenance, if it has one */
  cost?: BlockCost;
  /** Insert-between: place the new item right after this existing item's
   *  id in the day, instead of appending to the end of the day. */
  insertAfterId?: string;
}
