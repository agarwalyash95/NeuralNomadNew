export interface VisaInfo {
  id: string;
  country: string;
  visa_required: boolean;
  visa_type: string;
  processing_time: string;
  processing_time_days: number | null;
  fees: number | null;
  currency: string;
  validity: string;
  entry_type: 'SINGLE' | 'MULTIPLE' | 'UNKNOWN' | '';
  max_stay_duration: string;
  required_documents: string[];
  exemptions: string[];
  official_link: string | null;
  notes: string;
  updated_at?: string;
}
