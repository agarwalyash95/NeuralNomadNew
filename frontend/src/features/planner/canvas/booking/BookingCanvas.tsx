'use client';

import React from 'react';
import { ShoppingCart, CreditCard, Sparkles } from 'lucide-react';
import { StandardCanvas, EmptyCanvasState } from '../shared/StandardCanvas';
import { useCart } from '@/hooks/use-planner';
import { formatCurrency } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function BookingCanvas({ workspaceId }: { workspaceId: string }) {
  const { data: cartItems, isLoading } = useCart(workspaceId);

  const total = cartItems?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;

  return (
    <StandardCanvas canvasType="booking">
      {isLoading ? (
        <div className="space-y-2 py-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !cartItems || cartItems.length === 0 ? (
        <EmptyCanvasState
          icon={<ShoppingCart size={20} className="text-violet-500" />}
          title="Your cart is empty"
          description="Add flights, hotels, and activities from the canvas panels to start booking."
        />
      ) : (
        <div className="space-y-3 py-2">
          {/* Cart items */}
          {cartItems.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 rounded-xl bg-white/60 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-700/30"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.title}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">{item.item_type} · {item.provider}</p>
                </div>
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {formatCurrency(item.price, item.currency_code)}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Total */}
          <div className="pt-2 border-t border-slate-200/40 dark:border-slate-700/30">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Checkout button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs font-semibold shadow-lg shadow-violet-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <CreditCard size={14} />
            Proceed to Checkout
          </motion.button>
        </div>
      )}
    </StandardCanvas>
  );
}
