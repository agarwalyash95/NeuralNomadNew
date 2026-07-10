'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon?: React.ElementType;
}

export default function SelectField({
  label,
  value,
  options,
  onChange,
  icon: Icon,
}: SelectFieldProps) {
  return (
    <div className="group relative w-full rounded-2xl border border-line-strong bg-white px-3 py-3 transition-colors focus-within:border-blue-500">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600">
        {label}
      </label>
      <div className="relative flex items-center gap-2">
        {Icon ? <Icon size={16} className="shrink-0 text-slate-400 group-focus-within:text-blue-500" /> : null}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full cursor-pointer truncate appearance-none bg-transparent pr-4 text-sm font-semibold text-slate-800 outline-none"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}
