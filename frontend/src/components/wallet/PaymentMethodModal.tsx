'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SavedPaymentMethod } from '@/types/wallet';
import { walletService } from '@/services/wallet.service';
import { Loader2, X } from 'lucide-react';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  methodType: 'card' | 'upi' | 'wallet' | null;
  editMethod: SavedPaymentMethod | null;
}

export default function PaymentMethodModal({ isOpen, onClose, onSuccess, methodType, editMethod }: PaymentMethodModalProps) {
  const [provider, setProvider] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editMethod) {
      setProvider(editMethod.provider);
      setIdentifier(editMethod.identifier);
    } else {
      setProvider('');
      setIdentifier('');
    }
  }, [editMethod, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!methodType) return;
    setLoading(true);
    try {
      if (editMethod) {
        await walletService.updatePaymentMethod(editMethod.id, { provider, identifier });
      } else {
        await walletService.addPaymentMethod({ method_type: methodType, provider, identifier, is_default: false });
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to save payment method.');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (editMethod) return `Edit ${methodType?.toUpperCase()}`;
    if (methodType === 'card') return 'Add New Card';
    if (methodType === 'upi') return 'Link UPI ID';
    return 'Link Digital Wallet';
  };

  const getIdentifierLabel = () => {
    if (methodType === 'card') return 'Card Number (Last 4 digits for now)';
    if (methodType === 'upi') return 'UPI ID (e.g. name@okaxis)';
    return 'Wallet Mobile Number / ID';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl p-6 sm:p-8"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-slate-900 mb-6">{getTitle()}</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Provider Name</label>
                <input
                  type="text"
                  required
                  placeholder={methodType === 'card' ? 'Visa / Mastercard' : methodType === 'upi' ? 'Google Pay / PhonePe' : 'Paytm / Amazon Pay'}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{getIdentifierLabel()}</label>
                <input
                  type="text"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full flex justify-center items-center rounded-xl bg-indigo-600 p-3 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-md shadow-indigo-600/20 transition-all"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Payment Method'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
