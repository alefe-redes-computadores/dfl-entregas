'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, X, ChevronLeft, Calendar, ChevronRight, Bike, MapPin, ChevronDown, 
  Wallet, QrCode, Banknote, CreditCard, Receipt, Eye, EyeOff, FileText, Clock
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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

  const { 
    goToPreviousDay, goToNextDay, formattedDateLabel, 
    totalEntregas, faturamentoTotal, ticketMedio, 
    revenueByMethod, routesSummary, selectedDateDeliveries 
  } = dashboardData;

  const navigateDay = (direction: 'prev' | 'next') => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
    direction === 'prev' ? goToPreviousDay() : goToNextDay();
  };

  const toggleDelivery = (id: string) => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
    setExpandedDeliveryId(prev => prev === id ? null : id);
  };

  return (
    <>
      {/* ========================================================= */}
      {/* MODAL 1: RESUMO LOGÍSTICO */}
      {/* ========================================================= */}
      {isLogisticsOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 h-[100dvh] animate-in slide-in-from-bottom duration-300">
          <div className="sticky top-0 z-20 flex flex-col bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/80">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2"><Package size={20} className="text-sky-500" /> Resumo Logístico</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{totalEntregas} entregas finalizadas e em rota</p>
              </div>
              <button onClick={closeLogistics} className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-full active:scale-90"><X size={20}/></button>
            </div>
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/40">
              <button onClick={() => navigateDay('prev')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300 active:scale-95 shadow-sm"><ChevronLeft size={20} /></button>
              <div className="flex items-center gap-2 bg-sky-500/10 px-4 py-2 rounded-full border border-sky-500/20"><Calendar size={14} className="text-sky-400" /><span className="font-bold text-sm text-sky-400">{formattedDateLabel}</span></div>
              <button onClick={() => navigateDay('next')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300 active:scale-95 shadow-sm"><ChevronRight size={20} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-[120px] hide-scrollbar">
            {routesSummary.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3"><Package size={48} className="text-zinc-800" /><p className="text-center text-zinc-500 text-sm font-semibold">Nenhuma rota encontrada nesta data.</p></div>
            ) : (
              routesSummary.map((r: any, i: number) => (
                <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-[24px] overflow-hidden shadow-lg">
                  <div className="bg-zinc-800/40 p-5 flex items-center justify-between border-b border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0"><Bike size={22}/></div>
                      <div className="flex flex-col"><span className="font-bold text-zinc-100 text-base">{r.name}</span><span className="text-xs text-zinc-400 font-semibold">{r.motoboy}</span></div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm ${r.status === 'fechada' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-500'}`}>{r.status}</span>
                      <span className="text-xs font-bold text-zinc-500">{r.deliveries.length} Paradas</span>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-2 bg-zinc-950/30">
                    {r.deliveries.map((d: any, idx: number) => {
                      const isExpanded = expandedDeliveryId === d.id;
                      return (
                        <div key={d.id} className="flex flex-col bg-zinc-950 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm transition-all">
                          <button onClick={() => toggleDelivery(d.id)} className="flex items-center justify-between w-full p-4 text-left active:bg-zinc-900 transition-colors">
                            <div className="flex items-start gap-3 overflow-hidden">
                              <span className="text-sky-500 font-black text-sm mt-0.5 w-4 shrink-0">{idx + 1}.</span>
                              <div className="flex flex-col truncate">
                                <span className="text-sm font-bold text-zinc-100 truncate">{d.address_string.split('-')[0]}</span>
                                <span className="text-xs text-zinc-500 truncate mt-1 flex items-center gap-1"><MapPin size={12} className="shrink-0"/>{d.address_string}</span>
                              </div>
                            </div>
                            <ChevronDown size={18} className={`text-zinc-500 shrink-0 ml-2 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          
                          {isExpanded && (
                            <div className="p-4 pt-2 bg-zinc-900/40 border-t border-zinc-800/80 flex flex-col gap-3 text-sm animate-in slide-in-from-top-2">
                               <button onClick={() => router.push(`/entrega?id=${d.id}`)} className="w-full py-3 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl font-bold uppercase tracking-wider text-[11px] mb-1 active:scale-95 transition-transform">
                                 Abrir Detalhes do Pedido
                               </button>
                               <div className="flex justify-between items-center bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                 <span className="text-zinc-400 font-semibold flex items-center gap-2"><Wallet size={16} className="text-zinc-500"/> Valor</span>
                                 <span className="font-black text-emerald-400 text-base">R$ {(d.value || 0).toFixed(2).replace('.', ',')}</span>
                               </div>
                               <div className="flex justify-between items-center bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                 <span className="text-zinc-400 font-semibold flex items-center gap-2">
                                    {d.payment_method === 'pix' ? <QrCode size={16} className="text-zinc-500"/> : d.payment_method === 'dinheiro' ? <Banknote size={16} className="text-zinc-500"/> : <CreditCard size={16} className="text-zinc-500"/>}
                                    Forma de Pagto
                                 </span>
                                 <span className="capitalize font-bold text-zinc-200">{d.payment_method?.replace('_', ' ') || 'Dinheiro'}</span>
                               </div>
                               {d.observation && (
                                 <div className="flex flex-col gap-1.5 text-zinc-300 bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl mt-1">
                                   <span className="text-xs text-amber-500 font-black uppercase tracking-wider flex items-center gap-1.5"><FileText size={14}/> Observação</span>
                                   <span className="leading-relaxed font-medium">{d.observation}</span>
                                 </div>
                               )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: EXTRATO FINANCEIRO PREMIUM */}
      {/* ========================================================= */}
      {isRevenueOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 h-[100dvh] animate-in slide-in-from-bottom duration-300">
          <div className="sticky top-0 z-20 flex flex-col bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/80">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="flex flex-col">
                <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2"><Wallet size={20} className="text-emerald-500" /> Extrato do Dia</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Faturamento e desempenho financeiro</p>
              </div>
              <button onClick={closeRevenue} className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-full active:scale-90"><X size={20}/></button>
            </div>

            <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/40">
              <button onClick={() => navigateDay('prev')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300 active:scale-95 shadow-sm"><ChevronLeft size={20} /></button>
              <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20"><Calendar size={14} className="text-emerald-400" /><span className="font-bold text-sm text-emerald-400">{formattedDateLabel}</span></div>
              <button onClick={() => navigateDay('next')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-300 active:scale-95 shadow-sm"><ChevronRight size={20} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 pb-[120px] hide-scrollbar">
            
            {/* PAINEL DE FATURAMENTO TOTAL PREMIUM (Fundo Verde Escuro) */}
            <div className="relative flex flex-col items-center justify-center bg-[#051a12] border border-[#0a2e1f] rounded-[32px] py-10 gap-1 shadow-lg">
              <button 
                onClick={() => { if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); togglePrivacyMode(); }} 
                className="absolute top-5 right-5 p-2.5 bg-[#0a2e1f] text-emerald-500 rounded-full active:scale-90 transition-transform"
              >
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-1.5 items-center shadow-md">
                <QrCode size={24} className="text-emerald-400 mb-2" />
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Pix</span>
                <span className="text-sm font-bold text-zinc-100 mt-1">R$ {isPrivacyMode ? '••' : (revenueByMethod['pix'] || 0).toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-1.5 items-center shadow-md">
                <Banknote size={24} className="text-amber-500 mb-2" />
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Dinheiro</span>
                <span className="text-sm font-bold text-zinc-100 mt-1">R$ {isPrivacyMode ? '••' : (revenueByMethod['dinheiro'] || 0).toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-1.5 items-center shadow-md">
                <CreditCard size={24} className="text-sky-400 mb-2" />
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Cartão</span>
                <span className="text-sm font-bold text-zinc-100 mt-1">R$ {isPrivacyMode ? '••' : ((revenueByMethod['cartao'] || 0) + (revenueByMethod['cartao_credito'] || 0) + (revenueByMethod['cartao_debito'] || 0)).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <span className="text-xs font-bold text-zinc-500 uppercase px-2 tracking-widest flex items-center gap-2">
                <Receipt size={14}/> Lançamentos Registrados
              </span>
              
              {selectedDateDeliveries.length === 0 ? (
                 <div className="py-12 flex flex-col items-center justify-center gap-3 bg-zinc-900/30 rounded-3xl border border-zinc-800 border-dashed">
                    <Receipt size={32} className="text-zinc-700"/>
                    <p className="text-center text-sm text-zinc-500 font-semibold">Nenhuma venda registrada nesta data.</p>
                 </div>
              ) : (
                selectedDateDeliveries.slice().reverse().map((d: any, i: number) => {
                  const isExpanded = expandedDeliveryId === d.id;
                  return (
                    <div key={d.id} className="flex flex-col bg-zinc-900 border border-zinc-800/80 rounded-[20px] shadow-sm overflow-hidden">
                      <button onClick={() => toggleDelivery(d.id)} className="flex items-center justify-between p-5 active:bg-zinc-800 transition-colors">
                        <div className="flex flex-col truncate pr-3 text-left">
                          <span className="text-sm font-bold text-zinc-200 truncate mb-1.5">{d.address_string.split('-')[0]}</span>
                          <span className="text-[11px] text-zinc-500 capitalize flex items-center gap-1.5 font-medium">
                             {d.payment_method === 'pix' ? <QrCode size={12}/> : d.payment_method === 'dinheiro' ? <Banknote size={12}/> : <CreditCard size={12}/>}
                             {d.payment_method?.replace('_', ' ') || 'Dinheiro'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                           <span className="text-base font-black text-emerald-400 shrink-0">
                             + R$ {isPrivacyMode ? '••' : (d.value || 0).toFixed(2).replace('.', ',')}
                           </span>
                           <ChevronDown size={18} className={`text-zinc-600 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}/>
                        </div>
                      </button>
                      
                      {isExpanded && (
                         <div className="p-4 pt-2 bg-zinc-950/50 border-t border-zinc-800/50 flex flex-col gap-3 text-sm animate-in slide-in-from-top-2">
                           <button onClick={() => router.push(`/entrega?id=${d.id}`)} className="w-full py-3 bg-zinc-800/50 text-zinc-300 border border-zinc-700/50 rounded-xl font-bold uppercase tracking-wider text-[11px] mb-1 active:scale-95 transition-transform">
                             Abrir Detalhes do Pedido
                           </button>
                           {d.observation && (
                             <div className="flex flex-col gap-1.5 text-zinc-300 bg-amber-500/5 border border-amber-500/20 p-3 rounded-xl">
                               <span className="text-xs text-amber-500 font-black uppercase tracking-wider flex items-center gap-1.5"><FileText size={14}/> Observação</span>
                               <span className="leading-relaxed font-medium">{d.observation}</span>
                             </div>
                           )}
                           <div className="flex justify-between items-center text-zinc-400 px-1 mt-1">
                             <span className="text-xs">ID: <strong className="text-zinc-300">#{d.order_id || 'Loja'}</strong></span>
                             <span className="text-xs"><Clock size={12} className="inline mr-1 -mt-0.5"/> {new Date(d.updated_at || Date.now()).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>
                           </div>
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
