'use client';

import React, { useState, useEffect } from 'react';
import GlassCard from '@/components/ui-custom/glass-card';
import { Clock, CheckCircle2, XCircle, ArrowDownToLine, Receipt } from 'lucide-react';
import { walletService } from '@/services/wallet.service';
import { TransactionRecord } from '@/types/wallet';

export default function VaultTransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const txData = await walletService.getTransactions(timeFilter);
      setTransactions(Array.isArray(txData) ? txData : (txData as any)?.results || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeFilter]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Recent Transactions
          </h2>
          <p className="text-slate-500 mt-1">A ledger of your recent payments, bookings, and refunds.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <Clock size={16} className="text-slate-400" />
            <select 
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="this_month">This Month</option>
              <option value="3months">Last 3 Months</option>
            </select>
          </div>
          <button className="flex items-center gap-2 bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm">
            <ArrowDownToLine size={16} />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      <GlassCard className="overflow-hidden p-0 border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6 font-bold">Transaction Info</th>
                <th className="py-4 px-6 font-bold">Amount</th>
                <th className="py-4 px-6 font-bold">Status</th>
                <th className="py-4 px-6 font-bold text-right">Order ID</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
                      <p className="text-slate-500 font-medium">Loading ledger...</p>
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <Receipt size={32} className="text-slate-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">No transactions found</h3>
                      <p className="text-slate-500 mt-1">There are no records for the selected time period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map(tx => {
                  const isRefund = tx.status === 'refunded';
                  const isFailed = tx.status === 'failed';
                  const isPending = tx.status === 'pending';
                  
                  return (
                    <tr key={tx.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-5 px-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                            isRefund ? 'bg-emerald-100 text-emerald-600' :
                            isFailed ? 'bg-red-100 text-red-600' :
                            isPending ? 'bg-amber-100 text-amber-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>
                            <Receipt size={20} />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{tx.description || 'General Payment'}</p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                              {new Date(tx.created_at).toLocaleDateString(undefined, {
                                year: 'numeric', month: 'long', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <span className={`font-bold text-base ${isRefund ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isRefund ? '+' : '-'} {tx.currency === 'INR' ? '₹' : tx.currency} {tx.amount}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider
                          ${tx.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                            tx.status === 'failed' ? 'bg-red-50 text-red-700 border border-red-200' : 
                            tx.status === 'refunded' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 
                            'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                          {tx.status === 'completed' && <CheckCircle2 size={14} />}
                          {tx.status === 'failed' && <XCircle size={14} />}
                          {tx.status === 'pending' && <Clock size={14} />}
                          {tx.status === 'refunded' && <CheckCircle2 size={14} />}
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {tx.razorpay_order_id || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
