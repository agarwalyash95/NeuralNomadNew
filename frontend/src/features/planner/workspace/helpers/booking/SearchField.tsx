'use client';

import React from 'react';

interface SearchFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
  icon?: React.ElementType;
}

export default function SearchField({
  label,
  value,
  placeholder,
  type = 'text',
  onChange,
  icon: Icon,
}: SearchFieldProps) {
  return (
    <div className="group relative w-full rounded-2xl border border-[#ddd7ca] bg-white px-3 py-3 transition-colors focus-within:border-blue-500">
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors group-focus-within:text-blue-600">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {Icon ? <Icon size={16} className="shrink-0 text-slate-400 group-focus-within:text-blue-500" /> : null}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full truncate bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-300 outline-none"
        />
      </div>
    </div>
  );
}
