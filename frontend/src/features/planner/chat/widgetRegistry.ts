import React from 'react';
import type { WidgetData } from '@/services/planner.types';
import {
  OriginWidget,
  DestinationWidget,
  DateRangeWidget,
  OptionalDetailsWidget,
  NearbyCitiesWidget,
} from './widgets';

type WidgetComponentType = React.ComponentType<{
  widget: WidgetData;
  onSubmit: (message: string, structuredValue: any) => void;
}>;

export const WIDGET_REGISTRY: Record<string, WidgetComponentType> = {
  destination_search: DestinationWidget,
  origin_search: OriginWidget,
  date_range_picker: DateRangeWidget,
  optional_trip_details: OptionalDetailsWidget,
  nearby_cities_recommendation: NearbyCitiesWidget,
};
