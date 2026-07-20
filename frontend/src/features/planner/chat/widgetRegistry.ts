import React from 'react';
import type { WidgetData } from '@/services/planner.types';
import {
  OriginWidget,
  DestinationWidget,
  DateRangeWidget,
  OptionalDetailsWidget,
  NearbyCitiesWidget,
  ClusterWidget,
  SelfDriveWidget,
  DestinationHighlightWidget,
  MultiCityWidget,
  FoodPreferenceWidget,
  TripPreferenceWidget,
  ActivityPreferenceWidget,
  SpecialRequirementWidget,
  TransportSelectionWidget,
  AccommodationWidget,
  TransportPreferencesWidget,
  InternationalWidget,
  TravelIntelligenceWidget,
  PlanConfirmationWidget,
  GroupTypeWidget,
  TravelInsuranceWidget,
  PackingWidget,
} from './widgets';

type WidgetComponentType = React.ComponentType<{
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
  onConfirmAndGenerate?: () => void;
  isCompleted?: boolean;
}>;

export const WIDGET_REGISTRY: Record<string, WidgetComponentType> = {
  // Core Planning Widgets
  destination_search: DestinationWidget,
  origin_search: OriginWidget,
  date_range_picker: DateRangeWidget,
  multi_city: MultiCityWidget,
  destination_highlight: DestinationHighlightWidget,

  // Cluster cards — the WidgetOrchestrator ladder (backend/apps/planner/
  // services/intelligence/clusters.py) emits at most 5 of these + 1
  // confirmation for a full trip, fewer for single-service intents. One
  // generic renderer for all of them, driven entirely by payload content.
  cluster_party: ClusterWidget,
  cluster_trip_style: ClusterWidget,
  cluster_logistics: ClusterWidget,
  cluster_stay_style: ClusterWidget,
  cluster_journey_style: ClusterWidget,
  cluster_dining: ClusterWidget,
  cluster_fine_tune: ClusterWidget,
  self_drive_openness: SelfDriveWidget,
  self_drive_readiness: SelfDriveWidget,
  self_drive_route_comfort: SelfDriveWidget,

  // Confirmation
  plan_confirmation_widget: PlanConfirmationWidget,

  // Intelligence (Read-only inline cards)
  weather_insight: TravelIntelligenceWidget,
  holiday_insight: TravelIntelligenceWidget,
  crowd_insight: TravelIntelligenceWidget,
  budget_insight: TravelIntelligenceWidget,
  food_insight: TravelIntelligenceWidget,
  route_insight: TravelIntelligenceWidget,
  safety_insight: TravelIntelligenceWidget,
  visa_insight: TravelIntelligenceWidget,

  nearby_cities_recommendation: NearbyCitiesWidget,

  // ── LEGACY_WIDGETS ──────────────────────────────────────────────────────
  // The backend no longer emits any of these — the cluster ladder above
  // replaced them — but old persisted PlannerChatMessage rows still carry
  // these exact type strings, so they stay registered read-only for history
  // to keep rendering correctly.
  cluster_budget: ClusterWidget,          // pre-ladder cluster name for "budget"
  cluster_experience: ClusterWidget,      // pre-ladder cluster name for "trip_style"
  food_preference_widget: FoodPreferenceWidget,
  trip_preference_widget: TripPreferenceWidget,
  activity_preference_widget: ActivityPreferenceWidget,
  special_requirement_widget: SpecialRequirementWidget,
  transport_selection: TransportSelectionWidget,
  accommodation_widget: AccommodationWidget,
  transport_preferences: TransportPreferencesWidget,
  international_prep_widget: InternationalWidget,
  group_type_widget: GroupTypeWidget,
  travel_insurance_widget: TravelInsuranceWidget,
  packing_widget: PackingWidget,
  optional_trip_details: OptionalDetailsWidget,
};
