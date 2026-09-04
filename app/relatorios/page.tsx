'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, BarChart3, Wallet, Map as MapIcon, Activity, X, 
  CheckCircle, ChevronDown, PackageOpen, Banknote, CreditCard, QrCode, CalendarDays
} from 'lucide-react';
import { useReportsData } from '@/hooks/useReportsData';
import { useAppStore } from '@/store/useAppStore';

import { SummaryCard } from '@/components/reports/SummaryCard';
import { BossSavingsCard } from '@/components/reports/Charts/BossSavingsCard';
import { PaymentChart } from '@/components/reports/Charts/PaymentChart';
import { NeighborhoodChart } from '@/components/reports/Charts/NeighborhoodChart';
import { DailyEvolutionChart } from '@/components/reports/Charts/DailyEvolutionChart';
import { MotoboyChart } from '@/components/reports/Charts/MotoboyChart';
import { DayOfWeekChart } from '@/components/reports/Charts/DayOfWeekChart';
import { OriginChart } from '@/components/reports/Charts/OriginChart';
import { PeakHoursChart } from '@/components/reports/Charts/PeakHoursChart';
import { LogisticsTimeChart } from '@/components/reports/Charts/LogisticsTimeChart';

type TabType = 'geral' | 'financeiro' | 'operacao';

