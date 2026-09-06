'use client';

import { useState, useMemo } from 'react';
import { 
  Search, MapPin, User, Hash, Smartphone, Store, Pencil, X, Filter, 
  Trophy, DollarSign, PackageOpen, UserRound, Star, Crown, Camera, 
  Phone, MessageSquare, Medal, Award, TrendingUp, Check
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete';
import type { Customer, OrderOrigin } from '@/types';

// ============================================================================
// CONFIGURAÇÃO DOS AVATARES
// ============================================================================
const CUSTOMER_AVATARS = [
  { id: 'user-emerald', type: 'user', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { id: 'user-amber', type: 'user', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'user-blue', type: 'user', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'woman-pink', type: 'user-round', color: 'text-pink-500', bg: 'bg-pink-500/10' },
  { id: 'woman-purple', type: 'user-round', color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { id: 'star-amber', type: 'star', color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { id: 'crown-amber', type: 'crown', color: 'text-crown-500', bg: 'bg-amber-500/10' },
  { id: 'store-indigo', type: 'store', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
];

const RenderCustomerAvatar = ({ id, size = 20, className = '' }: { id?: string; size?: number; className?: string }) => {
  const config = CUSTOMER_AVATARS.find(a => a.id === id) || { type: 'user', color: 'text-zinc-400', bg: 'bg-zinc-800' };
  let Icon = User;
  if (config.type === 'user-round') Icon = UserRound;
  if (config.type === 'star') Icon = Star;
  if (config.type === 'crown') Icon = Crown;
  if (config.type === 'store') Icon = Store;

  return <Icon size={size} className={`${config.color} ${className}`} />;
};

const formatPhoneInput = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export default function ClientesPage() {
  const customers = useAppStore((state) => state.customers);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  const deliveries = useAppStore((state) => state.deliveries || []);
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  
  const [search, setSearch] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | 'ifood' | 'loja' | 'ranking'>('all');
  
  // Estado para Edição do Cadastro
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Estados para Detalhes dos Pedidos do Cliente
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState('');

  // Estados do Modal de Edição de Cadastro
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNeighborhood, setEditNeighborhood] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editOrigin, setEditOrigin] = useState<OrderOrigin>('ifood');
  const [editAvatar, setEditAvatar] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  // Busca e Filtros Inteligentes
  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    const searchDigits = search.replace(/\D/g, '');

    let result = customers.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(searchLower);
      const neighborhoodMatch = (c.neighborhood || '').toLowerCase().includes(searchLower);
      const addressMatch = (c.address || '').toLowerCase().includes(searchLower);
      const phoneMatch = searchDigits && c.phone ? c.phone.includes(searchDigits) : false;
      const isIfood = c.origin === 'ifood' || !c.origin;

      const matchesSearch = !searchLower || nameMatch || neighborhoodMatch || addressMatch || phoneMatch;

      if (originFilter === 'ifood') return matchesSearch && isIfood;
      if (originFilter === 'loja') return matchesSearch && !isIfood;
      if (originFilter === 'ranking') {
        const isSelf = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('alefe');
        return matchesSearch && (c.orderCount || 0) > 0 && !isSelf;
      }
      
      return matchesSearch;
    });

    if (originFilter === 'ranking') {
      result = result.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 5);
    } else {
      result = result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [customers, search, originFilter]);

  // Pedidos vinculados ao cliente aberto no Modal de Detalhes
  const customerDeliveries = useMemo(() => {
    if (!viewingCustomer) return [];
    return deliveries.filter((d: any) => 
      (d.customer_id && d.customer_id === viewingCustomer.id) ||
      (d.customerId && d.customerId === viewingCustomer.id) ||
      (d.customer_name && d.customer_name.toLowerCase().trim() === viewingCustomer.name.toLowerCase().trim()) ||
      (d.customerName && d.customerName.toLowerCase().trim() === viewingCustomer.name.toLowerCase().trim())
    );
  }, [deliveries, viewingCustomer]);

  const openEditModal = (client: Customer) => {
    setEditingCustomer(client);
    setEditName(client.name);
    setEditPhone(client.phone ? formatPhoneInput(client.phone) : '');
    setEditAddress(client.address || '');
    setEditNeighborhood(client.neighborhood || '');
    setEditCode(client.last_confirmation_code || '');
    setEditOrigin(client.origin || 'ifood');
    setEditAvatar(client.avatar || '');
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setIsSaving(true);
    try {
      await updateCustomer(editingCustomer.id, {
        name: editName,
        phone: editPhone.replace(/\D/g, ''),
        address: editAddress,
        neighborhood: editNeighborhood,
        last_confirmation_code: editCode,
        origin: editOrigin,
        avatar: editAvatar
      });
      toast.success('Cliente atualizado!');
      setEditingCustomer(null);
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDeliveryPrice = async (deliveryId: string) => {
    const numeric = parseFloat(tempPrice.replace(',', '.'));
    if (isNaN(numeric) || numeric < 0) {
      toast.error('Informe um valor válido');
      return;
    }
    try {
      if (updateDelivery) {
        await updateDelivery(deliveryId, { value: numeric } as any);
        toast.success('Valor do pedido atualizado!');
      }
      setEditingDeliveryId(null);
    } catch {
      toast.error('Erro ao atualizar o pedido');
    }
  };

  return (
    <div className="flex flex-col gap-6 relative pb-24 animate-in fade-in duration-300">
      <PageHeader title="CRM Clientes" subtitle="Gestão de base, histórico e VIPs" />

      {/* BARRA DE PESQUISA */}
      <div className="relative px-2">
        <div className="pointer-events-none absolute inset-y-0 left-6 flex items-center text-zinc-500">
          <Search size={18} />
        </div>
        <input 
          type="text" 
          placeholder="Buscar cliente, (34) 9..., bairro..." 
          value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          className="h-14 w-full rounded-[20px] border border-zinc-800 bg-zinc-900/60 pl-12 pr-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:bg-zinc-900 transition-all outline-none shadow-inner" 
        />
        {search && (
          <button 
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-6 flex items-center text-zinc-500 hover:text-zinc-300 active:scale-90 transition-transform"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* FILTROS SEGMENTADOS */}
      <div className="flex items-center gap-2 overflow-x-auto px-2 pb-2 hide-scrollbar">
        <button 
          onClick={() => setOriginFilter('all')} 
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 ${originFilter === 'all' ? 'bg-zinc-100 text-zinc-950 shadow-md' : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
        >
          <Filter size={14} /> Todos
        </button>
        <button 
          onClick={() => setOriginFilter('ranking')} 
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 ${originFilter === 'ranking' ? 'bg-amber-500 text-zinc-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
        >
          <Trophy size={14} /> Top 5 VIPs
        </button>
        <button 
          onClick={() => setOriginFilter('ifood')} 
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 ${originFilter === 'ifood' ? 'bg-red-500 text-white shadow-md' : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
        >
          <Smartphone size={14} /> iFood
        </button>
        <button 
          onClick={() => setOriginFilter('loja')} 
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 ${originFilter === 'loja' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'}`}
        >
          <Store size={14} /> Loja Própria
        </button>
      </div>

      {/* CABEÇALHO DA LISTAGEM */}
      <div className="px-3 flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
          {originFilter === 'ranking' ? 'Maiores Clientes da Loja' : 'Lista de Clientes'}
        </span>
        <span className="text-[10px] font-bold bg-zinc-800/50 text-zinc-400 px-2.5 py-1 rounded-full border border-zinc-800">
          {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
        </span>
      </div>

      {/* LISTA DE CLIENTES */}
      <div className="flex flex-col gap-4 px-2 pb-10">
        {filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center px-6 border border-dashed border-zinc-800/80 rounded-[32px] bg-zinc-900/20">
            {originFilter === 'ranking' ? (
              <>
                <div className="h-16 w-16 bg-amber-500/10 text-amber-500 flex items-center justify-center rounded-full mb-2">
                  <Award size={32} />
                </div>
                <p className="text-zinc-200 font-bold text-lg">O Pódio está vazio</p>
                <p className="text-xs text-zinc-500 max-w-[200px]">Nenhum cliente contabilizou pedidos ou valores suficientes.</p>
              </>
            ) : (
              <p className="text-sm text-zinc-500 font-medium">Nenhum cliente atende a essa busca.</p>
            )}
          </div>
        ) : (
          filtered.map((client, index) => {
            const isIfood = client.origin === 'ifood' || !client.origin;
            const orders = client.orderCount || 0;
            const spent = client.totalSpent || 0;
            const ticketMedio = orders > 0 ? (spent / orders) : 0;
            
            const isRanking = originFilter === 'ranking';
            const isTop1 = isRanking && index === 0;
            const isTop2 = isRanking && index === 1;
            const isTop3 = isRanking && index === 2;

            const avatarConfig = CUSTOMER_AVATARS.find(a => a.id === client.avatar);
            const rawPhone = client.phone;

            return (
              <div 
                key={client.id} 
                className={`relative flex flex-col rounded-[28px] border transition-all duration-300 overflow-hidden ${
                  isTop1 ? 'bg-gradient-to-b from-[#332b00] to-zinc-950 border-yellow-600/50 shadow-[0_0_20px_rgba(202,138,4,0.1)]' : 
                  isTop2 ? 'bg-gradient-to-b from-zinc-800 to-zinc-950 border-zinc-500/50' : 
                  isTop3 ? 'bg-gradient-to-b from-[#331c0b] to-zinc-950 border-amber-800/50' : 
                  'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900/60'
                }`}
              >
                {isRanking && (
                  <div className={`absolute top-0 right-0 rounded-bl-[20px] px-3.5 py-1.5 flex items-center gap-1.5 shadow-md ${
                    isTop1 ? 'bg-yellow-500 text-yellow-950' : 
                    isTop2 ? 'bg-zinc-300 text-zinc-900' : 
                    isTop3 ? 'bg-amber-700 text-amber-100' : 
                    'bg-zinc-800 text-zinc-300'
                  }`}>
                    {isTop1 ? <Crown size={12} strokeWidth={3} /> : <Medal size={12} strokeWidth={3} />}
                    <span className="text-[10px] font-black uppercase tracking-widest">{index + 1}º Lugar</span>
                  </div>
                )}

                {/* ÁREA CLICÁVEL: ABRE OS DETALHES E PEDIDOS DO CLIENTE */}
                <div 
                  onClick={() => setViewingCustomer(client)}
                  className="p-5 pt-6 flex items-start justify-between cursor-pointer active:opacity-90 transition-opacity"
                >
                  <div className="flex items-start gap-4 flex-1 truncate pr-2">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 border mt-0.5 ${
                      client.avatar && avatarConfig
                        ? `${avatarConfig.bg} border-${avatarConfig.color.split('-')[1]}-500/30`
                        : isIfood ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    }`}>
                      {client.avatar ? <RenderCustomerAvatar id={client.avatar} size={22} /> : <User size={22} />}
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 truncate">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-base font-bold truncate ${isTop1 ? 'text-yellow-500' : 'text-zinc-100'}`}>
                          {client.name}
                        </h3>
                        {isIfood ? (
                          <span className="flex items-center gap-1 bg-red-500/10 text-red-500 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0"><Smartphone size={10} /> iFood</span>
                        ) : (
                          <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0"><Store size={10} /> Loja</span>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-1 mt-0.5">
                        {rawPhone && (
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://wa.me/55${rawPhone}`, '_blank');
                            }}
                            className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 w-fit transition-all cursor-pointer"
                          >
                            <MessageSquare size={12} /> {formatPhoneInput(rawPhone)}
                          </span>
                        )}

                        {client.address && (
                          <span className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate w-full">
                            <MapPin size={12} className="shrink-0 text-zinc-500" />
                            <span className="truncate">{client.address}{client.neighborhood ? ` - ${client.neighborhood}` : ''}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BOTÃO DO LÁPIS: APENAS EDITA DADOS BÁSICOS */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(client);
                    }} 
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800/80 border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 active:scale-90 transition-all shrink-0 mt-0.5"
                    title="Editar Cadastro"
                  >
                    <Pencil size={14} />
                  </button>
                </div>

                {/* RODAPÉ DO CARD */}
                <div 
                  onClick={() => setViewingCustomer(client)}
                  className="border-t border-zinc-800/60 bg-zinc-950/40 p-4 flex flex-col gap-3 cursor-pointer"
                >
                  {isIfood && client.last_confirmation_code && (
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-800/50">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Cód. iFood Salvo</span>
                      <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg">
                        <Hash size={12} className="text-amber-500" />
                        <span className="font-mono font-bold text-zinc-300 tracking-widest">{client.last_confirmation_code}</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 divide-x divide-zinc-800/80">
                    <div className="flex flex-col items-center justify-center px-1">
                      <span className="text-[9px] font-black uppercase text-zinc-500 mb-1 flex items-center gap-1"><PackageOpen size={10} className="text-indigo-400"/> Pedidos</span>
                      <span className="text-sm font-bold text-zinc-200">{orders}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center px-1">
                      <span className="text-[9px] font-black uppercase text-zinc-500 mb-1 flex items-center gap-1"><DollarSign size={10} className="text-emerald-400"/> Gasto Total</span>
                      <span className="text-sm font-bold text-emerald-400">R$ {spent.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center px-1">
                      <span className="text-[9px] font-black uppercase text-zinc-500 mb-1 flex items-center gap-1"><TrendingUp size={10} className="text-amber-500"/> Ticket Médio</span>
                      <span className="text-sm font-bold text-amber-500">R$ {ticketMedio.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE HISTÓRICO DE PEDIDOS E EDIÇÃO DE VALOR */}
      {/* ========================================================================= */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-[#121214] border-t sm:border border-zinc-800 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-8">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-800 sm:hidden shrink-0" />
            
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-zinc-100">{viewingCustomer.name}</h3>
                <span className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                  <PackageOpen size={13} className="text-indigo-400" /> {customerDeliveries.length} pedido(s) encontrado(s)
                </span>
              </div>
              <button 
                onClick={() => { setViewingCustomer(null); setEditingDeliveryId(null); }}
                className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3">
              {customerDeliveries.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-sm">
                  Nenhum pedido registrado para este cliente.
                </div>
              ) : (
                customerDeliveries.map((del: any) => {
                  const valorAtual = Number(del.value || del.orderAmount || del.total || 0);
                  const isEditingThis = editingDeliveryId === del.id;

                  return (
                    <div key={del.id} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-300">
                          {del.order_id ? `#${del.order_id}` : (del.code ? `#${del.code}` : 'Entrega')}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 uppercase tracking-wider">
                          {del.payment_method || del.paymentMethod || 'Pendente'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/50">
                        <span className="text-xs text-zinc-500 flex items-center gap-1 truncate pr-2">
                          <MapPin size={12} className="shrink-0 text-zinc-600" /> 
                          <span className="truncate">{del.address_string || del.neighborhood || 'Endereço'}</span>
                        </span>

                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="text" 
                              inputMode="decimal"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(e.target.value)}
                              className="w-24 h-8 rounded-lg bg-zinc-950 border border-emerald-500 px-2 text-xs font-bold text-emerald-400 outline-none"
                              placeholder="0.00"
                              autoFocus
                            />
                            <button 
                              onClick={() => handleSaveDeliveryPrice(del.id)}
                              className="h-8 w-8 rounded-lg bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold active:scale-95 transition-transform"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => setEditingDeliveryId(null)}
                              className="h-8 w-8 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center active:scale-95 transition-transform"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-emerald-400">
                              R$ {valorAtual.toFixed(2).replace('.', ',')}
                            </span>
                            <button 
                              onClick={() => {
                                setEditingDeliveryId(del.id);
                                setTempPrice(String(valorAtual));
                              }}
                              className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                              title="Corrigir Valor"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE EDIÇÃO DE CADASTRO DO CLIENTE */}
      {/* ========================================================================= */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#121214] border-t sm:border border-zinc-800 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl overflow-y-auto max-h-[90vh] animate-in slide-in-from-bottom-8">
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-zinc-800 sm:hidden" />
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-heading font-bold text-zinc-50">Editar Cliente</h2>
              <button onClick={() => setEditingCustomer(null)} className="p-2 bg-zinc-900 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveCustomer} className="flex flex-col gap-4">
              <div className="flex items-center gap-4 bg-zinc-900/40 p-4 rounded-[20px] border border-zinc-800/80">
                <button type="button" onClick={() => setIsAvatarModalOpen(true)} className="relative h-14 w-14 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center group overflow-hidden shrink-0 transition-transform active:scale-95">
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 z-10 transition-opacity"><Camera size={16} className="text-white" /></div>
                  <RenderCustomerAvatar id={editAvatar} size={24} />
                </button>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-zinc-100">Ícone do Cliente</span>
                  <span className="text-xs text-zinc-500 mt-0.5">Toque no avatar para alterar.</span>
                </div>
              </div>

              <div className="flex gap-2 p-1 bg-zinc-900/60 rounded-2xl border border-zinc-800/80">
                <button type="button" onClick={() => setEditOrigin('ifood')} className={`flex-1 flex items-center justify-center gap-1.5 h-12 rounded-[14px] font-bold text-sm transition-all ${editOrigin === 'ifood' ? 'bg-red-500 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}><Smartphone size={16}/> iFood</button>
                <button type="button" onClick={() => setEditOrigin('loja')} className={`flex-1 flex items-center justify-center gap-1.5 h-12 rounded-[14px] font-bold text-sm transition-all ${editOrigin === 'loja' ? 'bg-emerald-500 text-zinc-950 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}><Store size={16}/> Loja</button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 px-1">Nome Completo</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="h-14 rounded-[18px] border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:bg-zinc-900 transition-all outline-none" required />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 px-1">WhatsApp / Telefone</label>
                <input 
                  type="text" 
                  inputMode="tel" 
                  placeholder="(34) 99999-9999" 
                  value={editPhone} 
                  onChange={(e) => setEditPhone(formatPhoneInput(e.target.value))} 
                  className="h-14 rounded-[18px] border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:bg-zinc-900 transition-all outline-none" 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <AddressAutocomplete value={editAddress} onChange={setEditAddress} placeholder="Ex: Rua Major Gote, 100" label="Endereço (Rua e Nº)" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400 px-1">Bairro</label>
                  <input type="text" value={editNeighborhood} onChange={(e) => setEditNeighborhood(e.target.value)} className="h-14 rounded-[18px] border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 outline-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400 px-1">Cód. Confirmação</label>
                  <input type="text" maxLength={4} inputMode="numeric" placeholder="Ex: 1234" value={editCode} onChange={(e) => setEditCode(e.target.value.replace(/\D/g, ''))} className="h-14 rounded-[18px] border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 outline-none" />
                </div>
              </div>

              <button type="submit" disabled={isSaving} className="mt-4 h-14 w-full rounded-[20px] bg-amber-500 font-bold text-zinc-950 active:scale-[0.98] transition-transform disabled:opacity-60 text-base shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE ESCOLHA DE AVATAR */}
      {/* ========================================================================= */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[32px] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-50">Escolha o Ícone</h3>
              <button onClick={() => setIsAvatarModalOpen(false)} className="text-zinc-500 bg-zinc-900 p-2 rounded-full hover:text-zinc-300"><X size={18}/></button>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
              {CUSTOMER_AVATARS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setEditAvatar(opt.id); setIsAvatarModalOpen(false); }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-90 ${
                    editAvatar === opt.id ? `bg-zinc-800 border-zinc-500 shadow-md` : `bg-zinc-900 border-zinc-800/80 hover:bg-zinc-800`
                  }`}
                >
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center ${opt.bg}`}>
                    <RenderCustomerAvatar id={opt.id} size={22} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
