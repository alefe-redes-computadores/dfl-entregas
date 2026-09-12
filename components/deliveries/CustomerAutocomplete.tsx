'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  MapPin,
  Phone,
  User,
} from 'lucide-react';

import type { Customer } from '@/types';
import {
  normalizeCustomerAddress,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from '@/lib/customer-identity';

interface CustomerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (customer: Customer) => void;
  customers: Customer[];
}

export function CustomerAutocomplete({
  value,
  onChange,
  onSelect,
  customers,
}: CustomerAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] =
    useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const nameQuery = normalizeCustomerName(value);
    const phoneQuery = normalizeCustomerPhone(value);
    const addressQuery = normalizeCustomerAddress(value);

    if (
      !nameQuery &&
      phoneQuery.length < 3 &&
      !addressQuery
    ) {
      return [];
    }

    return customers
      .map((customer) => {
        const customerName = normalizeCustomerName(
          customer.name,
        );

        const customerPhone = normalizeCustomerPhone(
          customer.phone,
        );

        const customerAddress =
          normalizeCustomerAddress(customer.address);

        let score = 0;

        if (nameQuery) {
          if (customerName === nameQuery) score += 100;
          else if (customerName.startsWith(nameQuery))
            score += 70;
          else if (customerName.includes(nameQuery))
            score += 50;
        }

        if (
          phoneQuery.length >= 3 &&
          customerPhone.includes(phoneQuery)
        ) {
          score += 80;
        }

        if (
          addressQuery.length >= 4 &&
          customerAddress.includes(addressQuery)
        ) {
          score += 30;
        }

        return { customer, score };
      })
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.customer.name.localeCompare(
            b.customer.name,
            'pt-BR',
          ),
      )
      .slice(0, 6)
      .map((item) => item.customer);
  }, [customers, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    );

    return () =>
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
  }, []);

  function handleSelect(customer: Customer) {
    onChange(customer.name);
    onSelect?.(customer);
    setShowSuggestions(false);
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex flex-col gap-2"
    >
      <label className="text-sm font-semibold text-zinc-400">
        Nome do Cliente
      </label>

      <div className="relative">
        <User
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
        />

        <input
          type="text"
          placeholder="Ex: João Silva ou (34) 9..."
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-11 pr-4 text-zinc-100 placeholder:text-zinc-600 transition-colors focus:border-emerald-500 focus:outline-none"
          autoComplete="off"
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full z-30 mt-1 max-h-72 w-full divide-y divide-zinc-800/60 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur-xl">
          {suggestions.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => handleSelect(customer)}
              className="flex w-full flex-col px-4 py-3 text-left transition-colors active:bg-zinc-800"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-zinc-100">
                  {customer.name}
                </span>

                {customer.phone && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-400">
                    <Phone size={10} />
                    {customer.phone}
                  </span>
                )}
              </div>

              {customer.address && (
                <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-400">
                  <MapPin
                    size={11}
                    className="shrink-0 text-zinc-500"
                  />
                  {customer.address}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
