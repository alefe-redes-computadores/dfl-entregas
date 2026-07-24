'use client';

import { useState } from 'react';
import { Search, MapPin, User, Hash, Smartphone, Store, Pencil, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import type { Customer, OrderOrigin } from '@/types';

export default function ClientesPage() {
  const customers = useAppStore((state) => state.customers);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  
  const [search, setSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Estados do Modal de Edição
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editOrigin, setEditOrigin] = useState<OrderOrigin>('ifood');
  const [isSaving, setIsSaving] = useState(false);

  const searchLower = search.toLowerCase();
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(searchLower) ||
    (c.neighborhood || '').toLowerCase().includes(searchLower)
  );

  const openEditModal = (client: Customer) => {
    setEditingCustomer(client);
    setEditName(client.name);
    setEditAddress(client.address || '');
    setEditNeighborhood(client.neighborhood || '');
    setEditCode(client.last_confirmation_code || '');
    setEditOrigin(client.origin || 'ifood');
  };

  const closeEditModal = () => {
    setEditingCustomer(null);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setIsSaving(true);
    try {
      await updateCustomer(editingCustomer.id, {
        name: editName,
        address: editAddress,
        neighborhood: editNeighborhood,
        last_confirmation_code: editCode,
        origin: editOrigin
      });
      toast.success('Cliente atualizado!');
      closeEditModal();
    } catch (error) {
      toast.error('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-bold text-zinc-50">Clientes</h1>
        <p className="text-sm text-zinc-500">Gerencie a base de clientes e códigos.</p>
      </div>

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

      <div className="flex flex-col gap-3 pb-10">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-500">
            {search ? 'Nenhum cliente encontrado na busca.' : 'Nenhum cliente cadastrado ainda.'}
          </div>
        ) : (
          filtered.map(client => {
            const isIfood = client.origin === 'ifood' || !client.origin;
            return (
              <div key={client.id} className="flex flex-col rounded-[24px] border border-zinc-800 bg-zinc-900/40 p-4 gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <User size={16} className={isIfood ? 'text-red-500' : 'text-emerald-500'} />
                      <p className="font-semibold text-zinc-100">{client.name}</p>
                    </div>
                    {client.neighborhood && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <MapPin size={14} />
                        <p>{client.neighborhood}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {isIfood ? (
                      <span className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-500 uppercase">
                        <Smartphone size={10} /> iFood
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500 uppercase">
                        <Store size={10} /> Loja
                      </span>
                    )}
                    
                    <button 
                      onClick={() => openEditModal(client)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 active:scale-95 transition-all"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>

                {isIfood && client.last_confirmation_code && (
                  <div className="mt-2 border-t border-zinc-800/80 pt-3 flex justify-between items-center">
                     <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Cód. Confirmação</span>
                     <div className="flex items-center gap-1.5 rounded-xl bg-zinc-800/80 px-3 py-1.5">
                      <Hash size={14} className="text-amber-500" />
                      <span className="font-heading text-xl font-bold text-zinc-50">
                        {client.last_confirmation_code}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-heading font-bold text-zinc-50">Editar Cliente</h2>
              <button onClick={closeEditModal} className="text-zinc-500 hover:text-zinc-300">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="flex flex-col gap-4">
              <div className="flex gap-2 p-1 bg-zinc-900 rounded-2xl border border-zinc-800">
                <button type="button" onClick={() => setEditOrigin('ifood')} className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl font-bold text-sm transition-all ${editOrigin === 'ifood' ? 'bg-red-500 text-white' : 'text-zinc-500'}`}>
                  iFood
                </button>
                <button type="button" onClick={() => setEditOrigin('loja')} className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl font-bold text-sm transition-all ${editOrigin === 'loja' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500'}`}>
                  Loja
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">Nome do Cliente</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" required />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">Endereço Completo</label>
                <input type="text" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Bairro</label>
                  <input type="text" value={editNeighborhood} onChange={(e) => setEditNeighborhood(e.target.value)} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Cód. Confirmação</label>
                  <input type="text" maxLength={4} inputMode="numeric" value={editCode} onChange={(e) => setEditCode(e.target.value.replace(/\D/g, ''))} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" />
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="mt-2 h-12 w-full rounded-xl bg-amber-500 font-bold text-zinc-950 active:scale-95 disabled:opacity-60">
                {isSaving ? 'Salvando...' : 'Salvar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
