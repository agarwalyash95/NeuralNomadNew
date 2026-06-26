import { apiClient } from './api';
import { SavedPaymentMethod, TransactionRecord } from '@/types/wallet';

export const walletService = {
  async getPaymentMethods(): Promise<SavedPaymentMethod[]> {
    return apiClient.get('/wallet/payment-methods/');
  },

  async addPaymentMethod(data: Partial<SavedPaymentMethod>): Promise<SavedPaymentMethod> {
    return apiClient.post('/wallet/payment-methods/', data);
  },

  async updatePaymentMethod(id: string, data: Partial<SavedPaymentMethod>): Promise<SavedPaymentMethod> {
    return apiClient.patch(`/wallet/payment-methods/${id}/`, data);
  },

  async deletePaymentMethod(id: string): Promise<void> {
    return apiClient.delete(`/wallet/payment-methods/${id}/`);
  },

  async getTransactions(timeFilter: string = 'all'): Promise<TransactionRecord[]> {
    return apiClient.get(`/wallet/transactions/?time_filter=${timeFilter}`);
  },

  async createRazorpayOrder(amount: number, description: string): Promise<any> {
    return apiClient.post('/wallet/checkout/create_order/', { amount, description });
  },

  async verifyPayment(paymentId: string, orderId: string, signature: string): Promise<any> {
    return apiClient.post('/wallet/checkout/verify_payment/', {
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      razorpay_signature: signature,
    });
  },
};