// Formatador oficial com ponto de milhar e vírgula nos centavos
const formatMoney = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RelatoriosPage() {
  const router = useRouter();
  
  // 🔥 Por padrão agora abre nos Últimos 7 Dias
  const [selectedPeriod, setSelectedPeriod] = useState('7d'); 
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false); 
  const [activeTab, setActiveTab] = useState<TabType>('geral');
  const [drilldownDay, setDrilldownDay] = useState<{ day: number; date: string } | null>(null);

  const deliveries = useAppStore(state => state.deliveries);
  const routes = useAppStore(state => state.routes);
  const reports = useReportsData();

  const periodLabels: Record<string, string> = {
    'all': 'Todo Período',
    'today': 'Hoje',
    '7d': 'Últimos 7 dias',
    '14d': 'Últimos 14 dias',
    '30d': 'Últimos 30 dias'
  };

  const TAXA_ECONOMIZADA_POR_ENTREGA = 7.00;

  // FILTRO CIRÚRGICO ANTI-BUG E POR PERÍODO
  const filteredDeliveries = useMemo(() => {
    const countByMotoboyDay = new Map<string, number>();

    deliveries.forEach(d => {
      const route = routes.find(r => r.id === d.route_id);
      const mName = route ? route.motoboy_name.toLowerCase() : 'avulso';
      const dTime = new Date((d as any).createdAt || d.updated_at).getTime();
      const brtDate = new Date(dTime - 3 * 3600000).toISOString().split('T')[0];
      const key = `${brtDate}_${mName}`;
      countByMotoboyDay.set(key, (countByMotoboyDay.get(key) || 0) + 1);
    });

    const cleanDeliveries = deliveries.filter(d => {
      const route = routes.find(r => r.id === d.route_id);
      const mName = route ? route.motoboy_name.toLowerCase() : 'avulso';
      const dTime = new Date((d as any).createdAt || d.updated_at).getTime();
      const brtDate = new Date(dTime - 3 * 3600000).toISOString().split('T')[0];
      const key = `${brtDate}_${mName}`;

      if ((countByMotoboyDay.get(key) || 0) > 32) return false;

      if (route && route.status === 'fechada' && route.end_time) {
        const start = new Date(route.started_at || route.departure_time).getTime();
        const end = new Date(route.end_time).getTime();
        if ((end - start) < 5 * 60 * 1000) return false;
      }

      return true;
    });

    const now = new Date();
    const today = new Date(now.getTime() - 3 * 3600000); 

    return cleanDeliveries.filter(d => {
      if (selectedPeriod === 'all') return true;
      
      const dTime = new Date((d as any).createdAt || d.updated_at).getTime();
      const dDate = new Date(dTime - 3 * 3600000);
      
      const targetDate = new Date(dDate.getFullYear(), dDate.getMonth(), dDate.getDate());
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const diffTime = todayDate.getTime() - targetDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (selectedPeriod === 'today') return diffDays === 0;
      if (selectedPeriod === '7d') return diffDays <= 7;
      if (selectedPeriod === '14d') return diffDays <= 14;
      if (selectedPeriod === '30d') return diffDays <= 30;
      return true;
    });
  }, [deliveries, routes, selectedPeriod]);

  // SEPARA ENTREGAS DO CHEFE (ÁLEFE)
  const alefeDeliveries = useMemo(() => {
    return filteredDeliveries.filter(d => {
      const r = routes.find(x => x.id === d.route_id);
      return r && (r.motoboy_name.toLowerCase().includes('álefe') || r.motoboy_name.toLowerCase().includes('alefe'));
    });
  }, [filteredDeliveries, routes]);

  const savedAmount = alefeDeliveries.length * TAXA_ECONOMIZADA_POR_ENTREGA;
  const motoboyFilteredDeliveries = filteredDeliveries.filter(d => !alefeDeliveries.includes(d));

  const metrics = useMemo(() => reports.getMainMetrics(filteredDeliveries, filteredDeliveries as any, 'all'), [reports, filteredDeliveries]);
  const dailyData = useMemo(() => reports.getDailyEvolution(filteredDeliveries, 'all'), [reports, filteredDeliveries]);
  const paymentData = useMemo(() => reports.getPaymentStats(filteredDeliveries), [reports, filteredDeliveries]);
  const neighborhoodData = useMemo(() => reports.getNeighborhoodStats(filteredDeliveries), [reports, filteredDeliveries]);
  const dayOfWeekData = useMemo(() => reports.getDayOfWeekStats(filteredDeliveries), [reports, filteredDeliveries]);
  const originData = useMemo(() => reports.getOriginStats(filteredDeliveries), [reports, filteredDeliveries]);
  
  const motoboyData = useMemo(() => reports.getMotoboyStats(motoboyFilteredDeliveries), [reports, motoboyFilteredDeliveries]);

  const peakHoursData = useMemo(() => {
    const rawData = reports.getPeakHoursStats(filteredDeliveries);
    const uniqueDaysCount = new Set(filteredDeliveries.map(d => {
      const dTime = new Date((d as any).createdAt || d.updated_at).getTime();
      return new Date(dTime - 3 * 3600000).toISOString().split('T')[0];
    })).size || 1;

    return rawData.map((p: any) => {
      const timeLabel = p.hour || p.time || '00h';
      const deliveriesCount = p.count !== undefined ? p.count : (p.deliveries || 0);

      return {
        time: timeLabel,
        deliveries: selectedPeriod === 'today' ? deliveriesCount : Math.ceil(deliveriesCount / uniqueDaysCount)
      };
    });
  }, [filteredDeliveries, reports, selectedPeriod]);

  const logisticsTimeData = useMemo(() => {
    const statsMap = new Map<string, { totalMinutes: number; totalDeliveries: number }>();
    
    routes.forEach(route => {
      const name = route.motoboy_name.toLowerCase();
      if (name.includes('álefe') || name.includes('alefe')) return;
      if (route.status !== 'fechada' || !route.end_time) return;

      const startTime = new Date(route.started_at || route.departure_time).getTime();
      const endTime = new Date(route.end_time).getTime();
      const minutes = (endTime - startTime) / (1000 * 60);

      if (minutes < 5 || minutes > 600) return; 

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
  }, [routes, filteredDeliveries]);

  const drilldownDeliveries = useMemo(() => {
    if (!drilldownDay) return [];
    return filteredDeliveries.filter(d => reports.formatDate((d as any).createdAt || d.updated_at).getDate() === drilldownDay.day);
  }, [drilldownDay, filteredDeliveries, reports]);

  return (
    <div className="flex flex-col gap-6 pb-24 relative">
      <div className="flex items-center justify-between sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-xl pt-4 pb-3 px-2 border-b border-zinc-900">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/')} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 active:scale-95 transition-all shadow-sm">
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-heading text-xl font-black tracking-tight text-zinc-50">Dashboard</h1>
        </div>
        
        <button 
          onClick={() => setIsPeriodModalOpen(true)}
          className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold py-2 px-3 rounded-full active:scale-95 transition-all shadow-sm"
        >
          <CalendarDays size={14}/>
          <span>{periodLabels[selectedPeriod]}</span>
          <ChevronDown size={14} className="ml-1" />
        </button>
      </div>

      <div className="flex bg-zinc-900/60 p-1.5 rounded-[20px] border border-zinc-800/80 mx-2">
        <button onClick={() => setActiveTab('geral')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[16px] font-bold text-xs transition-all duration-300 ${activeTab === 'geral' ? 'bg-zinc-800 text-emerald-400 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <Activity size={14} /> Visão Geral
        </button>
        <button onClick={() => setActiveTab('financeiro')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[16px] font-bold text-xs transition-all duration-300 ${activeTab === 'financeiro' ? 'bg-zinc-800 text-amber-400 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <Wallet size={14} /> Receitas
        </button>
        <button onClick={() => setActiveTab('operacao')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[16px] font-bold text-xs transition-all duration-300 ${activeTab === 'operacao' ? 'bg-zinc-800 text-sky-400 shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}>
          <MapIcon size={14} /> Logística
        </button>
      </div>

      <div className="flex flex-col gap-5 px-2 animate-in fade-in duration-500">
        
        {activeTab === 'geral' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard title="Total Entregas" value={metrics.totalDeliveries} icon={<PackageOpen size={20} />} variation={metrics.variation} accentColor="emerald" />
              {/* Formatação Perfeita do Dinheiro */}
              <SummaryCard title="Faturamento Bruto" value={`R$ ${formatMoney(metrics.totalRevenue)}`} icon={<Wallet size={20} />} accentColor="amber" />
            </div>
            <DailyEvolutionChart data={dailyData} onSelectDay={setDrilldownDay} />
            <OriginChart data={originData} />
          </>
        )}

        {activeTab === 'financeiro' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <SummaryCard title="Ticket Médio" value={`R$ ${formatMoney(metrics.averageTicket)}`} icon={<BarChart3 size={20} />} accentColor="blue" />
              <SummaryCard title="Melhor Dia" value={metrics.bestDay.day} subtitle={`R$ ${formatMoney(metrics.bestDay.revenue)}`} icon={<Wallet size={20} />} accentColor="pink" />
            </div>

            <BossSavingsCard deliveriesCount={alefeDeliveries.length} savedAmount={savedAmount} />

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

      {/* ================================================================================== */}
      {/* MODAL DRILLDOWN DO DIA (Extrato do Gráfico) COM VISUAL PREMIUM */}
      {/* ================================================================================== */}
      {drilldownDay && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-zinc-800" />
            
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
              <div className="flex flex-col">
                <h2 className="text-xl font-black text-zinc-50 tracking-tight">Detalhes do Dia <span className="text-sky-400">{drilldownDay.date}</span></h2>
                <p className="text-xs font-semibold text-zinc-500 mt-1">{drilldownDeliveries.length} {drilldownDeliveries.length === 1 ? 'entrega realizada' : 'entregas realizadas'}</p>
              </div>
              <button onClick={() => setDrilldownDay(null)} className="p-2 bg-zinc-900 text-zinc-400 rounded-full hover:bg-zinc-800 active:scale-95 transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 py-4 flex flex-col gap-3 hide-scrollbar">
              {drilldownDeliveries.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-sm">Nenhum dado detalhado encontrado.</div>
              ) : (
                drilldownDeliveries.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-4 bg-zinc-900/60 rounded-[20px] border border-zinc-800/80 shadow-sm">
                    <div className="flex flex-col truncate pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-zinc-100">#{d.order_id || 'Loja'}</span>
                        {d.is_paid && <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md"><CheckCircle size={10} /> Pago no App</span>}
                      </div>
                      <span className="text-xs text-zinc-400 truncate w-full flex items-center gap-1.5">
                        <MapIcon size={12} className="shrink-0 text-zinc-600"/> {d.address_string.split('-')[0]}
                      </span>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-1">
                      <span className="font-black text-emerald-400 text-base tracking-tight">R$ {formatMoney(d.value || 0)}</span>
                      <span className="text-[10px] uppercase tracking-wider font-bold flex items-center gap-1 text-zinc-500">
                         {d.payment_method === 'pix' ? <QrCode size={10} className="text-emerald-500"/> : d.payment_method === 'dinheiro' ? <Banknote size={10} className="text-amber-500"/> : <CreditCard size={10} className="text-sky-400"/>}
                         {d.payment_method?.replace('_', ' ') || 'Dinheiro'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================================== */}
      {/* MODAL SELETOR DE PERÍODO */}
      {/* ================================================================================== */}
      {isPeriodModalOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-950 border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-zinc-800" />
            
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black tracking-tight text-zinc-50">Selecionar Período</h2>
              <button onClick={() => setIsPeriodModalOpen(false)} className="p-2.5 bg-zinc-900 text-zinc-400 rounded-full hover:text-zinc-200 active:scale-95 transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              {[
                { value: 'all', label: 'Todo Período' },
                { value: 'today', label: 'Hoje' },
                { value: '7d', label: 'Últimos 7 dias' },
                { value: '14d', label: 'Últimos 14 dias' },
                { value: '30d', label: 'Últimos 30 dias' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSelectedPeriod(opt.value); setIsPeriodModalOpen(false); }}
                  className={`flex items-center justify-between p-4 rounded-[20px] border transition-all active:scale-[0.98] ${
                    selectedPeriod === opt.value 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md' 
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
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