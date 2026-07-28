// app/clientes/page.tsx
'use client';

import { useState } from 'react';
import { Search, MapPin, User, Hash, Smartphone, Store, Pencil, X, Filter, Trophy, DollarSign, PackageOpen } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete';
import type { Customer, OrderOrigin } from '@/types';

export default function ClientesPage() {
  const customers = useAppStore((state) => state.customers);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | 'ifood' | 'loja' | 'ranking'>('all');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Estados do Modal de Edição
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editOrigin, setEditOrigin] = useState<OrderOrigin>('ifood');
  const [isSaving, setIsSaving] = useState(false);

  const searchLower = search.toLowerCase().trim();

  // Filtragem e Ordenação Inteligente
  const filtered = customers.filter(c => {
    const nameMatch = c.name.toLowerCase().includes(searchLower);
    const neighborhoodMatch = (c.neighborhood || '').toLowerCase().includes(searchLower);
    const addressMatch = (c.address || '').toLowerCase().includes(searchLower);
    const isIfood = c.origin === 'ifood' || !c.origin;
    const originTextMatch = searchLower === 'ifood' && isIfood || searchLower === 'loja' && !isIfood;

    const matchesSearch = !searchLower || nameMatch || neighborhoodMatch || addressMatch || originTextMatch;

    // Filtros por botões
    if (originFilter === 'ifood') return matchesSearch && isIfood;
    if (originFilter === 'loja') return matchesSearch && !isIfood;
    
    // 🔥 CORREÇÃO: No Ranking, SÓ ENTRA quem tiver pelo menos 1 pedido!
    if (originFilter === 'ranking') return matchesSearch && (c.orderCount || 0) > 0;
    
    return matchesSearch;
  }).sort((a, b) => {
    // 🔥 ORDENAÇÃO: O Ranking ordena do maior para o menor número de pedidos
    if (originFilter === 'ranking') {
       const countA = a.orderCount || 0;
       const countB = b.orderCount || 0;
       return countB - countA;
    }
    // Caso padrão: A-Z
    return a.name.localeCompare(b.name);
  });

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
    <div className="flex flex-col gap-5 relative pb-24">
      {/* CABEÇALHO */}
      <PageHeader 
        title="Clientes" 
        subtitle="Gerencie a base de clientes, ruas, bairros e códigos" 
      />

      {/* Barra de Busca Inteligente */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
          <Search size={18} />
        </div>
        <input
          type="text"
          placeholder="Buscar por nome, bairro ou rua..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 pl-12 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Filtros Rápidos (Todos / Ranking / iFood / Loja) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setOriginFilter('all')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            originFilter === 'all' 
              ? 'bg-zinc-200 text-zinc-950' 
              : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Filter size={14} /> Todos ({customers.length})
        </button>
        
        <button
          onClick={() => setOriginFilter('ranking')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            originFilter === 'ranking' 
              ? 'bg-amber-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]' 
              : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-amber-500'
          }`}
        >
          <Trophy size={14} /> Ranking 🏆
        </button>

        <button
          onClick={() => setOriginFilter('ifood')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            originFilter === 'ifood' 
              ? 'bg-red-500 text-white' 
              : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Smartphone size={14} /> iFood
        </button>
        <button
          onClick={() => setOriginFilter('loja')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            originFilter === 'loja' 
              ? 'bg-emerald-500 text-zinc-950' 
              : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Store size={14} /> Loja
        </button>
      </div>

      {/* Lista de Clientes ou Tela Vazia */}
      <div className="flex flex-col gap-3 pb-10">
        {filtered.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center gap-3 text-center px-6 border border-dashed border-zinc-800/80 rounded-[28px] bg-zinc-950/30">
            {originFilter === 'ranking' ? (
              <>
                <div className="h-16 w-16 bg-amber-500/10 text-amber-500 flex items-center justify-center rounded-full mb-2 border border-amber-500/20">
                  <Trophy size={28} />
                </div>
                <p className="text-zinc-300 font-bold text-lg">O Pódio está vazio!</p>
                <p className="text-xs text-zinc-500 leading-relaxed">Nenhum cliente contabilizou pedidos ainda.<br/>Lance novas entregas para ver o ranking ganhar vida.</p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                {search || originFilter !== 'all' ? 'Nenhum cliente encontrado com esses filtros.' : 'Nenhum cliente cadastrado ainda.'}
              </p>
            )}
          </div>
        ) : (
          filtered.map((client, index) => {
            const isIfood = client.origin === 'ifood' || !client.origin;
            const orders = client.orderCount || 0;
            const spent = client.totalSpent || 0;
            
            // O pódio: os 3 primeiros ganham estilos especiais se a aba Ranking estiver ativa
            const isPodium = originFilter === 'ranking' && index < 3 && orders > 0;

            return (
              <div 
                key={client.id} 
                className={`relative flex flex-col rounded-[24px] border bg-zinc-900/40 p-4 gap-3 transition-all ${
                  isPodium 
                    ? index === 0 ? 'border-amber-400/50 bg-amber-500/[0.05]' 
                    : index === 1 ? 'border-zinc-300/50 bg-zinc-300/[0.05]'
                    : 'border-amber-700/50 bg-amber-700/[0.05]'
                    : 'border-zinc-800'
                }`}
              >
                
                {/* Ícone de Pódio (1º, 2º, 3º) */}
                {isPodium && (
                  <div className={`absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full text-xs font-black shadow-lg ${
                    index === 0 ? 'bg-amber-400 text-amber-950' : 
                    index === 1 ? 'bg-zinc-300 text-zinc-900' : 
                    'bg-amber-700 text-amber-100'
                  }`}>
                    {index + 1}º
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1.5 pr-8">
                    <div className="flex items-center gap-2">
                      <User size={16} className={isIfood ? 'text-red-500' : 'text-emerald-500'} />
                      <p className="font-semibold text-zinc-100">{client.name}</p>
                    </div>
                    {client.address && (
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <MapPin size={14} className="text-zinc-500 shrink-0" />
                        <p className="line-clamp-1">{client.address}{client.neighborhood ? ` - ${client.neighborhood}` : ''}</p>
                      </div>
                    )}
                    {!client.address && client.neighborhood && (
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <MapPin size={14} />
                        <p>{client.neighborhood}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
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
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>

                {/* 🔥 DADOS DE RANKING & FIDELIDADE */}
                {originFilter === 'ranking' && orders > 0 && (
                  <div className="mt-1 border-t border-zinc-800/80 pt-3 flex justify-between items-center bg-zinc-950/30 -mx-4 -mb-4 p-4 rounded-b-[24px]">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                      <PackageOpen size={14} className="text-indigo-400" />
                      <span>{orders} {orders === 1 ? 'Pedido' : 'Pedidos'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <DollarSign size={14} />
                      <span>R$ {spent.toFixed(2).replace('.', ',')} Gasto</span>
                    </div>
                  </div>
                )}

                {/* DESTAQUE DO CÓDIGO DE CONFIRMAÇÃO APENAS PARA IFOOD */}
                {originFilter !== 'ranking' && isIfood && (
                  <div className="mt-1 border-t border-zinc-800/80 pt-3 flex justify-between items-center bg-red-500/[0.03] -mx-4 -mb-4 p-4 rounded-b-[24px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-400/80">Cód. Confirmação iFood</span>
                    <div className="flex items-center gap-1.5 rounded-xl bg-zinc-800/90 border border-red-500/30 px-3.5 py-1.5 shadow-inner">
                      <Hash size={14} className="text-amber-500" />
                      <span className="font-heading text-xl font-bold text-zinc-50 tracking-wider">
                        {client.last_confirmation_code || '----'}
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
                <button 
                  type="button" 
                  onClick={() => setEditOrigin('ifood')} 
                  className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl font-bold text-sm transition-all cursor-pointer ${editOrigin === 'ifood' ? 'bg-red-500 text-white' : 'text-zinc-500'}`}
                >
                  iFood
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditOrigin('loja')} 
                  className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl font-bold text-sm transition-all cursor-pointer ${editOrigin === 'loja' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500'}`}
                >
                  Loja
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">Nome do Cliente</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" 
                  required 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <AddressAutocomplete 
                  value={editAddress} 
                  onChange={setEditAddress} 
                  placeholder="Ex: Rua Major Gote, 100"
                  label="Endereço Completo / Rua"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Bairro</label>
                  <input 
                    type="text" 
                    value={editNeighborhood} 
                    onChange={(e) => setEditNeighborhood(e.target.value)} 
                    className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Cód. Confirmação</label>
                  <input 
                    type="text" 
                    maxLength={4} 
                    inputMode="numeric" 
                    value={editCode} 
                    onChange={(e) => setEditCode(e.target.value.replace(/\D/g, ''))} 
                    className="h-12 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSaving} 
                className="mt-2 h-12 w-full rounded-xl bg-amber-500 font-bold text-zinc-950 active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? 'Salvando...' : 'Salvar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
