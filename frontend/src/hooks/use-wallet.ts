'use client';

import { useEffect, useState } from 'react';
import { walletService } from '@/services/wallet.service';
import { SavedPaymentMethod, TransactionRecord } from '@/types/wallet';

export function useWallet() {
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadWallet() {
    try {
      setLoading(true);
      const [methods, txns] = await Promise.all([
        walletService.getPaymentMethods(),
        walletService.getTransactions(),
      ]);
      setPaymentMethods(Array.isArray(methods) ? methods : []);
      setTransactions(Array.isArray(txns) ? txns : []);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet();
  }, []);

  return {
    paymentMethods,
    transactions,
    loading,
    reload: loadWallet,
  };
}
