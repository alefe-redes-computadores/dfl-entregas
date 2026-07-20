// app/hooks/useReportsData.ts
import { useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface ReportFilters {
  month: string; // Formato: '2026-07'
}

interface Delivery {
  id: string;
  routeId: string;
  status: string;
  totalPrice: number;
  paymentMethod: string;
  address: string;
  createdAt: any; // Timestamp do Firebase
  motoboyName?: string;
}

interface Route {
  id: string;
  name: string;
  motoboyName: string;
  deliveries: string[]; // IDs das entregas
}

interface DayData {
  day: number;
  date: string;
  deliveries: number;
  revenue: number;
}

interface MotoboyStats {
  name: string;
  deliveries: number;
  revenue: number;
}

interface NeighborhoodStats {
  name: string;
  count: number;
}

interface PaymentStats {
  method: string;
  count: number;
  total: number;
}

interface DayOfWeekStats {
  day: string;
  deliveries: number;
  revenue: number;
}

export function useReportsData() {
  const routes = useAppStore(state => state.routes);
  const deliveries = useAppStore(state => state.deliveries);
  
  // Extrair bairro do endereço (função auxiliar)
  const extractNeighborhood = useCallback((address: string): string => {
    if (!address) return 'Não informado';
    
    // Tenta extrair bairro de padrões comuns
    const patterns = [
      /bairro\s*[:]?\s*([^,;]+)/i,
      /,\s*([^,]+?)\s*-\s*[A-Z]{2}/,
      /,\s*([^,]+?)\s*,\s*[A-Z]{2}/i,
    ];
    
    for (const pattern of patterns) {
      const match = address.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Se não encontrar padrão, tenta pegar o último segmento antes do estado
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const possibleNeighborhood = parts[parts.length - 2];
      if (possibleNeighborhood && possibleNeighborhood.length > 0) {
        return possibleNeighborhood;
      }
    }
    
    return 'Outros';
  }, []);

  // Formatar data do Firebase
  const formatDate = useCallback((timestamp: any): Date => {
    if (timestamp?.toDate) {
      return timestamp.toDate();
    }
    if (timestamp?.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    return new Date();
  }, []);

  // Filtrar entregas por mês
  const getFilteredDeliveries = useCallback((filters: ReportFilters) => {
    if (filters.month === 'all') {
      return deliveries.filter(d => d.status === 'delivered');
    }
    
    const [year, month] = filters.month.split('-').map(Number);
    return deliveries.filter(d => {
      if (d.status !== 'delivered') return false;
      const date = formatDate(d.createdAt);
      return date.getMonth() === month - 1 && date.getFullYear() === year;
    });
  }, [deliveries, formatDate]);

  // Calcular dados do gráfico de evolução diária
  const getDailyEvolution = useCallback((filteredDeliveries: Delivery[], month: string): DayData[] => {
    if (filteredDeliveries.length === 0) return [];
    
    const daysInMonth = month === 'all' ? 31 : new Date(
      Number(month.split('-')[0]),
      Number(month.split('-')[1]),
      0
    ).getDate();
    
    // Inicializar dias
    const dailyMap = new Map<number, { deliveries: number; revenue: number }>();
    for (let i = 1; i <= daysInMonth; i++) {
      dailyMap.set(i, { deliveries: 0, revenue: 0 });
    }
    
    // Preencher com dados reais
    filteredDeliveries.forEach(delivery => {
      const date = formatDate(delivery.createdAt);
      const day = date.getDate();
      const existing = dailyMap.get(day) || { deliveries: 0, revenue: 0 };
      dailyMap.set(day, {
        deliveries: existing.deliveries + 1,
        revenue: existing.revenue + delivery.totalPrice
      });
    });
    
    // Converter para array
    return Array.from(dailyMap.entries()).map(([day, data]) => ({
      day,
      date: `${day.toString().padStart(2, '0')}/${month.split('-')[1]}`,
      deliveries: data.deliveries,
      revenue: Number(data.revenue.toFixed(2))
    }));
  }, [formatDate]);

  // Calcular estatísticas dos motoboys
  const getMotoboyStats = useCallback((filteredDeliveries: Delivery[]): MotoboyStats[] => {
    const motoboyMap = new Map<string, { deliveries: number; revenue: number }>();
    
    filteredDeliveries.forEach(delivery => {
      const name = delivery.motoboyName || 'Não atribuído';
      const existing = motoboyMap.get(name) || { deliveries: 0, revenue: 0 };
      motoboyMap.set(name, {
        deliveries: existing.deliveries + 1,
        revenue: existing.revenue + delivery.totalPrice
      });
    });
    
    return Array.from(motoboyMap.entries())
      .map(([name, stats]) => ({
        name,
        deliveries: stats.deliveries,
        revenue: Number(stats.revenue.toFixed(2))
      }))
      .sort((a, b) => b.deliveries - a.deliveries);
  }, []);

  // Calcular estatísticas dos bairros
  const getNeighborhoodStats = useCallback((filteredDeliveries: Delivery[]): NeighborhoodStats[] => {
    const neighborhoodMap = new Map<string, number>();
    
    filteredDeliveries.forEach(delivery => {
      const neighborhood = extractNeighborhood(delivery.address);
      neighborhoodMap.set(neighborhood, (neighborhoodMap.get(neighborhood) || 0) + 1);
    });
    
    return Array.from(neighborhoodMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10
  }, [extractNeighborhood]);

  // Calcular estatísticas de pagamento
  const getPaymentStats = useCallback((filteredDeliveries: Delivery[]): PaymentStats[] => {
    const paymentMap = new Map<string, { count: number; total: number }>();
    
    filteredDeliveries.forEach(delivery => {
      const method = delivery.paymentMethod || 'Não informado';
      const existing = paymentMap.get(method) || { count: 0, total: 0 };
      paymentMap.set(method, {
        count: existing.count + 1,
        total: existing.total + delivery.totalPrice
      });
    });
    
    return Array.from(paymentMap.entries())
      .map(([method, stats]) => ({
        method,
        count: stats.count,
        total: Number(stats.total.toFixed(2))
      }))
      .sort((a, b) => b.total - a.total);
  }, []);

  // Calcular estatísticas por dia da semana
  const getDayOfWeekStats = useCallback((filteredDeliveries: Delivery[]): DayOfWeekStats[] => {
    const dayMap = new Map<number, { deliveries: number; revenue: number }>();
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    
    // Inicializar todos os dias
    for (let i = 0; i < 7; i++) {
      dayMap.set(i, { deliveries: 0, revenue: 0 });
    }
    
    filteredDeliveries.forEach(delivery => {
      const date = formatDate(delivery.createdAt);
      const dayOfWeek = date.getDay();
      const existing = dayMap.get(dayOfWeek) || { deliveries: 0, revenue: 0 };
      dayMap.set(dayOfWeek, {
        deliveries: existing.deliveries + 1,
        revenue: existing.revenue + delivery.totalPrice
      });
    });
    
    return Array.from(dayMap.entries())
      .map(([dayIndex, data]) => ({
        day: dayNames[dayIndex],
        deliveries: data.deliveries,
        revenue: Number(data.revenue.toFixed(2))
      }));
  }, [formatDate]);

  // Calcular métricas principais
  const getMainMetrics = useCallback((filteredDeliveries: Delivery[], allDeliveries: Delivery[]) => {
    const totalDeliveries = filteredDeliveries.length;
    const totalRevenue = filteredDeliveries.reduce((sum, d) => sum + d.totalPrice, 0);
    const averageTicket = totalDeliveries > 0 ? totalRevenue / totalDeliveries : 0;
    
    // Motoboy destaque
    const motoboyStats = getMotoboyStats(filteredDeliveries);
    const topMotoboy = motoboyStats.length > 0 ? motoboyStats[0] : null;
    
    // Melhor dia da semana
    const dayStats = getDayOfWeekStats(filteredDeliveries);
    const bestDay = dayStats.reduce((best, current) => 
      current.deliveries > best.deliveries ? current : best
    , dayStats[0] || { day: 'N/A', deliveries: 0, revenue: 0 });
    
    // Variação com mês anterior
    let variation = 0;
    if (filteredDeliveries.length > 0) {
      // Filtrar entregas do mês anterior (entregas não filtradas - todas entregues)
      const currentMonth = filteredDeliveries;
      const currentDate = formatDate(currentMonth[0]?.createdAt || new Date());
      
      const previousMonth = new Date(currentDate);
      previousMonth.setMonth(previousMonth.getMonth() - 1);
      
      const previousMonthDeliveries = allDeliveries.filter(d => {
        if (d.status !== 'delivered') return false;
        const date = formatDate(d.createdAt);
        return date.getMonth() === previousMonth.getMonth() && 
               date.getFullYear() === previousMonth.getFullYear();
      });
      
      if (previousMonthDeliveries.length > 0) {
        variation = ((currentMonth.length - previousMonthDeliveries.length) / previousMonthDeliveries.length) * 100;
      } else {
        variation = 100; // Primeiro mês com entregas
      }
    }
    
    return {
      totalDeliveries,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      averageTicket: Number(averageTicket.toFixed(2)),
      topMotoboy,
      bestDay,
      variation: Number(variation.toFixed(1)),
      motoboyStats
    };
  }, [getMotoboyStats, getDayOfWeekStats, formatDate]);

  // Retornar todas as funções
  return {
    getFilteredDeliveries,
    getDailyEvolution,
    getMotoboyStats,
    getNeighborhoodStats,
    getPaymentStats,
    getDayOfWeekStats,
    getMainMetrics,
    extractNeighborhood,
    formatDate
  };
}