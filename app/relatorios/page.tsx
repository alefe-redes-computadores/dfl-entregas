'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, BarChart3, Wallet, Map as MapIcon, Activity, X, CheckCircle, ChevronDown } from 'lucide-react';
import { useReportsData } from '@/hooks/useReportsData';
import { useAppStore } from '@/store/useAppStore';

import { SummaryCard } from '@/components/reports/SummaryCard';
import { PaymentChart } from '@/components/reports/Charts/PaymentChart';
import { NeighborhoodChart } from '@/components/reports/Charts/NeighborhoodChart';
import { DailyEvolutionChart } from '@/components/reports/Charts/DailyEvolutionChart';
import { MotoboyChart } from '@/components/reports/Charts/MotoboyChart';
import { DayOfWeekChart } from '@/components/reports/Charts/DayOfWeekChart';
import { OriginChart } from '@/components/reports/Charts/OriginChart';
import { PeakHoursChart } from '@/components/reports/Charts/PeakHoursChart';
import { LogisticsTimeChart } from '@/components/reports/Charts/LogisticsTimeChart';

type TabType = 'geral' | 'financeiro' | 'operacao';

export default function RelatoriosPage() {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState('all'); 
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false); // NOVO: Controle do Modal Bonito
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [drilldownDay, setDrilldownDay] = useState<{ day: number; date: string } | null>(null);

  const deliveries = useAppStore(state => state.deliveries);
  const routes = useAppStore(state => state.routes);
  const reports = useReportsData();

  // Dicionário para o botão exibir o nome bonito do período selecionado
  const periodLabels: Record<string, string> = {
    'all': 'Todo Período',
    'today': 'Hoje',
    '7d': 'Últimos 7 dias',
    '14d': 'Últimos 14 dias',
    '30d': 'Últimos 30 dias'
  };

  // 1. FILTRO FANTASMA (LIMPEZA) E FILTRO DE TEMPO
  const filteredDeliveries = useMemo(() => {
    const countByDay: Record<string, number> = {};
    deliveries.forEach(d => {
      const day = new Date((d as any).createdAt || d.updated_at).toLocaleDateString();
      countByDay[day] = (countByDay[day] || 0) + 1;
    });

    const cleanDeliveries = deliveries.filter(d => {
      const day = new Date((d as any).createdAt || d.updated_at).toLocaleDateString();
      return countByDay[day] < 55; 
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return cleanDeliveries.filter(d => {
      if (selectedPeriod === 'all') return true;
      
      const dDate = new Date((d as any).createdAt || d.updated_at);
      const targetDate = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
      const diffTime = today.getTime() - targetDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (selectedPeriod === 'today') return diffDays === 0;
      if (selectedPeriod === '7d') return diffDays <= 7;
      if (selectedPeriod === '14d') return diffDays <= 14;
      if (selectedPeriod === '30d') return diffDays <= 30;
      return true;
    });
  }, [deliveries, selectedPeriod]);

  // Passando os dados limpos para os hooks geradores de relatórios
  const metrics = useMemo(() => reports.getMainMetrics(filteredDeliveries, filteredDeliveries as any, 'all'), [reports, filteredDeliveries]);
  const dailyData = useMemo(() => reports.getDailyEvolution(filteredDeliveries, 'all'), [reports, filteredDeliveries]);
  const paymentData = useMemo(() => reports.getPaymentStats(filteredDeliveries), [reports, filteredDeliveries]);
  const neighborhoodData = useMemo(() => reports.getNeighborhoodStats(filteredDeliveries), [reports, filteredDeliveries]);
  const motoboyData = useMemo(() => reports.getMotoboyStats(filteredDeliveries), [reports, filteredDeliveries]);
  const dayOfWeekData = useMemo(() => reports.getDayOfWeekStats(filteredDeliveries), [reports, filteredDeliveries]);
  const peakHoursData = useMemo(() => reports.getPeakHoursStats(filteredDeliveries), [reports, filteredDeliveries]);
  const originData = useMemo(() => reports.getOriginStats(filteredDeliveries), [reports, filteredDeliveries]);

  // CÁLCULO DE LOGÍSTICA
  const logisticsTimeData = useMemo(() => {
    const statsMap = new Map<string, { totalMinutes: number; totalDeliveries: number }>();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    routes.forEach(route => {
      const name = route.motoboy_name.toLowerCase();
      if (name.includes('álefe') || name.includes('alefe')) return;
      if (route.status !== 'fechada' || !route.end_time) return;

      const rDate = new Date(route.updated_at || route.departure_time);
      const targetDate = new Date(rDate.getFullYear(), rDate.getMonth(), rDate.getDate());
      const diffTime = today.getTime() - targetDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let inPeriod = false;
      if (selectedPeriod === 'all') inPeriod = true;
      else if (selectedPeriod === 'today') inPeriod = diffDays === 0;
      else if (selectedPeriod === '7d') inPeriod = diffDays <= 7;
      else if (selectedPeriod === '14d') inPeriod = diffDays <= 14;
      else if (selectedPeriod === '30d') inPeriod = diffDays <= 30;

      if (!inPeriod) return;

      const startTime = new Date(route.started_at || route.departure_time).getTime();
      const endTime = new Date(route.end_time).getTime();
      const minutes = (endTime - startTime) / (1000 * 60);

      if (minutes < 0 || minutes > 600) return; 

      const routeDeliveries = filteredDeliveries.filter(d => d.route_id === route.id);
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
    })).sort((a, b) => a.avgTimePerDelivery - b.avgTimePerDelivery);
  }, [routes, filteredDeliveries, selectedPeriod]);

  const drilldownDeliveries = useMemo(() => {
    if (!drilldownDay) return [];
    return filteredDeliveries.filter(d => reports.formatDate((d as any).createdAt || d.updated_at).getDate() === drilldownDay.day);
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
        
        {/* NOVO BOTÃO QUE ABRE O MODAL BONITO */}
        <button 
          onClick={() => setIsPeriodModalOpen(true)}
          className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-emerald-500 text-xs font-bold py-2.5 px-4 rounded-full active:scale-95 transition-all shadow-sm"
        >
          <span>{periodLabels[selectedPeriod]}</span>
          <ChevronDown size={14} className="text-emerald-500" />
        </button>
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

      {/* MODAL DE DETALHES DO DIA (DRILLDOWN) */}
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

      {/* NOVO MODAL PREMIUM DE SELEÇÃO DE PERÍODO */}
      {isPeriodModalOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-zinc-700" />
            
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-zinc-50">Selecionar Período</h2>
              <button 
                onClick={() => setIsPeriodModalOpen(false)} 
                className="p-2 bg-zinc-800 text-zinc-400 rounded-full hover:bg-zinc-700 active:scale-95 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-2.5">
              {[
                { value: 'all', label: 'Todo Período' },
                { value: 'today', label: 'Hoje' },
                { value: '7d', label: 'Últimos 7 dias' },
                { value: '14d', label: 'Últimos 14 dias' },
                { value: '30d', label: 'Últimos 30 dias' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setSelectedPeriod(opt.value);
                    setIsPeriodModalOpen(false);
                  }}
                  className={`flex items-center justify-between p-4 rounded-[20px] border transition-all active:scale-[0.98] ${
                    selectedPeriod === opt.value
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm'
                      : 'bg-zinc-950/50 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span className="font-bold text-sm">{opt.label}</span>
                  {selectedPeriod === opt.value && <CheckCircle size={18} className="text-emerald-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
