// app/hooks/useReportsData.ts
import { useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';

// Definir interfaces localmente baseadas nos tipos reais da sua store
interface ReportFilters {
  month: string; // Formato: '2026-07'
}

// Interface Delivery baseada nos seus tipos reais
interface Delivery {
  id: string;
  route_id: string;
  order_id: string;
  confirmation_code: string;
  customer_id: string;
  value: number;
  is_paid: boolean;
  payment_method: string;
  change_for?: number;
  address_string: string;
  maps_link: string;
  observation?: string;
  drinks?: string;
  createdAt: any;
}

// Interface Route baseada nos seus tipos reais
interface Route {
  id: string;
  name: string;
  status: string;
  motoboy_name: string;
  departure_time: string;
  end_time?: string;
  change_money: number;
  drinks_summary?: string;
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
  const routes = useAppStore(state => state.routes) as Route[];
  const deliveries = useAppStore(state => state.deliveries) as Delivery[];
  
  // Extrair bairro do endereço
  const extractNeighborhood = useCallback((address: string): string => {
    if (!address) return 'Não informado';
    
    // address_string vem como "Rua, Número, Bairro"
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      return parts[2] || 'Não informado';
    }
    
    // Se não tiver 3 partes, tenta pegar a última parte
    if (parts.length > 0) {
      return parts[parts.length - 1] || 'Não informado';
    }
    
    return 'Não informado';
  }, []);

  // Formatar data
  const formatDate = useCallback((timestamp: any): Date => {
    if (!timestamp) return new Date();
    
    // Se for string ISO
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    // Se for objeto Firebase com toDate
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    // Se for objeto com seconds (Firestore)
    if (timestamp?.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000);
    }
    return new Date();
  }, []);

  // Filtrar entregas por mês
  const getFilteredDeliveries = useCallback((filters: ReportFilters): Delivery[] => {
    if (filters.month === 'all') {
      return deliveries;
    }
    
    const [year, month] = filters.month.split('-').map(Number);
    return deliveries.filter(d => {
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
        revenue: existing.revenue + (delivery.value || 0)
      });
    });
    
    // Converter para array
    const monthNum = month === 'all' ? '01' : month.split('-')[1];
    return Array.from(dailyMap.entries()).map(([day, data]) => ({
      day,
      date: `${day.toString().padStart(2, '0')}/${monthNum}`,
      deliveries: data.deliveries,
      revenue: Number(data.revenue.toFixed(2))
    }));
  }, [formatDate]);

  // Calcular estatísticas dos motoboys
  const getMotoboyStats = useCallback((filteredDeliveries: Delivery[]): MotoboyStats[] => {
    const motoboyMap = new Map<string, { deliveries: number; revenue: number }>();
    
    filteredDeliveries.forEach(delivery => {
      // Encontrar a rota associada a esta entrega
      const route = routes.find(r => r.id === delivery.route_id);
      const motoboyName = route?.motoboy_name || 'Não atribuído';
      
      const existing = motoboyMap.get(motoboyName) || { deliveries: 0, revenue: 0 };
      motoboyMap.set(motoboyName, {
        deliveries: existing.deliveries + 1,
        revenue: existing.revenue + (delivery.value || 0)
      });
    });
    
    return Array.from(motoboyMap.entries())
      .map(([name, stats]) => ({
        name,
        deliveries: stats.deliveries,
        revenue: Number(stats.revenue.toFixed(2))
      }))
      .sort((a, b) => b.deliveries - a.deliveries);
  }, [routes]);

  // Calcular estatísticas dos bairros
  const getNeighborhoodStats = useCallback((filteredDeliveries: Delivery[]): NeighborhoodStats[] => {
    const neighborhoodMap = new Map<string, number>();
    
    filteredDeliveries.forEach(delivery => {
      const neighborhood = extractNeighborhood(delivery.address_string || '');
      neighborhoodMap.set(neighborhood, (neighborhoodMap.get(neighborhood) || 0) + 1);
    });
    
    return Array.from(neighborhoodMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [extractNeighborhood]);

  // Calcular estatísticas de pagamento
  const getPaymentStats = useCallback((filteredDeliveries: Delivery[]): PaymentStats[] => {
    const paymentMap = new Map<string, { count: number; total: number }>();
    
    // Mapear métodos de pagamento para nomes amigáveis
    const methodMap: Record<string, string> = {
      'dinheiro': 'Dinheiro',
      'pix': 'PIX',
      'cartao_credito': 'Cartão Crédito',
      'cartao_debito': 'Cartão Débito'
    };
    
    filteredDeliveries.forEach(delivery => {
      const method = methodMap[delivery.payment_method] || delivery.payment_method || 'Não informado';
      const existing = paymentMap.get(method) || { count: 0, total: 0 };
      paymentMap.set(method, {
        count: existing.count + 1,
        total: existing.total + (delivery.value || 0)
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
        revenue: existing.revenue + (delivery.value || 0)
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
    const totalRevenue = filteredDeliveries.reduce((sum, d) => sum + (d.value || 0), 0);
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
      const currentDate = formatDate(filteredDeliveries[0]?.createdAt || new Date());
      
      const previousMonth = new Date(currentDate);
      previousMonth.setMonth(previousMonth.getMonth() - 1);
      
      const previousMonthDeliveries = allDeliveries.filter(d => {
        const date = formatDate(d.createdAt);
        return date.getMonth() === previousMonth.getMonth() && 
               date.getFullYear() === previousMonth.getFullYear();
      });
      
      if (previousMonthDeliveries.length > 0) {
        variation = ((filteredDeliveries.length - previousMonthDeliveries.length) / previousMonthDeliveries.length) * 100;
      } else if (filteredDeliveries.length > 0) {
        variation = 100;
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