'use client';

import { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';
import type { Customer } from '@/types';

interface CustomerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  customers: Customer[];
}

export function CustomerAutocomplete({ value, onChange, customers }: CustomerAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const trimmed = value.trim().toLowerCase();
  const suggestions = trimmed.length > 0
    ? customers
        .filter((c) => c.name.toLowerCase().includes(trimmed))
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
    setShowSuggestions(false);
  }

  return (
    <div ref={wrapperRef} className="relative flex flex-col gap-2">
      <label className="text-sm font-semibold text-zinc-400">Nome do Cliente (Opcional)</label>
      <div className="relative">
        <User size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
        <input
          type="text"
          placeholder="Ex: João Silva"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-11 pr-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          autoComplete="off"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl">
          {suggestions.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelect(c)}
              className="flex w-full items-center px-4 py-3 text-left text-sm text-zinc-200 active:bg-zinc-800"
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
