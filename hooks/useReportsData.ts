import { useMemo, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface ReportFilters {
  month: string;
}

interface Delivery {
  id: string;
  route_id: string;
  order_id?: string;
  origin?: string;
  confirmation_code?: string;
  customer_id: string;
  value: number;
  is_paid: boolean;
  payment_method: string;
  change_for?: number;
  address_string: string;
  maps_link: string;
  observation?: string;
  drinks?: string;
  createdAt?: any;
  updated_at?: string;
}

interface Route {
  id: string;
  name: string;
  status: string;
  motoboy_name: string;
  departure_time: string;
  end_time?: string;
  change_money: number;
  drinks_summary?: string;
  updated_at?: string;
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
  const routes = useAppStore(state => state.routes) as unknown as Route[];
  const deliveries = useAppStore(state => state.deliveries) as unknown as Delivery[];
  
  const extractNeighborhood = useCallback((address: string): string => {
    if (!address) return 'Não informado';
    if (address.includes('-')) {
      const parts = address.split('-');
      const potentialNeighborhood = parts[parts.length - 1].trim();
      return potentialNeighborhood.replace(/[0-9]/g, '').trim() || 'Não informado';
    }
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      return parts[2].replace(/[0-9]/g, '').trim() || 'Não informado';
    }
    if (parts.length > 0) {
      return parts[parts.length - 1].replace(/[0-9]/g, '').trim() || 'Não informado';
    }
    return 'Não informado';
  }, []);

  const formatDate = useCallback((timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (timestamp?.seconds !== undefined) return new Date(timestamp.seconds * 1000);
    return new Date();
  }, []);

  const getFilteredDeliveries = useCallback((filters: ReportFilters): Delivery[] => {
    if (filters.month === 'all') return deliveries;
    const [year, month] = filters.month.split('-').map(Number);
    return deliveries.filter(d => {
      const date = formatDate(d.createdAt || d.updated_at);
      return date.getMonth() === month - 1 && date.getFullYear() === year;
    });
  }, [deliveries, formatDate]);

  const getDailyEvolution = useCallback((filteredDeliveries: Delivery[], month: string): DayData[] => {
    if (filteredDeliveries.length === 0) return [];
    const daysInMonth = month === 'all' ? 31 : new Date(
      Number(month.split('-')[0]),
      Number(month.split('-')[1]),
      0
    ).getDate();
    
    const dailyMap = new Map<number, { deliveries: number; revenue: number }>();
    for (let i = 1; i <= daysInMonth; i++) {
      dailyMap.set(i, { deliveries: 0, revenue: 0 });
    }
    
    filteredDeliveries.forEach(delivery => {
      const date = formatDate(delivery.createdAt || delivery.updated_at);
      const day = date.getDate();
      const existing = dailyMap.get(day) || { deliveries: 0, revenue: 0 };
      dailyMap.set(day, {
        deliveries: existing.deliveries + 1,
        revenue: existing.revenue + (delivery.value || 0)
      });
    });
    
    const monthNum = month === 'all' ? '01' : month.split('-')[1];
    return Array.from(dailyMap.entries()).map(([day, data]) => ({
      day,
      date: `${day.toString().padStart(2, '0')}/${monthNum}`,
      deliveries: data.deliveries,
      revenue: Number(data.revenue.toFixed(2))
    }));
  }, [formatDate]);

  const getMotoboyStats = useCallback((filteredDeliveries: Delivery[]): MotoboyStats[] => {
    const motoboyMap = new Map<string, { deliveries: number; revenue: number }>();
    filteredDeliveries.forEach(delivery => {
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

  const getPaymentStats = useCallback((filteredDeliveries: Delivery[]): PaymentStats[] => {
    const paymentMap = new Map<string, { count: number; total: number }>();
    
    const methodMap: Record<string, string> = {
      'dinheiro': 'Dinheiro',
      'pix': 'Pix',
      'cartao': 'Cartão',
      'cartao_credito': 'Cartão',
      'cartao_debito': 'Cartão'
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

  const getDayOfWeekStats = useCallback((filteredDeliveries: Delivery[]): DayOfWeekStats[] => {
    const dayMap = new Map<number, { deliveries: number; revenue: number }>();
    // NOMES CURTOS PARA CABER NO CELULAR
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    for (let i = 0; i < 7; i++) {
      dayMap.set(i, { deliveries: 0, revenue: 0 });
    }
    
    filteredDeliveries.forEach(delivery => {
      const date = formatDate(delivery.createdAt || delivery.updated_at);
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

  // 🧠 NOVA INTELIGÊNCIA: Horários de Pico (FILTRO NOTURNO + ORDENAÇÃO)
  const getPeakHoursStats = useCallback((filteredDeliveries: Delivery[]) => {
    const hoursMap = new Map<number, number>();
    
    filteredDeliveries.forEach(delivery => {
      const date = formatDate(delivery.createdAt || delivery.updated_at);
      const hour = date.getHours();
      // FILTRO DE SANEAMENTO: Ignora entregas importadas/bugadas feitas no meio do dia. 
      // Considera apenas a partir das 17h até as 05h da manhã.
      if (hour >= 17 || hour <= 5) {
        hoursMap.set(hour, (hoursMap.get(hour) || 0) + 1);
      }
    });
    
    return Array.from(hoursMap.entries())
      .filter(([_, count]) => count > 0)
      .map(([hour, count]) => ({
        hour: `${hour.toString().padStart(2, '0')}h`,
        count,
        rawHour: hour
      }))
      .sort((a, b) => {
        // Ordena para que 17, 18, 19 venham antes de 00, 01, 02 da madrugada
        const hA = a.rawHour <= 5 ? a.rawHour + 24 : a.rawHour;
        const hB = b.rawHour <= 5 ? b.rawHour + 24 : b.rawHour;
        return hA - hB;
      })
      .map(({ hour, count }) => ({ hour, count }));
  }, [formatDate]);

  // 🧠 NOVA INTELIGÊNCIA: Dados dos Canais de Venda (Resolve o bug de aparecer só Loja Própria)
  const getOriginStats = useCallback((filteredDeliveries: Delivery[]) => {
    let ifoodCount = 0, ifoodTotal = 0;
    let lojaCount = 0, lojaTotal = 0;
    
    filteredDeliveries.forEach(d => {
      // Se não tiver origem cadastrada (pedidos antigos), assume que foi iFood
      const origin = d.origin || 'ifood'; 
      if (origin === 'ifood') {
        ifoodCount++;
        ifoodTotal += (d.value || 0);
      } else {
        lojaCount++;
        lojaTotal += (d.value || 0);
      }
    });
    
    return [
      { origin: 'ifood', count: ifoodCount, total: ifoodTotal },
      { origin: 'loja', count: lojaCount, total: lojaTotal }
    ];
  }, []);

  const getMainMetrics = useCallback((
    filteredDeliveries: Delivery[], 
    allDeliveries: Delivery[],
    currentMonth: string
  ) => {
    const totalDeliveries = filteredDeliveries.length;
    const totalRevenue = filteredDeliveries.reduce((sum, d) => sum + (d.value || 0), 0);
    const averageTicket = totalDeliveries > 0 ? totalRevenue / totalDeliveries : 0;
    
    const motoboyStats = getMotoboyStats(filteredDeliveries);
    const topMotoboy = motoboyStats.length > 0 ? motoboyStats[0] : null;
    
    const dayStats = getDayOfWeekStats(filteredDeliveries);
    const bestDay = dayStats.reduce((best, current) => 
      current.deliveries > best.deliveries ? current : best
    , dayStats[0] || { day: 'N/A', deliveries: 0, revenue: 0 });
    
    let variation = 0;
    if (filteredDeliveries.length > 0 && currentMonth !== 'all') {
      const firstItem = filteredDeliveries[0];
      const currentDate = formatDate(firstItem?.createdAt || firstItem?.updated_at || new Date());
      const previousMonth = new Date(currentDate);
      previousMonth.setMonth(previousMonth.getMonth() - 1);
      
      const previousMonthDeliveries = allDeliveries.filter(d => {
        const date = formatDate(d.createdAt || d.updated_at);
        return date.getMonth() === previousMonth.getMonth() && 
               date.getFullYear() === previousMonth.getFullYear();
      });
      
      if (previousMonthDeliveries.length > 0) {
        variation = ((filteredDeliveries.length - previousMonthDeliveries.length) / previousMonthDeliveries.length) * 100;
      } else {
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

  return {
    getFilteredDeliveries,
    getDailyEvolution,
    getMotoboyStats,
    getNeighborhoodStats,
    getPaymentStats,
    getDayOfWeekStats,
    getPeakHoursStats,
    getOriginStats, // <- O gráfico de canais vai usar isso agora!
    getMainMetrics,
    extractNeighborhood,
    formatDate
  };
}
