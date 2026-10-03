'use client';

import { normalizeMoneyDraft } from '@/lib/route-cash-flow';

interface MoneyDraftInputProps { value: string; onChange: (value: string) => void; ariaLabel: string; }

export function MoneyDraftInput({ value, onChange, ariaLabel }: MoneyDraftInputProps) {
  return <div className="relative">
    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-600">R$</span>
    <input type="text" inputMode="numeric" enterKeyHint="done" autoComplete="off" placeholder="0,00" value={value}
      onChange={(event) => onChange(normalizeMoneyDraft(event.target.value))}
      onBlur={() => onChange(normalizeMoneyDraft(value))} aria-label={ariaLabel}
      className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950/45 pl-12 pr-14 text-zinc-100 placeholder:text-zinc-700 focus:border-emerald-500 focus:outline-none" />
    {value && <button type="button" onClick={() => onChange('')} aria-label="Limpar troco inicial" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-zinc-500 active:bg-zinc-800">×</button>}
  </div>;
}
