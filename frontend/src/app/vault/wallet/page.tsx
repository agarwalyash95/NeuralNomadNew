'use client';

import React, { useState, useEffect } from 'react';
import GlassCard from '@/components/ui-custom/glass-card';
import { CreditCard, Smartphone, Wallet as WalletIcon, Plus, Trash2, Edit2 } from 'lucide-react';
import { walletService } from '@/services/wallet.service';
import { SavedPaymentMethod } from '@/types/wallet';
import PaymentMethodModal from '@/components/wallet/PaymentMethodModal';

export default function VaultWalletPage() {
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'card' | 'upi' | 'wallet' | null>(null);
  const [editMethod, setEditMethod] = useState<SavedPaymentMethod | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const methodsData = await walletService.getPaymentMethods();
      setMethods(Array.isArray(methodsData) ? methodsData : (methodsData as any)?.results || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this payment method?')) {
      await walletService.deletePaymentMethod(id);
      loadData();
    }
  };

  const openAddModal = (type: 'card' | 'upi' | 'wallet') => {
    setModalType(type);
    setEditMethod(null);
    setIsModalOpen(true);
  };

  const openEditModal = (method: SavedPaymentMethod) => {
    setModalType(method.method_type);
    setEditMethod(method);
    setIsModalOpen(true);
  };

  const cards = methods.filter(m => m.method_type === 'card');
  const upis = methods.filter(m => m.method_type === 'upi');
  const wallets = methods.filter(m => m.method_type === 'wallet');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Wallet & Payment Methods</h2>
        <p className="text-slate-500 mt-1">Manage your saved cards, UPI IDs, and digital wallets securely.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* 1. Saved Cards */}
        <GlassCard className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><CreditCard size={20} /></div>
              <h2 className="text-lg font-bold">Saved Cards</h2>
            </div>
            <button onClick={() => openAddModal('card')} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"><Plus size={20} /></button>
          </div>
          <div className="space-y-4 flex-1">
            {loading ? (
              <div className="h-20 bg-slate-100 animate-pulse rounded-xl" />
            ) : cards.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No saved cards. Add one for faster checkout.</div>
            ) : (
              cards.map(card => (
                <div key={card.id} className="group relative rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">{card.provider}</p>
                      <p className="text-sm text-slate-500 font-mono mt-1">•••• {card.identifier}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(card)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(card.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* 2. Linked UPI */}
        <GlassCard className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Smartphone size={20} /></div>
              <h2 className="text-lg font-bold">Linked UPI</h2>
            </div>
            <button onClick={() => openAddModal('upi')} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors"><Plus size={20} /></button>
          </div>
          <div className="space-y-4 flex-1">
            {loading ? (
              <div className="h-20 bg-slate-100 animate-pulse rounded-xl" />
            ) : upis.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No UPI IDs linked.</div>
            ) : (
              upis.map(upi => (
                <div key={upi.id} className="group relative rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-sm transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">{upi.provider}</p>
                      <p className="text-sm text-slate-500 mt-1">{upi.identifier}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(upi)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(upi.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* 3. Digital Wallets */}
        <GlassCard className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><WalletIcon size={20} /></div>
              <h2 className="text-lg font-bold">Digital Wallets</h2>
            </div>
            <button onClick={() => openAddModal('wallet')} className="p-2 text-amber-600 hover:bg-amber-50 rounded-full transition-colors"><Plus size={20} /></button>
          </div>
          <div className="space-y-4 flex-1">
            {loading ? (
              <div className="h-20 bg-slate-100 animate-pulse rounded-xl" />
            ) : wallets.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No wallets linked. (e.g. Paytm, Amazon Pay)</div>
            ) : (
              wallets.map(wallet => (
                <div key={wallet.id} className="group relative rounded-xl border border-slate-200 p-4 hover:border-amber-300 hover:shadow-sm transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-slate-800">{wallet.provider}</p>
                      <p className="text-sm text-slate-500 mt-1">{wallet.identifier}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(wallet)} className="p-1.5 text-slate-400 hover:text-amber-600 rounded"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(wallet.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>

      {/* Modal */}
      <PaymentMethodModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={loadData}
        methodType={modalType}
        editMethod={editMethod}
      />
    </div>
  );
}
