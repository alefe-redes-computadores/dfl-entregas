'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, BarChart3, Wallet, Map as MapIcon, Activity, X, CheckCircle } from 'lucide-react';
import { useReportsData } from '@/hooks/useReportsData';
import { useAppStore } from '@/store/useAppStore';

import { MonthSelector } from '@/components/reports/MonthSelector';
import { SummaryCard } from '@/components/reports/SummaryCard';
import { PaymentChart } from '@/components/reports/Charts/PaymentChart';
import { NeighborhoodChart } from '@/components/reports/Charts/NeighborhoodChart';
import { DailyEvolutionChart } from '@/components/reports/Charts/DailyEvolutionChart';
import { MotoboyChart } from '@/components/reports/Charts/MotoboyChart';
import { DayOfWeekChart } from '@/components/reports/Charts/DayOfWeekChart';
import { OriginChart } from '@/components/reports/Charts/OriginChart';
import { PeakHoursChart } from '@/components/reports/Charts/PeakHoursChart';
import { LogisticsTimeChart } from '@/components/reports/Charts/LogisticsTimeChart'; // <-- IMPORTANTE!

type TabType = 'geral' | 'financeiro' | 'operacao';

export default function RelatoriosPage() {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [drilldownDay, setDrilldownDay] = useState<{ day: number; date: string } | null>(null);

  const deliveries = useAppStore(state => state.deliveries);
  const routes = useAppStore(state => state.routes); // <-- NOVO: Puxando rotas
  const reports = useReportsData();

  const filteredDeliveries = useMemo(() => reports.getFilteredDeliveries({ month: selectedMonth }), [reports, selectedMonth]);
  const metrics = useMemo(() => reports.getMainMetrics(filteredDeliveries, deliveries as any, selectedMonth), [reports, filteredDeliveries, deliveries, selectedMonth]);
  
  const dailyData = useMemo(() => reports.getDailyEvolution(filteredDeliveries, selectedMonth), [reports, filteredDeliveries, selectedMonth]);
  const paymentData = useMemo(() => reports.getPaymentStats(filteredDeliveries), [reports, filteredDeliveries]);
  const neighborhoodData = useMemo(() => reports.getNeighborhoodStats(filteredDeliveries), [reports, filteredDeliveries]);
  const motoboyData = useMemo(() => reports.getMotoboyStats(filteredDeliveries), [reports, filteredDeliveries]);
  const dayOfWeekData = useMemo(() => reports.getDayOfWeekStats(filteredDeliveries), [reports, filteredDeliveries]);
  const peakHoursData = useMemo(() => reports.getPeakHoursStats(filteredDeliveries), [reports, filteredDeliveries]);
  const originData = useMemo(() => reports.getOriginStats(filteredDeliveries), [reports, filteredDeliveries]);

  // 🧠 CÁLCULO DE LOGÍSTICA EXTREMA (Velocidade)
  const logisticsTimeData = useMemo(() => {
    const statsMap = new Map<string, { totalMinutes: number; totalDeliveries: number }>();
    const [year, month] = selectedMonth === 'all' ? [null, null] : selectedMonth.split('-').map(Number);

    routes.forEach(route => {
      // Regra 1: Filtra o Diretor Operacional (Não calcula métricas para as suas retiradas)
      const name = route.motoboy_name.toLowerCase();
      if (name.includes('álefe') || name.includes('alefe')) return;
      
      // Regra 2: Apenas rotas fechadas que possuem tempo final
      if (route.status !== 'fechada' || !route.end_time) return;

      const date = new Date(route.updated_at || route.departure_time);
      if (year && month) {
        if (date.getMonth() !== month - 1 || date.getFullYear() !== year) return;
      }

      // Usa o novo `started_at` se existir, senão usa o `departure_time`
      const startTime = new Date(route.started_at || route.departure_time).getTime();
      const endTime = new Date(route.end_time).getTime();
      const minutes = (endTime - startTime) / (1000 * 60);

      // Trava de segurança para dados corrompidos
      if (minutes < 0 || minutes > 600) return; 

      const routeDeliveries = deliveries.filter(d => d.route_id === route.id);
      if (routeDeliveries.length === 0) return;

      const current = statsMap.get(route.motoboy_name) || { totalMinutes: 0, totalDeliveries: 0 };
      statsMap.set(route.motoboy_name, {
        totalMinutes: current.totalMinutes + minutes,
        totalDeliveries: current.totalDeliveries + routeDeliveries.length
      });
    });

    return Array.from(statsMap.entries()).map(([name, data]) => ({
      name,
      avgTimePerDelivery: data.totalDeliveries > 0 ? (data.totalMinutes / data.totalDeliveries) : 0,
      totalDeliveries: data.totalDeliveries
    })).sort((a, b) => a.avgTimePerDelivery - b.avgTimePerDelivery); // Do mais rápido pro mais lento
  }, [routes, deliveries, selectedMonth]);

  const drilldownDeliveries = useMemo(() => {
    if (!drilldownDay) return [];
    return filteredDeliveries.filter(d => reports.formatDate(d.createdAt || d.updated_at).getDate() === drilldownDay.day);
  }, [drilldownDay, filteredDeliveries, reports]);

  return (
    <div className="flex flex-col gap-6 pb-24 relative">
      <div className="flex items-center justify-between sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-xl pt-4 pb-3 px-1 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 active:scale-95 transition-all">
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-heading text-xl font-black tracking-tight text-zinc-50">Dashboard</h1>
        </div>
        <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
      </div>

      <div className="flex bg-zinc-900/60 p-1.5 rounded-full border border-zinc-800/80 mx-1">
        <button onClick={() => setActiveTab('geral')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-xs transition-all duration-300 ${activeTab === 'geral' ? 'bg-zinc-800 text-emerald-400 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <Activity size={14} /> Visão Geral
        </button>
        <button onClick={() => setActiveTab('financeiro')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-xs transition-all duration-300 ${activeTab === 'financeiro' ? 'bg-zinc-800 text-amber-400 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <Wallet size={14} /> Receitas
        </button>
        <button onClick={() => setActiveTab('operacao')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-xs transition-all duration-300 ${activeTab === 'operacao' ? 'bg-zinc-800 text-sky-400 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <MapIcon size={14} /> Logística
        </button>
      </div>

      <div className="flex flex-col gap-5 px-1 animate-in fade-in duration-500">
        
        {activeTab === 'geral' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard title="Total Entregas" value={metrics.totalDeliveries} icon={<BarChart3 size={20} />} variation={metrics.variation} accentColor="emerald" />
              <SummaryCard title="Faturamento Bruto" value={`R$ ${metrics.totalRevenue.toFixed(2)}`} icon={<Wallet size={20} />} accentColor="amber" />
            </div>
            <DailyEvolutionChart data={dailyData} onSelectDay={setDrilldownDay} />
            <OriginChart data={originData} />
          </>
        )}

        {activeTab === 'financeiro' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard title="Ticket Médio" value={`R$ ${metrics.averageTicket.toFixed(2)}`} icon={<Wallet size={20} />} accentColor="blue" />
              <SummaryCard title="Melhor Dia" value={metrics.bestDay.day} subtitle={`R$ ${metrics.bestDay.revenue.toFixed(2)}`} icon={<BarChart3 size={20} />} accentColor="pink" />
            </div>
            <PaymentChart data={paymentData} />
            <DayOfWeekChart data={dayOfWeekData} />
          </>
        )}

        {activeTab === 'operacao' && (
          <>
             <PeakHoursChart data={peakHoursData} />
             <LogisticsTimeChart data={logisticsTimeData} />
             <NeighborhoodChart data={neighborhoodData} />
             <MotoboyChart data={motoboyData} />
          </>
        )}
      </div>

      {drilldownDay && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-[32px] p-6 max-h-[80vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-xl font-bold text-zinc-50">Detalhes do Dia {drilldownDay.date}</h2>
                <p className="text-xs text-zinc-400">{drilldownDeliveries.length} entregas realizadas nesta data</p>
              </div>
              <button onClick={() => setDrilldownDay(null)} className="p-2 bg-zinc-800 text-zinc-400 rounded-full hover:bg-zinc-700 active:scale-95">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-4 flex flex-col gap-3">
              {drilldownDeliveries.map(d => (
                <div key={d.id} className="flex items-center justify-between p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800/80">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-100">#{d.order_id || 'Loja'}</span>
                      {d.is_paid && <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"><CheckCircle size={10} /> Pago</span>}
                    </div>
                    <span className="text-xs text-zinc-400 truncate max-w-[200px]">{d.address_string}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">R$ {d.value.toFixed(2).replace('.', ',')}</span>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{d.payment_method}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
