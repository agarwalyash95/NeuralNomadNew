export type DocumentType =
  | 'FLIGHT'
  | 'TRAIN'
  | 'BUS'
  | 'FERRY'
  | 'VISA'
  | 'HOTEL'
  | 'INSURANCE'
  | 'PASSPORT'
  | 'OTHER';

export type PassStatus = 'ACTIVE' | 'EXPIRED' | 'UPCOMING' | 'USED';

export interface TravelPass {
  id: string;
  trip: string | null;
  trip_destination?: string;
  title: string;
  description: string;
  document_type: DocumentType;
  origin: string;
  destination: string;
  document_path: string | null;
  pdf_path: string | null;
  valid_from: string | null;
  valid_until: string | null;
  reference_number: string;
  status: PassStatus;
  issuer: string;
  seat_info: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTravelPassRequest {
  trip?: string;
  title: string;
  description?: string;
  document_type: DocumentType;
  origin?: string;
  destination?: string;
  valid_from?: string;
  valid_until?: string;
  status?: PassStatus;
  issuer?: string;
  seat_info?: string;
  document_file?: File;
}

export const DOC_TYPE_META: Record<
  DocumentType,
  { label: string; emoji: string; colorFrom: string; colorTo: string; bgClass: string; textClass: string; borderClass: string }
> = {
  FLIGHT: {
    label: 'Flight',
    emoji: '✈️',
    colorFrom: '#0ea5e9',
    colorTo: '#6366f1',
    bgClass: 'bg-sky-500/20',
    textClass: 'text-sky-300',
    borderClass: 'border-sky-500/30',
  },
  TRAIN: {
    label: 'Train',
    emoji: '🚂',
    colorFrom: '#f97316',
    colorTo: '#eab308',
    bgClass: 'bg-orange-500/20',
    textClass: 'text-orange-300',
    borderClass: 'border-orange-500/30',
  },
  BUS: {
    label: 'Bus',
    emoji: '🚌',
    colorFrom: '#f59e0b',
    colorTo: '#84cc16',
    bgClass: 'bg-amber-500/20',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/30',
  },
  FERRY: {
    label: 'Ferry / Cruise',
    emoji: '⛴️',
    colorFrom: '#06b6d4',
    colorTo: '#3b82f6',
    bgClass: 'bg-cyan-500/20',
    textClass: 'text-cyan-300',
    borderClass: 'border-cyan-500/30',
  },
  VISA: {
    label: 'Visa',
    emoji: '🛂',
    colorFrom: '#8b5cf6',
    colorTo: '#ec4899',
    bgClass: 'bg-violet-500/20',
    textClass: 'text-violet-300',
    borderClass: 'border-violet-500/30',
  },
  HOTEL: {
    label: 'Hotel',
    emoji: '🏨',
    colorFrom: '#10b981',
    colorTo: '#14b8a6',
    bgClass: 'bg-emerald-500/20',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/30',
  },
  INSURANCE: {
    label: 'Insurance',
    emoji: '🛡️',
    colorFrom: '#ef4444',
    colorTo: '#f97316',
    bgClass: 'bg-rose-500/20',
    textClass: 'text-rose-300',
    borderClass: 'border-rose-500/30',
  },
  PASSPORT: {
    label: 'Passport',
    emoji: '📘',
    colorFrom: '#3b82f6',
    colorTo: '#1d4ed8',
    bgClass: 'bg-blue-500/20',
    textClass: 'text-blue-300',
    borderClass: 'border-blue-500/30',
  },
  OTHER: {
    label: 'Document',
    emoji: '📄',
    colorFrom: '#64748b',
    colorTo: '#475569',
    bgClass: 'bg-slate-500/20',
    textClass: 'text-slate-300',
    borderClass: 'border-slate-500/30',
  },
};
