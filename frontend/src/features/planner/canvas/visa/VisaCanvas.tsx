'use client';

import React from 'react';
import { FileCheck, CheckCircle2, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { StandardCanvas, EmptyCanvasState } from '../shared/StandardCanvas';
import { motion } from 'framer-motion';

export default function VisaCanvas({ workspaceId }: { workspaceId: string }) {
  return (
    <StandardCanvas canvasType="visa">
      <div className="space-y-4 py-2">
        {/* Status header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-violet-50/40 dark:from-indigo-900/15 dark:to-violet-900/10 border border-indigo-100/50 dark:border-indigo-800/30"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10">
              <FileCheck size={16} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Visa Requirements</h3>
              <p className="text-[10px] text-slate-500">Based on your nationality and destination</p>
            </div>
          </div>

          <div className="space-y-2">
            {[
              { doc: 'Valid Passport', status: 'required', note: 'Min. 6 months validity' },
              { doc: 'Tourist Visa', status: 'pending', note: 'Apply online — 3-5 business days' },
              { doc: 'Travel Insurance', status: 'optional', note: 'Recommended for international trips' },
              { doc: 'Return Ticket', status: 'required', note: 'Proof of onward travel' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl bg-white/60 dark:bg-slate-800/30">
                {item.status === 'required' ? (
                  <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />
                ) : item.status === 'pending' ? (
                  <Clock size={13} className="text-blue-500 flex-shrink-0" />
                ) : (
                  <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{item.doc}</p>
                  <p className="text-[10px] text-slate-400">{item.note}</p>
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  item.status === 'required' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                  item.status === 'pending' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                  'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Links */}
        <div className="space-y-1.5">
          <h4 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 px-1">Useful Links</h4>
          {[
            { label: 'Apply for e-Visa', url: '#' },
            { label: 'Embassy Contact', url: '#' },
            { label: 'Document Checklist', url: '#' },
          ].map((link, i) => (
            <button key={i} className="flex items-center gap-2 w-full p-2 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
              <ExternalLink size={11} className="text-indigo-400" />
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </StandardCanvas>
  );
}
