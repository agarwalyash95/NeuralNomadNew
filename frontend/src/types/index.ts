/**
 * Core type definitions for NeuralNomad frontend
 */

// ============================================
// User Types
// ============================================
export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  avatar?: string;
  preferred_currency: string;
  home_city?: string;
  home_airport?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthToken {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name: string;
  phone?: string;
}

// ============================================
// Trip Types
// ============================================
export interface Trip {
  id: string;
  userId: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  status: 'planning' | 'booked' | 'ongoing' | 'completed' | 'cancelled';
  tripType: 'leisure' | 'business' | 'adventure' | 'cultural';
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Itinerary Types
// ============================================
export interface ItineraryItem {
  id: string;
  tripId: string;
  dayNumber: number;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  estimatedCost: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Chat Types
// ============================================
export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

// ============================================
// Place & Attraction Types
// ============================================
export interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  name: string;
  country: string;
  rating: number;
  createdAt: string;
}

export interface Attraction {
  id: string;
  placeId: string;
  name: string;
  category: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  rating: number;
  createdAt: string;
}

// ============================================
// Travel Data Types
// ============================================
export interface VisaData {
  id: string;
  country: string;
  visaRequired: boolean;
  processingTime: string;
  fees: number;
  requiredDocuments: string[];
  createdAt: string;
}

export interface ForexData {
  id: string;
  currency: string;
  exchangeRate: number;
  updatedAt: string;
}

// ============================================
// Travel Pass Types
// ============================================
export interface TravelPass {
  id: string;
  userId: string;
  tripId: string;
  pdfPath: string;
  documentPath: string;
  createdAt: string;
}

// ============================================
// Wallet Types
// ============================================
export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  rewardPoints: number;
  updatedAt: string;
}

// ============================================
// Notification Types
// ============================================
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================
// User Preference Types
// ============================================
export interface UserPreference {
  id: string;
  userId: string;
  budgetRange: {
    min: number;
    max: number;
  };
  favoriteDestinations: string[];
  travelStyle: 'luxury' | 'budget' | 'mid-range' | 'adventure';
  seatPreference: 'aisle' | 'window' | 'any';
  createdAt: string;
  updatedAt: string;
}

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

// ============================================
// Error Types
// ============================================
export interface ApiError {
  message: string;
  status: number;
  code: string;
  /** Raw response body — some endpoints (e.g. 409 book/) carry structured
   *  fields beyond message/status/code, such as `blocking_blocks`. */
  data?: any;
}
