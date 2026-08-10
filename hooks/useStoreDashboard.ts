'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useStoreDashboard() {
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const goToPreviousDay = () => setSelectedDate(prev => new Date(prev.setDate(prev.getDate() - 1)));
  const goToNextDay = () => setSelectedDate(prev => new Date(prev.setDate(prev.getDate() + 1)));

  const selectedDateDeliveries = useMemo(() => {
    const targetDateStr = new Date(selectedDate.getTime() - 3 * 3600000).toISOString().split('T')[0];
    return deliveries.filter(d => {
      const dTime = new Date((d as any).createdAt || d.updated_at).getTime();
      const brtDate = new Date(dTime - 3 * 3600000).toISOString().split('T')[0];
      return brtDate === targetDateStr;
    });
  }, [deliveries, selectedDate]);

  const totalEntregas = selectedDateDeliveries.length;
  const faturamentoTotal = selectedDateDeliveries.reduce((acc, d) => acc + (d.value || 0), 0);
  const ticketMedio = totalEntregas > 0 ? faturamentoTotal / totalEntregas : 0;

  const revenueByMethod = useMemo(() => {
    return selectedDateDeliveries.reduce((acc, d) => {
      const m = d.payment_method || 'dinheiro';
      acc[m] = (acc[m] || 0) + (d.value || 0);
      return acc;
    }, {} as Record<string, number>);
  }, [selectedDateDeliveries]);

  const routesSummary = useMemo(() => {
    const summary = new Map();
    selectedDateDeliveries.forEach(d => {
      if (!d.route_id) return;
      const route = routes.find(r => r.id === d.route_id);
      if (!route) return;
      if (!summary.has(route.id)) summary.set(route.id, { name: route.name, motoboy: route.motoboy_name, status: route.status, deliveries: [] });
      summary.get(route.id).deliveries.push(d);
    });
    return Array.from(summary.values());
  }, [selectedDateDeliveries, routes]);

  const formattedDateLabel = useMemo(() => {
    const todayStr = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];
    const targetStr = new Date(selectedDate.getTime() - 3 * 3600000).toISOString().split('T')[0];
    if (todayStr === targetStr) return 'Hoje';
    
    const d = new Date(selectedDate.getTime() - 3 * 3600000);
    return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
  }, [selectedDate]);

  return {
    selectedDate,
    goToPreviousDay,
    goToNextDay,
    formattedDateLabel,
    selectedDateDeliveries,
    totalEntregas,
    faturamentoTotal,
    ticketMedio,
    revenueByMethod,
    routesSummary
  };
}
