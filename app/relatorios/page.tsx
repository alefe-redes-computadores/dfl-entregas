// app/relatorios/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  DollarSign, 
  User, 
  Calendar, 
  TrendingUp,
  Download,
  ChevronRight,
  BarChart3,
  PieChart,
  MapPin,
  Clock,
  Award
} from 'lucide-react';

import { useReportsData } from '@/hooks/useReportsData';
import { MonthSelector } from '@/components/reports/MonthSelector';
import { SummaryCard } from '@/components/reports/SummaryCard';
import { DailyEvolutionChart } from '@/components/reports/Charts/DailyEvolutionChart';
import { MotoboyChart } from '@/components/reports/Charts/MotoboyChart';
import { NeighborhoodChart } from '@/components/reports/Charts/NeighborhoodChart';
import { PaymentChart } from '@/components/reports/Charts/PaymentChart';
import { DayOfWeekChart } from '@/components/reports/Charts/DayOfWeekChart';

// Animações customizadas
const animations = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes pulseGlow {
    0%, 100% {
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.1);
    }
    50% {
      box-shadow: 0 0 40px rgba(16, 185, 129, 0.2);
    }
  }
  
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
  
  .animate-fadeInUp {
    animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
  }
  
  .animate-pulseGlow {
    animation: pulseGlow 3s ease-in-out infinite;
  }
  
  .shimmer {
    background: linear-gradient(90deg, 
      rgba(255,255,255,0) 0%, 
      rgba(255,255,255,0.05) 50%, 
      rgba(255,255,255,0) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 2s infinite;
  }
  
  .glass-effect {
    background: rgba(24, 24, 27, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .stat-number {
    font-variant-numeric: tabular-nums;
  }
`;

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const { 
    getFilteredDeliveries,
    getDailyEvolution,
    getMotoboyStats,
    getNeighborhoodStats,
    getPaymentStats,
    getDayOfWeekStats,
    getMainMetrics
  } = useReportsData();

  // Simular carregamento inicial
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Memorizar dados filtrados
  const filteredDeliveries = useMemo(() => {
    return getFilteredDeliveries({ month: selectedMonth });
  }, [selectedMonth, getFilteredDeliveries]);

  // Memorizar todos os dados de entregas para comparação
  const allDeliveries = useMemo(() => {
    return getFilteredDeliveries({ month: 'all' });
  }, [getFilteredDeliveries]);

  // Calcular métricas PASSANDO O selectedMonth
  const metrics = useMemo(() => {
    return getMainMetrics(filteredDeliveries, allDeliveries, selectedMonth);
  }, [filteredDeliveries, allDeliveries, selectedMonth, getMainMetrics]);

  // Dados dos gráficos
  const dailyEvolutionData = useMemo(() => {
    return getDailyEvolution(filteredDeliveries, selectedMonth);
  }, [filteredDeliveries, selectedMonth, getDailyEvolution]);

  const motoboyData = useMemo(() => {
    return getMotoboyStats(filteredDeliveries);
  }, [filteredDeliveries, getMotoboyStats]);

  const neighborhoodData = useMemo(() => {
    return getNeighborhoodStats(filteredDeliveries);
  }, [filteredDeliveries, getNeighborhoodStats]);

  const paymentData = useMemo(() => {
    return getPaymentStats(filteredDeliveries);
  }, [filteredDeliveries, getPaymentStats]);

  const dayOfWeekData = useMemo(() => {
    return getDayOfWeekStats(filteredDeliveries);
  }, [filteredDeliveries, getDayOfWeekStats]);

  const handleExport = async () => {
    setIsExporting(true);
    // Simular exportação
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('Exportando relatório...');
    setIsExporting(false);
  };

  // Formatar nome do mês para exibição
  const getMonthLabel = (month: string): string => {
    if (month === 'all') return 'Todos os meses';
    const [year, monthNum] = month.split('-');
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
  };

  // Calcular total de entregas do período
  const totalDeliveries = filteredDeliveries.length;

  return (
    <>
      <style>{animations}</style>
      
      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900">
        <div className="max-w-7xl mx-auto p-4 pb-24">
          
          {/* HEADER - Mais elegante com gradiente e ícone animado */}
          <div className="relative mb-8">
            {/* Background decorativo */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
            
            <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 animate-pulseGlow">
                    <TrendingUp className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-zinc-100 tracking-tight">
                      Relatórios
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-zinc-400">
                        {getMonthLabel(selectedMonth)}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-zinc-600" />
                      <span className="text-sm text-emerald-400 font-medium">
                        {totalDeliveries} entregas
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="glass-effect rounded-xl px-3 py-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs text-zinc-400">Atualizado agora</span>
                </div>
                
                <MonthSelector 
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                />
                
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className={`
                    relative flex items-center gap-2 px-5 py-2.5 
                    bg-emerald-500 hover:bg-emerald-400 
                    disabled:bg-emerald-500/50 disabled:cursor-not-allowed
                    text-white rounded-xl font-medium text-sm
                    transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]
                    shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30
                  `}
                >
                  {isExporting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Exportando...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Exportar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* CARDS DE MÉTRICAS - Com ícones maiores e mais visuais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <div className="animate-fadeInUp" style={{ animationDelay: '50ms' }}>
              <SummaryCard
                title="Total de Entregas"
                value={metrics.totalDeliveries}
                subtitle={`${filteredDeliveries.length} entregas`}
                icon={<Package className="w-5 h-5" />}
                variation={metrics.variation}
                accentColor="emerald"
                delay={0}
              />
            </div>
            
            <div className="animate-fadeInUp" style={{ animationDelay: '100ms' }}>
              <SummaryCard
                title="Ticket Médio"
                value={`R$ ${metrics.averageTicket.toFixed(2)}`}
                subtitle={`Total: R$ ${metrics.totalRevenue.toFixed(2)}`}
                icon={<DollarSign className="w-5 h-5" />}
                accentColor="amber"
                delay={100}
              />
            </div>
            
            <div className="animate-fadeInUp" style={{ animationDelay: '150ms' }}>
              <SummaryCard
                title="Motoboy Destaque"
                value={metrics.topMotoboy?.name || 'N/A'}
                subtitle={`${metrics.topMotoboy?.deliveries || 0} entregas`}
                icon={<Award className="w-5 h-5" />}
                accentColor="blue"
                delay={200}
              />
            </div>
            
            <div className="animate-fadeInUp" style={{ animationDelay: '200ms' }}>
              <SummaryCard
                title="Melhor Dia"
                value={metrics.bestDay?.day || 'N/A'}
                subtitle={`${metrics.bestDay?.deliveries || 0} entregas`}
                icon={<Calendar className="w-5 h-5" />}
                accentColor="purple"
                delay={300}
              />
            </div>
          </div>

          {/* GRÁFICOS - Com labels e headers mais elegantes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Gráfico 1: Evolução Diária */}
            <div 
              className="animate-fadeInUp" 
              style={{ animationDelay: '150ms' }}
            >
              <div className="glass-effect rounded-2xl p-5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-500/10 rounded-lg">
                      <BarChart3 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-200">Evolução Diária</h3>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                    Entregas × Faturamento
                  </span>
                </div>
                <DailyEvolutionChart data={dailyEvolutionData} />
              </div>
            </div>

            {/* Gráfico 2: Motoboys */}
            <div 
              className="animate-fadeInUp" 
              style={{ animationDelay: '200ms' }}
            >
              <div className="glass-effect rounded-2xl p-5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/10 rounded-lg">
                      <User className="w-4 h-4 text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-200">Desempenho dos Motoboys</h3>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                    Ranking
                  </span>
                </div>
                <MotoboyChart data={motoboyData} />
              </div>
            </div>

            {/* Gráfico 3: Bairros */}
            <div 
              className="animate-fadeInUp" 
              style={{ animationDelay: '250ms' }}
            >
              <div className="glass-effect rounded-2xl p-5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/10 rounded-lg">
                      <MapPin className="w-4 h-4 text-purple-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-200">Bairros com Mais Entregas</h3>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                    Top 10
                  </span>
                </div>
                <NeighborhoodChart data={neighborhoodData} />
              </div>
            </div>

            {/* Gráfico 4: Pagamentos */}
            <div 
              className="animate-fadeInUp" 
              style={{ animationDelay: '300ms' }}
            >
              <div className="glass-effect rounded-2xl p-5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-500/10 rounded-lg">
                      <PieChart className="w-4 h-4 text-amber-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-200">Formas de Pagamento</h3>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                    Distribuição
                  </span>
                </div>
                <PaymentChart data={paymentData} />
              </div>
            </div>

            {/* Gráfico 5: Dias da Semana (Largura total) */}
            <div 
              className="col-span-1 lg:col-span-2 animate-fadeInUp" 
              style={{ animationDelay: '350ms' }}
            >
              <div className="glass-effect rounded-2xl p-5 hover:border-white/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-pink-500/10 rounded-lg">
                      <Calendar className="w-4 h-4 text-pink-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-200">Dias da Semana</h3>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                    Performance
                  </span>
                </div>
                <DayOfWeekChart data={dayOfWeekData} />
              </div>
            </div>

          </div>

          {/* RODAPÉ - Resumo rápido */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 border-t border-zinc-800/50 pt-6">
            <div className="flex items-center gap-4">
              <span>📊 Relatório gerado em tempo real</span>
              <span className="hidden sm:inline w-px h-4 bg-zinc-800" />
              <span className="hidden sm:inline">🔄 Dados sincronizados com Firebase</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Sistema operacional</span>
            </div>
          </div>
          
        </div>
      </div>
    </>
  );
}