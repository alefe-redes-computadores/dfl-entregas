'use client';

import { useState, useMemo, useCallback } from 'react';
import { 
  Package, 
  DollarSign, 
  User, 
  Calendar, 
  TrendingUp,
  Download 
} from 'lucide-react';
import { toast } from 'sonner';

// Importar hooks e componentes com caminhos corrigidos
import { useReportsData } from '@/app/hooks/useReportsData';
import { MonthSelector } from '@/components/reports/MonthSelector';
import { SummaryCard } from '@/components/reports/SummaryCard';
import { DailyEvolutionChart } from '@/components/reports/Charts/DailyEvolutionChart';
import { MotoboyChart } from '@/components/reports/Charts/MotoboyChart';
import { NeighborhoodChart } from '@/components/reports/Charts/NeighborhoodChart';
import { PaymentChart } from '@/components/reports/Charts/PaymentChart';
import { DayOfWeekChart } from '@/components/reports/Charts/DayOfWeekChart';

// Adicionar animações customizadas
const fadeInUpAnimation = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fadeInUp {
    animation: fadeInUp 0.6s ease-out forwards;
  }
`;

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState('all');
  const { 
    getFilteredDeliveries,
    getDailyEvolution,
    getMotoboyStats,
    getNeighborhoodStats,
    getPaymentStats,
    getDayOfWeekStats,
    getMainMetrics,
    extractNeighborhood
  } = useReportsData();

  // Memorizar dados filtrados
  const filteredDeliveries = useMemo(() => {
    return getFilteredDeliveries({ month: selectedMonth });
  }, [selectedMonth, getFilteredDeliveries]);

  // Memorizar todos os dados de entregas para comparação
  const allDeliveries = useMemo(() => {
    return getFilteredDeliveries({ month: 'all' });
  }, [getFilteredDeliveries]);

  // Calcular métricas
  const metrics = useMemo(() => {
    return getMainMetrics(filteredDeliveries, allDeliveries);
  }, [filteredDeliveries, allDeliveries, getMainMetrics]);

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

  // Função inteligente para exportar planilha CSV real
  const handleExport = useCallback(() => {
    if (filteredDeliveries.length === 0) {
      toast.error('Nenhum dado para exportar', {
        description: 'Não há entregas registradas neste período.',
      });
      return;
    }

    try {
      // Cabeçalhos da planilha
      const headers = ['ID', 'Data', 'Motoboy', 'Pagamento', 'Valor', 'Bairro', 'Endereço'];

      // Processa as linhas da planilha
      const csvRows = filteredDeliveries.map(d => {
        let dateStr = 'Data inválida';
        if (d.createdAt) {
          const dateObj = d.createdAt.seconds 
            ? new Date(d.createdAt.seconds * 1000) 
            : new Date(d.createdAt);
          dateStr = dateObj.toLocaleDateString('pt-BR');
        }

        const neighborhood = extractNeighborhood(d.address);
        
        return [
          d.id,
          dateStr,
          d.motoboyName || 'Geral',
          d.paymentMethod || 'N/A',
          d.totalPrice.toFixed(2).replace('.', ','), 
          `"${neighborhood}"`, 
          `"${d.address.replace(/"/g, '""')}"` 
        ].join(';'); 
      });

      const csvContent = [headers.join(';'), ...csvRows].join('\n');
      
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `dfl-relatorio-${selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); 

      toast.success('Relatório exportado!', {
        description: 'A planilha foi baixada no seu dispositivo.',
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar', {
        description: 'Não foi possível gerar a planilha.',
      });
    }
  }, [filteredDeliveries, selectedMonth, extractNeighborhood]);

  return (
    <>
      <style>{fadeInUpAnimation}</style>
      
      <div className="min-h-screen bg-zinc-950 p-4 pb-20">
        {/* Cabeçalho */}
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-emerald-500" />
                Relatórios
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Análise completa das entregas e faturamento
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <MonthSelector 
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
              />
              
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20 transition-all duration-200 text-sm font-medium active:scale-95"
              >
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>

          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <SummaryCard
              title="Total de Entregas"
              value={metrics.totalDeliveries}
              subtitle={`${filteredDeliveries.length} entregas`}
              icon={<Package className="w-5 h-5" />}
              variation={metrics.variation}
              accentColor="emerald"
              delay={0}
            />
            
            <SummaryCard
              title="Ticket Médio"
              value={`R$ ${metrics.averageTicket.toFixed(2).replace('.', ',')}`}
              subtitle={`Total: R$ ${metrics.totalRevenue.toFixed(2).replace('.', ',')}`}
              icon={<DollarSign className="w-5 h-5" />}
              accentColor="amber"
              delay={100}
            />
            
            <SummaryCard
              title="Motoboy Destaque"
              value={metrics.topMotoboy?.name || 'N/A'}
              subtitle={`${metrics.topMotoboy?.deliveries || 0} entregas`}
              icon={<User className="w-5 h-5" />}
              accentColor="blue"
              delay={200}
            />
            
            <SummaryCard
              title="Melhor Dia"
              value={metrics.bestDay?.day || 'N/A'}
              subtitle={`${metrics.bestDay?.deliveries || 0} entregas`}
              icon={<Calendar className="w-5 h-5" />}
              accentColor="purple"
              delay={300}
            />
          </div>

          {/* Gráficos - Grid 2x2 em desktop, 1x1 em mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gráfico 1: Evolução Diária */}
            <div className="animate-fadeInUp" style={{ animationDelay: '100ms' }}>
              <DailyEvolutionChart data={dailyEvolutionData} />
            </div>

            {/* Gráfico 2: Motoboys */}
            <div className="animate-fadeInUp" style={{ animationDelay: '200ms' }}>
              <MotoboyChart data={motoboyData} />
            </div>

            {/* Gráfico 3: Bairros */}
            <div className="animate-fadeInUp" style={{ animationDelay: '300ms' }}>
              <NeighborhoodChart data={neighborhoodData} />
            </div>

            {/* Gráfico 4: Pagamentos */}
            <div className="animate-fadeInUp" style={{ animationDelay: '400ms' }}>
              <PaymentChart data={paymentData} />
            </div>

            {/* Gráfico 5: Dias da Semana (ocupa largura total) */}
            <div className="col-span-1 lg:col-span-2 animate-fadeInUp" style={{ animationDelay: '500ms' }}>
              <DayOfWeekChart data={dayOfWeekData} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
