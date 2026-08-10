'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, X, ChevronLeft, Calendar, ChevronRight, Bike, MapPin, ChevronDown, 
  Wallet, QrCode, Banknote, CreditCard, Receipt
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface PerformanceModalsProps {
  isLogisticsOpen: boolean;
  closeLogistics: () => void;
  isRevenueOpen: boolean;
  closeRevenue: () => void;
  isPrivacyMode: boolean;
  dashboardData: any; // Dados vindos do hook useStoreDashboard
}

export function PerformanceModals({
  isLogisticsOpen, closeLogistics, isRevenueOpen, closeRevenue, isPrivacyMode, dashboardData
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

  return (
    <>
      {/* MODAL 1: RESUMO DE LOGÍSTICA */}
      {isLogisticsOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-zinc-950/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-5 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2"><Package size={20} className="text-sky-500" /> Resumo Logístico</h2>
              <p className="text-xs text-zinc-400 mt-0.5">{totalEntregas} entregas finalizadas e em rota</p>
            </div>
            <button onClick={closeLogistics} className="p-2 bg-zinc-800 text-zinc-400 rounded-full active:scale-90"><X size={20}/></button>
          </div>

          <div className="flex items-center justify-between px-6 py-3 bg-zinc-900/30 border-b border-zinc-800/50 shrink-0">
            <button onClick={() => navigateDay('prev')} className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95"><ChevronLeft size={18} /></button>
            <div className="flex items-center gap-2"><Calendar size={14} className="text-sky-400" /><span className="font-bold text-sm text-zinc-100">{formattedDateLabel}</span></div>
            <button onClick={() => navigateDay('next')} className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95"><ChevronRight size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-40">
            {routesSummary.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center gap-2"><Package size={36} className="text-zinc-700" /><p className="text-center text-zinc-500 text-sm font-medium">Nenhuma rota encontrada nesta data.</p></div>
            ) : (
              routesSummary.map((r: any, i: number) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                  <div className="bg-zinc-800/40 p-4 flex items-center justify-between border-b border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0"><Bike size={18}/></div>
                      <div className="flex flex-col"><span className="font-bold text-zinc-200 text-sm">{r.name}</span><span className="text-[11px] text-zinc-400 font-semibold">{r.motoboy}</span></div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${r.status === 'fechada' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>{r.status}</span>
                      <span className="text-xs font-bold text-zinc-500">{r.deliveries.length} Paradas</span>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-2 bg-zinc-900/50">
                    {r.deliveries.map((d: any, idx: number) => {
                      const isExpanded = expandedDeliveryId === d.id;
                      return (
                        <div key={d.id} className="flex flex-col bg-zinc-950 border border-zinc-800/60 rounded-xl overflow-hidden">
                          <button onClick={() => { if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setExpandedDeliveryId(isExpanded ? null : d.id); }} className="flex items-center justify-between w-full p-3 text-left active:bg-zinc-900 transition-colors">
                            <div className="flex items-start gap-3 overflow-hidden">
                              <span className="text-sky-500 font-bold text-sm mt-0.5 w-4 shrink-0">{idx + 1}.</span>
                              <div className="flex flex-col truncate">
                                <span className="text-xs font-bold text-zinc-200 truncate">{d.address_string.split('-')[0]}</span>
                                <span className="text-[10px] text-zinc-500 truncate mt-0.5"><MapPin size={10} className="inline mr-1"/>{d.address_string}</span>
                              </div>
                            </div>
                            <ChevronDown size={16} className={`text-zinc-500 shrink-0 ml-2 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="p-3 pt-1 bg-zinc-900/80 border-t border-zinc-800/50 flex flex-col gap-2 text-xs">
                               {/* CORREÇÃO DO CAPACITOR: UTILIZANDO QUERY PARAMS (?id=) PARA ROTA ESTÁTICA */}
                               <button onClick={() => router.push(`/entrega?id=${d.id}`)} className="w-full py-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-lg font-bold uppercase tracking-wider mb-2 active:scale-95">Abrir Detalhes do Pedido</button>
                               <div className="flex justify-between items-center text-zinc-300"><span className="text-zinc-500">Valor:</span><span className="font-bold text-emerald-400">R$ {(d.value || 0).toFixed(2).replace('.', ',')}</span></div>
                               <div className="flex justify-between items-center text-zinc-300"><span className="text-zinc-500">Pagamento:</span><span className="capitalize font-medium">{d.payment_method?.replace('_', ' ') || 'Dinheiro'}</span></div>
                               {d.observation && (
                                 <div className="flex flex-col gap-0.5 text-zinc-400 bg-zinc-950 p-2 rounded-lg border border-zinc-800 mt-1">
                                   <span className="text-[10px] text-amber-500 font-bold uppercase">Observação:</span>
                                   <span>{d.observation}</span>
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

      {/* MODAL 2: EXTRATO FINANCEIRO */}
      {isRevenueOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-zinc-950/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-5 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2"><Wallet size={20} className="text-emerald-500" /> Extrato Financeiro</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Faturamento e formas de pagamento</p>
            </div>
            <button onClick={closeRevenue} className="p-2 bg-zinc-800 text-zinc-400 rounded-full active:scale-90"><X size={20}/></button>
          </div>

          <div className="flex items-center justify-between px-6 py-3 bg-zinc-900/30 border-b border-zinc-800/50 shrink-0">
            <button onClick={() => navigateDay('prev')} className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95"><ChevronLeft size={18} /></button>
            <div className="flex items-center gap-2"><Calendar size={14} className="text-emerald-400" /><span className="font-bold text-sm text-zinc-100">{formattedDateLabel}</span></div>
            <button onClick={() => navigateDay('next')} className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 active:scale-95"><ChevronRight size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 pb-40">
            <div className="flex flex-col items-center justify-center bg-emerald-500/10 border border-emerald-500/20 rounded-[24px] py-8 gap-2 shadow-sm">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Total Arrecadado</span>
              <span className="text-5xl font-black text-emerald-400 tracking-tight">{isPrivacyMode ? '•••••' : `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`}</span>
              <span className="text-xs text-emerald-500/70 font-semibold mt-1 bg-emerald-500/10 px-3 py-1 rounded-full">Ticket Médio: R$ {isPrivacyMode ? '••' : ticketMedio.toFixed(2).replace('.', ',')}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1 items-center shadow-sm"><QrCode size={20} className="text-emerald-400 mb-2" /><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pix</span><span className="text-sm font-bold text-zinc-200 mt-1">R$ {isPrivacyMode ? '••' : (revenueByMethod['pix'] || 0).toFixed(2)}</span></div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1 items-center shadow-sm"><Banknote size={20} className="text-amber-500 mb-2" /><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Dinheiro</span><span className="text-sm font-bold text-zinc-200 mt-1">R$ {isPrivacyMode ? '••' : (revenueByMethod['dinheiro'] || 0).toFixed(2)}</span></div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1 items-center shadow-sm"><CreditCard size={20} className="text-sky-400 mb-2" /><span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Cartão</span><span className="text-sm font-bold text-zinc-200 mt-1">R$ {isPrivacyMode ? '••' : ((revenueByMethod['cartao'] || 0) + (revenueByMethod['cartao_credito'] || 0) + (revenueByMethod['cartao_debito'] || 0)).toFixed(2)}</span></div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <span className="text-xs font-bold text-zinc-500 uppercase px-1 tracking-wider flex items-center gap-2"><Receipt size={14}/> Lançamentos Registrados</span>
              {selectedDateDeliveries.length === 0 ? (
                 <p className="text-center text-sm text-zinc-600 mt-4 font-semibold">Nenhuma venda registrada nesta data.</p>
              ) : (
                selectedDateDeliveries.slice().reverse().map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-900 border border-zinc-800/80 p-4 rounded-2xl shadow-sm">
                    <div className="flex flex-col truncate pr-3">
                      <span className="text-sm font-bold text-zinc-200 truncate mb-0.5">{d.address_string.split('-')[0]}</span>
                      <span className="text-[11px] text-zinc-500 capitalize flex items-center gap-1">
                         {d.payment_method === 'pix' ? <QrCode size={10}/> : d.payment_method === 'dinheiro' ? <Banknote size={10}/> : <CreditCard size={10}/>}
                         {d.payment_method?.replace('_', ' ') || 'Dinheiro'}
                      </span>
                    </div>
                    <span className="text-base font-black text-emerald-400 shrink-0">+ R$ {isPrivacyMode ? '••' : (d.value || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
