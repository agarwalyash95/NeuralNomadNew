/**
 * Application constants
 */

export const APP_NAME = 'NeuralNomad';
export const APP_DESCRIPTION = 'AI-powered travel planning platform for Indian users';
export const APP_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  TIMEOUT: 30000,
};

// Trip Types
export const TRIP_TYPES = {
  LEISURE: 'leisure',
  BUSINESS: 'business',
  ADVENTURE: 'adventure',
  CULTURAL: 'cultural',
} as const;

// Trip Status
export const TRIP_STATUS = {
  PLANNING: 'planning',
  BOOKED: 'booked',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

// Travel Styles
export const TRAVEL_STYLES = {
  LUXURY: 'luxury',
  BUDGET: 'budget',
  MID_RANGE: 'mid-range',
  ADVENTURE: 'adventure',
} as const;

// Seat Preferences
export const SEAT_PREFERENCES = {
  AISLE: 'aisle',
  WINDOW: 'window',
  ANY: 'any',
} as const;

// Chat Roles
export const CHAT_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

// Document Types
export const DOCUMENT_TYPES = {
  PASSPORT: 'passport',
  VISA: 'visa',
  TICKET: 'ticket',
  HOTEL_BOOKING: 'hotel_booking',
  INSURANCE: 'insurance',
} as const;

// Currency Codes
export const CURRENCY_CODES = {
  INR: 'INR',
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  AED: 'AED',
  SGD: 'SGD',
  MYR: 'MYR',
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  TRIPS: '/trips',
  PLANNER: '/planner',
  CHAT: '/chat',
  PROFILE: '/profile',
  SETTINGS: '/settings',
} as const;

// Feature Flags
export const FEATURES = {
  ENABLE_CHAT: true,
  ENABLE_BOOKING: false,
  ENABLE_WALLET: true,
  ENABLE_NOTIFICATIONS: true,
} as const;
