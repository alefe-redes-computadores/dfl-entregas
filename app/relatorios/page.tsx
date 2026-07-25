'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, BarChart3, Wallet, Map, Activity } from 'lucide-react';
import { useReportsData } from '@/hooks/useReportsData'; // Ajuste o caminho pro seu hook!
import { useAppStore } from '@/store/useAppStore';

import { MonthSelector } from '@/components/reports/MonthSelector';
import { SummaryCard } from '@/components/reports/SummaryCard';
import { PaymentChart } from '@/components/reports/Charts/PaymentChart';
import { NeighborhoodChart } from '@/components/reports/Charts/NeighborhoodChart';
import { DailyEvolutionChart } from '@/components/reports/Charts/DailyEvolutionChart';
import { MotoboyChart } from '@/components/reports/Charts/MotoboyChart';
import { DayOfWeekChart } from '@/components/reports/Charts/DayOfWeekChart';

type TabType = 'geral' | 'financeiro' | 'operacao';

export default function RelatoriosPage() {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  
  const deliveries = useAppStore(state => state.deliveries);
  const reports = useReportsData();

  // Processamento de dados via Hook
  const filteredDeliveries = useMemo(() => reports.getFilteredDeliveries({ month: selectedMonth }), [reports, selectedMonth]);
  const metrics = useMemo(() => reports.getMainMetrics(filteredDeliveries, deliveries as any, selectedMonth), [reports, filteredDeliveries, deliveries, selectedMonth]);
  
  const dailyData = useMemo(() => reports.getDailyEvolution(filteredDeliveries, selectedMonth), [reports, filteredDeliveries, selectedMonth]);
  const paymentData = useMemo(() => reports.getPaymentStats(filteredDeliveries), [reports, filteredDeliveries]);
  const neighborhoodData = useMemo(() => reports.getNeighborhoodStats(filteredDeliveries), [reports, filteredDeliveries]);
  const motoboyData = useMemo(() => reports.getMotoboyStats(filteredDeliveries), [reports, filteredDeliveries]);
  const dayOfWeekData = useMemo(() => reports.getDayOfWeekStats(filteredDeliveries), [reports, filteredDeliveries]);

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header Fixo */}
      <div className="flex items-center justify-between sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md pt-4 pb-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95 transition-all">
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-heading text-2xl font-bold text-zinc-50">Inteligência</h1>
        </div>
        <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
      </div>

      {/* Navegação de Abas (Estilo Banco) */}
      <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800 shadow-sm">
        <button onClick={() => setActiveTab('geral')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'geral' ? 'bg-zinc-800 text-emerald-400 shadow' : 'text-zinc-500'}`}>
          <Activity size={16} /> Geral
        </button>
        <button onClick={() => setActiveTab('financeiro')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'financeiro' ? 'bg-zinc-800 text-amber-400 shadow' : 'text-zinc-500'}`}>
          <Wallet size={16} /> Caixa
        </button>
        <button onClick={() => setActiveTab('operacao')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'operacao' ? 'bg-zinc-800 text-purple-400 shadow' : 'text-zinc-500'}`}>
          <Map size={16} /> Operação
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* ABA 1: GERAL */}
        {activeTab === 'geral' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard title="Total Entregas" value={metrics.totalDeliveries} icon={<BarChart3 size={20} />} variation={metrics.variation} accentColor="emerald" delay={0} />
              <SummaryCard title="Faturamento" value={`R$ ${metrics.totalRevenue.toFixed(2)}`} icon={<Wallet size={20} />} accentColor="amber" delay={100} />
            </div>
            <DailyEvolutionChart data={dailyData} />
          </>
        )}

        {/* ABA 2: FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard title="Ticket Médio" value={`R$ ${metrics.averageTicket.toFixed(2)}`} icon={<Wallet size={20} />} accentColor="blue" delay={0} />
              <SummaryCard title="Melhor Dia" value={metrics.bestDay.day} subtitle={`${metrics.bestDay.deliveries} entregas`} icon={<BarChart3 size={20} />} accentColor="pink" delay={100} />
            </div>
            <PaymentChart data={paymentData} />
            <DayOfWeekChart data={dayOfWeekData} />
          </>
        )}

        {/* ABA 3: OPERAÇÃO */}
        {activeTab === 'operacao' && (
          <>
             <div className="grid grid-cols-1 gap-3">
               {metrics.topMotoboy && (
                 <SummaryCard title="Motoboy Destaque" value={metrics.topMotoboy.name} subtitle={`${metrics.topMotoboy.deliveries} entregas finalizadas`} icon={<Map size={20} />} accentColor="purple" delay={0} />
               )}
             </div>
             <NeighborhoodChart data={neighborhoodData} />
             <MotoboyChart data={motoboyData} />
          </>
        )}
      </div>
    </div>
  );
}
