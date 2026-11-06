'use client';

import { useId, useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export type PremiumChoice = { value: string; label: string; disabled?: boolean };

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly PremiumChoice[];
  disabled?: boolean;
  id?: string;
};

/** R287: seleção controlada, sem select nativo, com área tátil e filtro em listas extensas. */
export function PremiumChoicePicker({ label, value, onChange, options, disabled = false, id }: Props) {
  const autoId = useId();
  const panelId = id ? `${id}-choices` : `${autoId}-choices`;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const active = options.find(option => option.value === value);
  const visible = useMemo(() => {
    const query = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    if (!query) return options;
    return options.filter(option => option.label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').includes(query));
  }, [options, search]);
  return (
    <div className="min-w-0 w-full" data-dfl-premium-choice={label}>
      <button id={id} type="button" disabled={disabled} aria-label={label} aria-expanded={open}
        aria-controls={panelId} aria-haspopup="listbox"
        onClick={() => { setOpen(value => !value); setSearch(''); }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-zinc-700/80 bg-zinc-950/70 px-3 text-left text-xs font-bold text-zinc-100 transition-colors active:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50">
        <span className="min-w-0 flex-1 truncate">{active?.label ?? 'Escolher opção'}</span>
        <ChevronDown size={17} className={`shrink-0 text-amber-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && <div id={panelId} role="listbox" aria-label={label}
        className="mt-2 rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-xl">
        {options.length > 7 && <label className="mb-2 flex min-h-11 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3">
          <Search size={15} className="text-zinc-500" aria-hidden="true" />
          <input aria-label={`Buscar em ${label}`} value={search} onChange={event => setSearch(event.target.value)}
            placeholder="Buscar opção..." className="min-w-0 flex-1 bg-transparent text-xs text-zinc-100 outline-none" />
        </label>}
        <div className="max-h-56 space-y-1 overflow-y-auto overscroll-contain">
          {visible.map(option => <button key={option.value} type="button" role="option" aria-selected={option.value === value}
            disabled={option.disabled} onClick={() => { onChange(option.value); setOpen(false); setSearch(''); }}
            className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-40 ${option.value === value ? 'bg-amber-500/10 text-amber-200' : 'text-zinc-300 active:bg-zinc-800'}`}>
            <span className="min-w-0 break-words">{option.label}</span>
            {option.value === value && <Check size={16} className="shrink-0 text-amber-300" aria-hidden="true" />}
          </button>)}
          {!visible.length && <p className="p-3 text-xs text-zinc-500">Nenhuma opção encontrada.</p>}
        </div>
      </div>}
    </div>
  );
}
