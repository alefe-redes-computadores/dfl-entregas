'use client';

import { useEffect, useRef, useState } from 'react';
import { User, Phone, MapPin } from 'lucide-react';
import type { Customer } from '@/types';

interface CustomerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (customer: Customer) => void;
  customers: Customer[];
}

export function CustomerAutocomplete({ value, onChange, onSelect, customers }: CustomerAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const trimmed = value.trim().toLowerCase();
  const digits = value.replace(/\D/g, '');

  const suggestions = trimmed.length > 0
    ? customers
        .filter((c) => {
          const matchName = c.name.toLowerCase().includes(trimmed);
          const matchPhone = digits.length >= 3 && c.phone ? c.phone.includes(digits) : false;
          return matchName || matchPhone;
        })
        .slice(0, 5)
    : [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(customer: Customer) {
    onChange(customer.name);
    if (onSelect) onSelect(customer);
    setShowSuggestions(false);
  }

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-2">
      <label className="text-sm font-semibold text-zinc-400">Nome do Cliente</label>
      <div className="relative">
        <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Ex: João Silva ou (34) 9..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-11 pr-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none transition-colors"
          autoComplete="off"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/95 backdrop-blur-xl shadow-2xl divide-y divide-zinc-800/60">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="flex w-full flex-col px-4 py-3 text-left active:bg-zinc-800 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-zinc-100">{c.name}</span>
                {c.phone && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                    <Phone size={10} /> {c.phone}
                  </span>
                )}
              </div>
              {c.address && (
                <span className="flex items-center gap-1 text-xs text-zinc-400 truncate mt-0.5">
                  <MapPin size={11} className="shrink-0 text-zinc-500" /> {c.address}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
