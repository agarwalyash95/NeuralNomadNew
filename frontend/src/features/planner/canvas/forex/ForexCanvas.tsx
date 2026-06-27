'use client';

import React from 'react';
import { Coins, ArrowRightLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { StandardCanvas } from '../shared/StandardCanvas';
import { motion } from 'framer-motion';

export default function ForexCanvas({ workspaceId }: { workspaceId: string }) {
  return (
    <StandardCanvas canvasType="forex">
      <div className="space-y-4 py-2">
        {/* Exchange rate card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-mint-50/40 dark:from-emerald-900/15 dark:to-teal-900/10 border border-emerald-100/50 dark:border-emerald-800/30"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10">
              <ArrowRightLeft size={16} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Currency Exchange</h3>
              <p className="text-[10px] text-slate-500">Live exchange rates</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { from: 'INR', to: 'USD', rate: '0.012', change: '+0.2%', up: true },
              { from: 'INR', to: 'EUR', rate: '0.011', change: '-0.1%', up: false },
              { from: 'INR', to: 'JPY', rate: '1.82', change: '+0.5%', up: true },
              { from: 'INR', to: 'THB', rate: '0.42', change: '+0.3%', up: true },
              { from: 'INR', to: 'GBP', rate: '0.0094', change: '-0.15%', up: false },
            ].map((rate, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/60 dark:bg-slate-800/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {rate.from} → {rate.to}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {rate.rate}
                  </span>
                  <span className={`flex items-center gap-0.5 text-[10px] font-medium ${rate.up ? 'text-emerald-500' : 'text-red-400'}`}>
                    {rate.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {rate.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Tips */}
        <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100/40 dark:border-amber-800/20">
          <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
            💡 <strong>Tip:</strong> Exchange currency before departure for better rates. Airport exchanges typically have a 3-5% markup.
          </p>
        </div>
      </div>
    </StandardCanvas>
  );
}
