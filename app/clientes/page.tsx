'use client';

import { useState } from 'react';
import { Search, MapPin, User, Hash } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function ClientesPage() {
  const customers = useAppStore((state) => state.customers);
  const [search, setSearch] = useState('');

  const searchLower = search.toLowerCase();

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchLower) ||
    (c.neighborhood || '').toLowerCase().includes(searchLower)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-zinc-50">Clientes</h1>
        <p className="text-sm text-zinc-500">Consulte os códigos de confirmação salvos.</p>
      </div>

      {/* Barra de Busca */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
          <Search size={18} />
        </div>
        <input
          type="text"
          placeholder="Buscar por nome ou bairro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-12 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Lista de Clientes */}
      <div className="flex flex-col gap-3 pb-10">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            {search ? 'Nenhum cliente encontrado na busca.' : 'Nenhum cliente cadastrado ainda.'}
          </div>
        ) : (
          filtered.map(client => (
            <div key={client.id} className="flex items-center justify-between rounded-[24px] border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-emerald-500" />
                  <p className="font-semibold text-zinc-100">{client.name}</p>
                </div>
                {client.neighborhood && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <MapPin size={14} />
                    <p>{client.neighborhood}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  Cód. Confirmação
                </span>
                <div className="flex items-center gap-1.5 rounded-xl bg-zinc-800/80 px-3 py-1.5">
                  <Hash size={14} className="text-amber-500" />
                  <span className="font-heading text-xl font-bold text-zinc-50">
                    {client.last_confirmation_code || '—'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
