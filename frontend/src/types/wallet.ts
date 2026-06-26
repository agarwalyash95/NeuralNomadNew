export interface SavedPaymentMethod {
  id: string;
  method_type: 'card' | 'upi' | 'wallet';
  provider: string;
  identifier: string;
  is_default: boolean;
  created_at: string;
}

export interface TransactionRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  description: string;
  created_at: string;
  razorpay_order_id: string;
}
