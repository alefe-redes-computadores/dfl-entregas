'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, X, ChevronLeft, Calendar, ChevronRight, MapPin, ChevronDown, 
  Wallet, QrCode, Banknote, CreditCard, Receipt, Eye, EyeOff, FileText, Clock,
  ArrowRight, Filter, User, TrendingUp, Users
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { RouteAccordion } from '@/components/home/RouteAccordion'; 

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

  const { 
    goToPreviousDay, goToNextDay, formattedDateLabel, 
    faturamentoTotal, ticketMedio, 
    revenueByMethod, selectedDateDeliveries, selectedDateRoutes
  } = dashboardData;

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

  // =========================================================
  // LÓGICA DE FILTROS E SOMAS (LOGÍSTICA)
  // =========================================================
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
      faturamento: deliveries.reduce((acc: number, d: any) => acc + (d.value || 0), 0)
    };
  }, [filteredRoutes, selectedDateDeliveries]);

  // =========================================================
  // ORDEM CRONOLÓGICA BLINDADA (EXTRATO)
  // =========================================================
  const chronologicDeliveries = useMemo(() => {
    return [...(selectedDateDeliveries || [])].sort((a, b) => {
      const timeA = new Date(a.updated_at || a.createdAt || 0).getTime();
      const timeB = new Date(b.updated_at || b.createdAt || 0).getTime();
      // DECRESCENTE: Os mais recentes no topo
      return timeB - timeA; 
    });
  }, [selectedDateDeliveries]);

  return (
    <>
      {/* ========================================================= */}
      {/* MODAL 1: RESUMO LOGÍSTICO */}
      {/* ========================================================= */}
      {isLogisticsOpen && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto block animate-in slide-in-from-bottom duration-300">
          
          <div className="sticky top-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/80 shadow-md">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2">
                  <Package size={20} className="text-sky-500" /> Resumo Logístico
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Visão geral da equipe na data</p>
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
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><Package size={12} className="text-sky-500"/> Entregas</span>
                    <span className="text-3xl font-black text-zinc-100 tracking-tight">{dynamicStats.entregas}</span>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-[24px] p-5 flex flex-col gap-1.5 relative shadow-sm">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5"><TrendingUp size={12} className="text-emerald-500"/> Faturamento</span>
                    <span className="text-xl font-black text-emerald-400 mt-1 tracking-tight truncate">{isPrivacyMode ? '••••••' : `R$ ${dynamicStats.faturamento.toFixed(2).replace('.', ',')}`}</span>
                    <button onClick={() => { safeHaptic(); togglePrivacyMode(); }} className="absolute top-5 right-5 text-zinc-500 active:scale-90 transition-transform">
                      {isPrivacyMode ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>

                <div className="w-full h-px bg-zinc-800/50 my-1" />

                <div className="flex flex-col gap-8">
                  {/* FIX DO VERCEL: Tipagem correta para evitar type 'unknown' */}
                  {Object.entries(groupedRoutes).map(([motoboyName, rotasObj]) => {
                    const rotasDoMotoboy = rotasObj as any[];
                    return (
                      <div key={motoboyName} className="flex flex-col gap-4 animate-in fade-in">
                        <div className="flex items-center justify-between px-2">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400"><Users size={14}/></div>
                            <span className="font-bold text-zinc-200 text-sm">{motoboyName}</span>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{rotasDoMotoboy.length} rotas</span>
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
      {/* MODAL 2: EXTRATO FINANCEIRO PREMIUM */}
      {/* ========================================================= */}
      {isRevenueOpen && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 overflow-y-auto block animate-in slide-in-from-bottom duration-300">
          
          <div className="sticky top-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/80 shadow-md">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2"><Wallet size={20} className="text-emerald-500" /> Extrato do Dia</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Faturamento e desempenho financeiro</p>
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
            
            <div className="relative flex flex-col items-center justify-center bg-[#051a12] border border-[#0a2e1f] rounded-[32px] py-10 gap-1 shadow-lg">
              <button onClick={async () => { await safeHaptic(); togglePrivacyMode(); }} className="absolute top-5 right-5 p-2.5 bg-[#0a2e1f] text-emerald-500 rounded-full active:scale-90 transition-transform">
                {isPrivacyMode ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
              
              <span className="text-[10px] font-black text-emerald-500/80 uppercase tracking-[0.2em] mb-1">Total Arrecadado</span>
              <span className="text-5xl font-black text-emerald-400 tracking-tight">
                {isPrivacyMode ? '••••••' : `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`}
              </span>
              <div className="mt-3 bg-[#0a2e1f] border border-emerald-900/50 px-4 py-1.5 rounded-full flex items-center gap-1.5">
                 <span className="text-[11px] text-emerald-500 font-bold">Ticket Médio: R$ {isPrivacyMode ? '•••' : ticketMedio.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 flex flex-col gap-1.5 items-center">
                <QrCode size={24} className="text-emerald-400 mb-2" />
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Pix</span>
                <span className="text-sm font-bold text-zinc-100 mt-1">R$ {isPrivacyMode ? '••' : (revenueByMethod['pix'] || 0).toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 flex flex-col gap-1.5 items-center">
                <Banknote size={24} className="text-amber-500 mb-2" />
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Dinheiro</span>
                <span className="text-sm font-bold text-zinc-100 mt-1">R$ {isPrivacyMode ? '••' : (revenueByMethod['dinheiro'] || 0).toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 flex flex-col gap-1.5 items-center">
                <CreditCard size={24} className="text-sky-400 mb-2" />
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Cartão</span>
                <span className="text-sm font-bold text-zinc-100 mt-1">R$ {isPrivacyMode ? '••' : ((revenueByMethod['cartao'] || 0) + (revenueByMethod['cartao_credito'] || 0) + (revenueByMethod['cartao_debito'] || 0)).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-4">
              <span className="text-xs font-bold text-zinc-500 uppercase px-2 tracking-widest flex items-center gap-2">
                <Receipt size={14}/> Lançamentos Registrados
              </span>
              
              {chronologicDeliveries.length === 0 ? (
                 <div className="py-12 flex flex-col items-center justify-center gap-3 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed">
                    <Receipt size={32} className="text-zinc-700"/>
                    <p className="text-center text-sm text-zinc-500 font-semibold">Nenhuma venda registrada nesta data.</p>
                 </div>
              ) : (
                chronologicDeliveries.map((d: any) => {
                  const isExpanded = expandedDeliveryId === d.id;
                  
                  return (
                    <div key={d.id} className="flex flex-col bg-zinc-900 border border-zinc-800/80 rounded-3xl shadow-sm overflow-hidden shrink-0">
                      <button onClick={() => toggleDelivery(d.id)} className="flex items-center justify-between p-5 active:bg-zinc-800 transition-colors">
                        <div className="flex flex-col truncate pr-3 text-left">
                          <span className="text-sm font-bold text-zinc-200 truncate mb-1">{d.address_string.split('-')[0]}</span>
                          <span className="text-[11px] text-zinc-500 capitalize flex items-center gap-1.5 font-semibold">
                              {d.payment_method === 'pix' ? <QrCode size={12}/> : d.payment_method === 'dinheiro' ? <Banknote size={12}/> : <CreditCard size={12}/>}
                              {d.payment_method?.replace('_', ' ') || 'Dinheiro'}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <span className="text-base font-black text-emerald-400 shrink-0">
                              + R$ {isPrivacyMode ? '••' : (d.value || 0).toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-800/50">
                              <Clock size={10} className="text-zinc-600"/> 
                              {new Date(d.updated_at || d.createdAt || Date.now()).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
                            </span>
                        </div>
                      </button>
                      
                      {isExpanded && (
                          <div className="p-5 pt-2 bg-zinc-950/40 border-t border-zinc-800/50 flex flex-col gap-4 text-sm animate-in fade-in">
                            {d.observation && (
                              <div className="flex flex-col gap-1.5 text-zinc-300 bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-xl">
                                <span className="text-[10px] text-amber-500 font-black uppercase tracking-wider flex items-center gap-1.5"><FileText size={12}/> Observação</span>
                                <span className="leading-relaxed text-xs font-medium">{d.observation}</span>
                              </div>
                            )}

                            <div className="flex justify-between items-center text-zinc-400 px-2 mt-1">
                              <span className="text-xs font-semibold">ID: <strong className="text-zinc-300">#{d.order_id || 'Loja'}</strong></span>
                            </div>

                            <button 
                              onClick={() => {
                                closeRevenue();
                                // USANDO QUERY PARAMS PARA EVITAR 404 NO NEXT EXPORT
                                router.push(`/entrega?id=${d.id}`);
                              }}
                              className="w-full mt-2 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                              Abrir Detalhes do Pedido <ArrowRight size={14} />
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
