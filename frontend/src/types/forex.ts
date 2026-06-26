export interface ForexRate {
  id: string;
  currency: string;
  exchange_rate: number;
  base_currency: string;
  source: string;
  last_updated: string;
}

export interface VendorCurrencyInventory {
  id: string;
  currency: string;
  exchange_rate: number;
  quantity_available: number | null;
  is_available: boolean;
}

export interface ForexVendor {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  contact_number: string;
  rating: number;
  is_delivery_available: boolean;
  opening_hours: string;
  inventory: VendorCurrencyInventory[];
}

export type ForexRequestType = 'PICKUP' | 'DELIVERY';
export type ForexRequestStatus = 'PENDING' | 'APPROVED' | 'DELIVERED' | 'CANCELLED';

export interface ForexDeliveryRequest {
  id: string;
  vendor: string; // UUID
  vendor_name: string;
  vendor_address: string;
  from_currency: string;
  to_currency: string;
  amount: number;
  exchange_rate: number;
  converted_amount: number;
  request_type: ForexRequestType;
  request_type_display: string;
  status: ForexRequestStatus;
  status_display: string;
  preferred_date: string;
  preferred_time: string;
  contact_number: string;
  delivery_address?: string;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  notes?: string;
  created_at: string;
}

export interface CreateDeliveryRequestPayload {
  vendor: string; // UUID
  from_currency: string;
  to_currency: string;
  amount: number;
  request_type: ForexRequestType;
  preferred_date: string; // YYYY-MM-DD
  preferred_time: string; // HH:MM
  contact_number: string;
  delivery_address?: string;
  notes?: string;
}
