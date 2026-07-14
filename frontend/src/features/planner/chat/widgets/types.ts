export type WidgetState = 
  | 'loading' 
  | 'empty' 
  | 'error' 
  | 'disabled' 
  | 'selected' 
  | 'editable' 
  | 'collapsed' 
  | 'active';

export interface BaseWidgetProps {
  id: string;
  state?: WidgetState;
  onStateChange?: (state: WidgetState) => void;
  title?: string;
  description?: string;
  errorMessage?: string;
  className?: string;
}

export interface InputWidgetProps<T = any> extends BaseWidgetProps {
  value?: T;
  onChange?: (value: T) => void;
  onSubmit?: (value: T) => void;
  placeholder?: string;
}

export interface SelectionWidgetProps<T = any> extends BaseWidgetProps {
  options: T[];
  onSelect?: (selectedOption: T) => void;
  multiSelect?: boolean;
  selectedValues?: T[];
}

export interface InformationWidgetProps<T = any> extends BaseWidgetProps {
  data: T;
  onRefresh?: () => void;
  lastUpdated?: Date;
}

export type WidgetType = 
  | 'destination_search'
  | 'flight_search'
  | 'compare_flights'
  | 'ai_recommendation_card'
  | 'live_flight_status'
  | 'route_preview'
  | string; // Allow custom strings for future extensibility

export interface DynamicWidgetProps {
  type: WidgetType;
  props: BaseWidgetProps | InputWidgetProps | SelectionWidgetProps | InformationWidgetProps;
}
