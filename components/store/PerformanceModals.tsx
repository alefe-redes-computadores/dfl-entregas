'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, X, ChevronLeft, Calendar, ChevronRight, MapPin, 
  Wallet, QrCode, Banknote, CreditCard, Receipt, Eye, EyeOff, FileText, Clock,
  ArrowRight, Filter, User, Users, Copy, CheckCircle2, Bike, Timer
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { RouteAccordion } from '@/components/home/RouteAccordion'; 
import { toast } from 'sonner';

interface PerformanceModalsProps {
  isLogisticsOpen: boolean;
  closeLogistics: () => void;
  isRevenueOpen: boolean;
  closeRevenue: () => void;
  isPrivacyMode: boolean;
  togglePrivacyMode: () => void;
  dashboardData: any;
}

export function PerformanceModals({
  isLogisticsOpen, closeLogistics, isRevenueOpen, closeRevenue, isPrivacyMode, togglePrivacyMode, dashboardData
}: PerformanceModalsProps) {
  const router = useRouter();
  const [expandedDeliveryId, setExpandedDeliveryId] = useState<string | null>(null);
  const [selectedMotoboy, setSelectedMotoboy] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pix' | 'dinheiro' | 'cartao'>('all');

  const { 
    goToPreviousDay, goToNextDay, formattedDateLabel, 
    faturamentoTotal, ticketMedio, 
    revenueByMethod, selectedDateDeliveries, selectedDateRoutes
  } = dashboardData;

  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const safeHaptic = async () => {
    try { if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light }); } catch (e) {}
  };

  const navigateDay = async (direction: 'prev' | 'next') => {
    await safeHaptic();
    direction === 'prev' ? goToPreviousDay() : goToNextDay();
    setSelectedMotoboy('all'); 
  };

  const toggleDelivery = async (id: string) => {
    await safeHaptic();
    setExpandedDeliveryId(prev => prev === id ? null : id);
  };

  const uniqueMotoboys = useMemo(() => {
    if (!selectedDateRoutes) return [];
    const names = new Set(selectedDateRoutes.map((r: any) => r.motoboy_name));
    return Array.from(names).sort() as string[];
  }, [selectedDateRoutes]);

  const filteredRoutes = useMemo(() => {
    if (!selectedDateRoutes) return [];
    if (selectedMotoboy === 'all') return selectedDateRoutes;
    return selectedDateRoutes.filter((r: any) => r.motoboy_name === selectedMotoboy);
  }, [selectedDateRoutes, selectedMotoboy]);

  const groupedRoutes = useMemo(() => {
    return filteredRoutes.reduce((acc: Record<string, any[]>, route: any) => {
      if (!acc[route.motoboy_name]) acc[route.motoboy_name] = [];
      acc[route.motoboy_name].push(route);
      return acc;
    }, {});
  }, [filteredRoutes]);

  const dynamicStats = useMemo(() => {
    const relevantRouteIds = filteredRoutes.map((r: any) => r.id);
    const deliveries = (selectedDateDeliveries || []).filter((d: any) => relevantRouteIds.includes(d.route_id));
    return {
      entregas: deliveries.length,
      totalRotas: filteredRoutes.length,
      rotasFinalizadas: filteredRoutes.filter((r: any) => r.status === 'fechada').length
    };
  }, [filteredRoutes, selectedDateDeliveries]);

  const chronologicDeliveries = useMemo(() => {
    let list = [...(selectedDateDeliveries || [])];
    
    if (paymentFilter !== 'all') {
      list = list.filter((d: any) => {
        const m = (d.payment_method || '').toLowerCase();
        if (paymentFilter === 'cartao') return m.includes('cartao');
        return m === paymentFilter;
      });
    }

    return list.sort((a, b) => {
      const timeA = new Date(a.updated_at || a.createdAt || 0).getTime();
      const timeB = new Date(b.updated_at || b.createdAt || 0).getTime();
      return timeB - timeA; 
    });
  }, [selectedDateDeliveries, paymentFilter]);

  const handleCopyLogistics = async () => {
    if (selectedMotoboy === 'all') {
      toast.error('Selecione um motoboy específico para copiar o relatório.');
      return;
    }

    const rotas = groupedRoutes[selectedMotoboy];
    if (!rotas || rotas.length === 0) return;

    let text = `📦 *RESUMO LOGÍSTICO - ${selectedMotoboy.toUpperCase()}*\n📅 Data: ${formattedDateLabel}\n\n`;
    
    rotas.forEach((r: any, idx: number) => {
      const routeDeliveries = (selectedDateDeliveries || []).filter((d: any) => d.route_id === r.id);
      let durationStr = 'Em andamento';
      
      if (r.started_at && (r.end_time || r.completed_at)) {
        const diffMins = Math.floor((new Date(r.end_time || r.completed_at).getTime() - new Date(r.started_at).getTime()) / 60000);
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        durationStr = hrs > 0 ? `${hrs}h${mins}m` : `${mins}min`;
      }
      text += `🏍️ *Rota ${idx + 1}*: ${routeDeliveries.length} entregas (${durationStr})\n`;
    });

    text += `\n📊 *TOTAL*: ${rotas.length} rotas | ${dynamicStats.entregas} entregas`;
    
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Relatório copiado para enviar no WhatsApp!');
    } catch {
      toast.error('Erro ao copiar.');
    }
  };

  return (
    <>
      {/* ========================================================= */}
      {/* MODAL 1: RESUMO LOGÍSTICO (FOCO NO MOTOBOY E ROTAS) */}
      {/* ========================================================= */}
      {isLogisticsOpen && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto block animate-in slide-in-from-bottom duration-300">
          <div className="sticky top-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/80 shadow-md">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2">
                  <Package size={20} className="text-sky-500" /> Resumo Logístico
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Operação de rotas e entregadores</p>
              </div>
              <button onClick={closeLogistics} className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-full hover:text-zinc-200 active:scale-90 transition-all">
                <X size={20}/>
              </button>
            </div>
            
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/30 border-b border-zinc-800/50">
              <button onClick={() => navigateDay('prev')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300 active:scale-95 shadow-sm"><ChevronLeft size={20} /></button>
              <div className="flex items-center gap-2 bg-sky-500/10 px-4 py-2 rounded-full border border-sky-500/20"><Calendar size={14} className="text-sky-400" /><span className="font-bold text-sm text-sky-400">{formattedDateLabel}</span></div>
              <button onClick={() => navigateDay('next')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300 active:scale-95 shadow-sm"><ChevronRight size={20} /></button>
            </div>

            {uniqueMotoboys.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar px-5 py-4 bg-zinc-950/80">
                <button onClick={() => { safeHaptic(); setSelectedMotoboy('all'); }} className={`flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-bold transition-all shadow-sm ${selectedMotoboy === 'all' ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}>
                  <Filter size={14} /> Equipe Toda
                </button>
                {uniqueMotoboys.map(m => (
                  <button key={m} onClick={() => { safeHaptic(); setSelectedMotoboy(m); }} className={`flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-bold transition-all shadow-sm ${selectedMotoboy === m ? "bg-zinc-100 text-zinc-950" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}>
                    <User size={14} /> {m}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 pb-40 flex flex-col gap-6">
            {uniqueMotoboys.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Package size={48} className="text-zinc-800" />
                <p className="text-center text-zinc-500 text-sm font-semibold">Nenhuma rota encontrada nesta data.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-[24px] p-5 flex flex-col gap-1.5 shadow-sm">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Package size={12} className="text-sky-500"/> Total Entregas</span>
                    <span className="text-3xl font-black text-zinc-100 tracking-tight">{dynamicStats.entregas}</span>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-[24px] p-5 flex flex-col gap-1.5 shadow-sm">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Bike size={12} className="text-emerald-500"/> Rotas Concluídas</span>
                    <span className="text-3xl font-black text-emerald-400 tracking-tight">{dynamicStats.rotasFinalizadas} <span className="text-sm font-normal text-zinc-500">/ {dynamicStats.totalRotas}</span></span>
                  </div>
                </div>

                {selectedMotoboy !== 'all' && (
                  <button 
                    onClick={handleCopyLogistics}
                    className="w-full h-14 bg-sky-500 hover:bg-sky-400 text-zinc-950 font-black rounded-xl text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Copy size={16} /> Copiar Relatório Logístico
                  </button>
                )}

                <div className="w-full h-px bg-zinc-800/50 my-1" />

                <div className="flex flex-col gap-8">
                  {Object.entries(groupedRoutes).map(([motoboyName, rotasObj]) => {
                    const rotasDoMotoboy = rotasObj as any[];
                    return (
                      <div key={motoboyName} className="flex flex-col gap-4 animate-in fade-in">
                        <div className="flex items-center justify-between px-2">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400"><Users size={14}/></div>
                            <span className="font-bold text-zinc-200 text-sm">{motoboyName}</span>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{rotasDoMotoboy.length} rotas no dia</span>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                          {rotasDoMotoboy.map((rota: any) => (
                             <RouteAccordion key={rota.id} route={rota} defaultOpen={false} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EXTRATO FINANCEIRO (ORGANIZADO E FILTRÁVEL) */}
      {/* ========================================================= */}
      {isRevenueOpen && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto block animate-in slide-in-from-bottom duration-300">
          <div className="sticky top-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/80 shadow-md">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2"><Wallet size={20} className="text-emerald-500" /> Extrato do Dia</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Faturamento e lançamentos de caixa</p>
              </div>
              <button onClick={closeRevenue} className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-full hover:text-zinc-200 active:scale-90 transition-all">
                <X size={20}/>
              </button>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/30">
              <button onClick={() => navigateDay('prev')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300 active:scale-95 shadow-sm"><ChevronLeft size={20} /></button>
              <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20"><Calendar size={14} className="text-emerald-400" /><span className="font-bold text-sm text-emerald-400">{formattedDateLabel}</span></div>
              <button onClick={() => navigateDay('next')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300 active:scale-95 shadow-sm"><ChevronRight size={20} /></button>
            </div>
          </div>

          <div className="p-4 pb-40 flex flex-col gap-6">
            
            {/* HERO DO EXTRATO */}
            <div className="relative flex flex-col items-center justify-center bg-gradient-to-b from-[#0a2e1f] to-zinc-950 border border-[#124d35] rounded-[32px] py-9 gap-1 shadow-lg">
              <button onClick={async () => { await safeHaptic(); togglePrivacyMode(); }} className="absolute top-5 right-5 p-2.5 bg-[#0e3b28] text-emerald-400 rounded-full active:scale-90 transition-transform">
                {isPrivacyMode ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
              
              <span className="text-[10px] font-black text-emerald-400/80 uppercase tracking-[0.2em] mb-1">Faturamento Bruto</span>
              <span className="text-4xl font-black text-emerald-400 tracking-tight">
                {isPrivacyMode ? '••••••' : `R$ ${formatMoney(faturamentoTotal)}`}
              </span>
              <div className="mt-3 bg-zinc-900/80 border border-emerald-900/40 px-4 py-1.5 rounded-full flex items-center gap-1.5">
                 <span className="text-[11px] text-zinc-300 font-bold">Ticket Médio: R$ {isPrivacyMode ? '•••' : formatMoney(ticketMedio)}</span>
              </div>
            </div>

            {/* SELETORES DE FORMA DE PAGAMENTO COMO FILTROS */}
            <div className="grid grid-cols-3 gap-2.5">
              <button 
                onClick={() => setPaymentFilter(prev => prev === 'pix' ? 'all' : 'pix')} 
                className={`border rounded-2xl p-4 flex flex-col gap-1 items-center transition-all ${paymentFilter === 'pix' ? 'bg-emerald-500/20 border-emerald-500' : 'bg-zinc-900/60 border-zinc-800'}`}
              >
                <QrCode size={20} className="text-emerald-400 mb-1" />
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">Pix</span>
                <span className="text-xs font-bold text-zinc-100">R$ {isPrivacyMode ? '••' : formatMoney(revenueByMethod['pix'] || 0)}</span>
              </button>

              <button 
                onClick={() => setPaymentFilter(prev => prev === 'dinheiro' ? 'all' : 'dinheiro')} 
                className={`border rounded-2xl p-4 flex flex-col gap-1 items-center transition-all ${paymentFilter === 'dinheiro' ? 'bg-amber-500/20 border-amber-500' : 'bg-zinc-900/60 border-zinc-800'}`}
              >
                <Banknote size={20} className="text-amber-500 mb-1" />
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">Dinheiro</span>
                <span className="text-xs font-bold text-zinc-100">R$ {isPrivacyMode ? '••' : formatMoney(revenueByMethod['dinheiro'] || 0)}</span>
              </button>

              <button 
                onClick={() => setPaymentFilter(prev => prev === 'cartao' ? 'all' : 'cartao')} 
                className={`border rounded-2xl p-4 flex flex-col gap-1 items-center transition-all ${paymentFilter === 'cartao' ? 'bg-sky-500/20 border-sky-500' : 'bg-zinc-900/60 border-zinc-800'}`}
              >
                <CreditCard size={20} className="text-sky-400 mb-1" />
                <span className="text-[10px] text-zinc-400 font-black uppercase tracking-wider">Cartão</span>
                <span className="text-xs font-bold text-zinc-100">R$ {isPrivacyMode ? '••' : formatMoney((revenueByMethod['cartao'] || 0) + (revenueByMethod['cartao_credito'] || 0) + (revenueByMethod['cartao_debito'] || 0))}</span>
              </button>
            </div>

            {/* LISTAGEM DE LANÇAMENTOS COM DESIGN CLEAN */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt size={14}/> {paymentFilter === 'all' ? 'Todos os Lançamentos' : `Filtrado por: ${paymentFilter.toUpperCase()}`}
                </span>
                <span className="text-[11px] font-bold text-zinc-500">
                  {chronologicDeliveries.length} pedido(s)
                </span>
              </div>
              
              {chronologicDeliveries.length === 0 ? (
                 <div className="py-12 flex flex-col items-center justify-center gap-3 bg-zinc-900/30 rounded-2xl border border-zinc-800 border-dashed">
                    <Receipt size={28} className="text-zinc-700"/>
                    <p className="text-center text-xs text-zinc-500 font-semibold">Nenhum lançamento encontrado para este filtro.</p>
                 </div>
              ) : (
                chronologicDeliveries.map((d: any) => {
                  const isExpanded = expandedDeliveryId === d.id;
                  const customer = d.customer_id ? dashboardData.customers?.find((c: any) => c.id === d.customer_id) : null;
                  const displayName = d.customer_name || customer?.name || (d.address_string ? d.address_string.split(',')[0] : 'Cliente');
                  
                  return (
                    <div key={d.id} className="flex flex-col bg-zinc-900/70 border border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden shrink-0">
                      <button onClick={() => toggleDelivery(d.id)} className="flex items-center justify-between p-4 active:bg-zinc-800/80 transition-colors">
                        <div className="flex flex-col truncate pr-3 text-left">
                          <span className="text-sm font-bold text-zinc-100 truncate mb-1">{displayName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400 capitalize flex items-center gap-1 font-semibold bg-zinc-800 px-2 py-0.5 rounded-md">
                              {d.payment_method === 'pix' ? <QrCode size={11} className="text-emerald-400"/> : d.payment_method === 'dinheiro' ? <Banknote size={11} className="text-amber-400"/> : <CreditCard size={11} className="text-sky-400"/>}
                              {d.payment_method?.replace('_', ' ') || 'Dinheiro'}
                            </span>
                            {d.is_paid && (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                Pago no App
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-sm font-black text-emerald-400">
                            + R$ {isPrivacyMode ? '••' : formatMoney(d.value || 0)}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                            <Clock size={10} /> 
                            {new Date(d.updated_at || d.createdAt || Date.now()).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                          </span>
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="p-4 pt-1 bg-zinc-950/60 border-t border-zinc-800/50 flex flex-col gap-3 text-xs animate-in fade-in">
                          <div className="flex items-start gap-2 bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl mt-2">
                            <MapPin size={13} className="text-zinc-500 shrink-0 mt-0.5" />
                            <span className="text-zinc-400 leading-relaxed">{d.address_string}</span>
                          </div>

                          {d.observation && (
                            <div className="flex flex-col gap-1 text-zinc-300 bg-amber-500/5 border border-amber-500/20 p-2.5 rounded-xl">
                              <span className="text-[9px] text-amber-500 font-black uppercase flex items-center gap-1"><FileText size={11}/> Obs:</span>
                              <span className="leading-relaxed">{d.observation}</span>
                            </div>
                          )}

                          <div className="flex justify-between items-center text-zinc-400 px-1">
                            <span>ID Pedido: <strong className="text-zinc-200">#{d.order_id || 'Loja'}</strong></span>
                            {d.confirmation_code && <span>Cód: <strong className="font-mono text-amber-400">{d.confirmation_code}</strong></span>}
                          </div>

                          <button 
                            onClick={() => {
                              closeRevenue();
                              router.push(`/entrega?id=${d.id}`);
                            }}
                            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 transition-all active:scale-95"
                          >
                            Editar ou Ver Entrega <ArrowRight size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
