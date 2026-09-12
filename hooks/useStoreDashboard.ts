// hooks/useStoreDashboard.ts
'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';
import {
  dateKey,
  deliveryDate,
  routeDate,
} from '@/lib/operational-time';
import type { Delivery, Route } from '@/types';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';

export interface StoreDashboardData {
  selectedDate: Date;
  selectedDateKey: string;
  setSelectedDateKey: (key: string) => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  formattedDateLabel: string;

  selectedDateOrders: Delivery[];
  selectedDateDeliveries: Delivery[];
  selectedDateRoutes: Route[];
  datesWithOperation: Set<string>;

  totalEntregas: number;
  completedDeliveries: number;
  pendingDeliveries: number;

  faturamentoTotal: number;
  receivedTotal: number;
  pendingTotal: number;
  ticketMedio: number;

  revenueByMethod: Record<string, number>;

  routesSummary: Array<{
    name: string;
    motoboy: string;
    status: Route['status'];
    deliveries: Delivery[];
  }>;
}

export function useStoreDashboard(): StoreDashboardData {
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);

  /*
   * Home, Loja e modais passam a compartilhar a MESMA data operacional.
   * Antes a Loja mantinha um useState próprio enquanto a Home usava Zustand.
   */
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const goToPreviousDay = useAppStore(
    (state) => state.goToPreviousDay,
  );
  const goToNextDay = useAppStore(
    (state) => state.goToNextDay,
  );

  const selectedDateKey = dateKey(selectedDate);

  const operation = useMemo(() => {
    const selectedDateOrders: Delivery[] = [];
    const selectedDateRoutes: Route[] = [];
    const datesWithOperation = new Set<string>();

    for (const route of routes) {
      const value = routeDate(route);

      if (value) {
        const key = dateKey(value);
        datesWithOperation.add(key);

        if (key === selectedDateKey) {
          selectedDateRoutes.push(route);
        }
      }
    }

    for (const delivery of deliveries) {
      const value = deliveryDate(delivery);

      if (value) {
        const key = dateKey(value);
        datesWithOperation.add(key);

        if (key === selectedDateKey) {
          selectedDateOrders.push(delivery);
        }
      }
    }

    const selectedRouteIds = new Set(
      selectedDateRoutes.map((route) => route.id),
    );

    /*
     * Mantém entregas vinculadas a uma rota do dia mesmo quando o registro
     * individual perdeu timestamp. Esse comportamento já existia.
     */
    const selectedDateDeliveries = deliveries.filter((delivery) => {
      if (!isDeliveryFulfillment(delivery)) return false;

      if (
        delivery.route_id &&
        selectedRouteIds.has(delivery.route_id)
      ) {
        return true;
      }

      const value = deliveryDate(delivery);

      return Boolean(
        value && dateKey(value) === selectedDateKey,
      );
    });

    let completedDeliveries = 0;
    let faturamentoTotal = 0;
    let receivedTotal = 0;

    const revenueByMethod: Record<string, number> = {};

    for (const delivery of selectedDateDeliveries) {
      if (delivery.completed) completedDeliveries += 1;
    }

    for (const order of selectedDateOrders) {
      const value = order.value || 0;

      faturamentoTotal += value;

      if (order.is_paid || order.completed) {
        receivedTotal += value;
      }

      const method = order.payment_method || 'dinheiro';
      revenueByMethod[method] =
        (revenueByMethod[method] || 0) + value;
    }

    const deliveriesByRoute = new Map<string, Delivery[]>();

    for (const delivery of selectedDateDeliveries) {
      if (!delivery.route_id) continue;

      const bucket =
        deliveriesByRoute.get(delivery.route_id) || [];

      bucket.push(delivery);
      deliveriesByRoute.set(delivery.route_id, bucket);
    }

    const routesSummary = selectedDateRoutes.map((route) => ({
      name: route.name,
      motoboy: route.motoboy_name,
      status: route.status,
      deliveries: deliveriesByRoute.get(route.id) || [],
    }));

    const totalEntregas = selectedDateDeliveries.length;
    const pendingDeliveries = Math.max(
      0,
      totalEntregas - completedDeliveries,
    );

    const pendingTotal = Math.max(
      0,
      faturamentoTotal - receivedTotal,
    );

    const ticketMedio = selectedDateOrders.length
      ? faturamentoTotal / selectedDateOrders.length
      : 0;

    return {
      selectedDateOrders,
      selectedDateRoutes,
      selectedDateDeliveries,
      datesWithOperation,
      totalEntregas,
      completedDeliveries,
      pendingDeliveries,
      faturamentoTotal,
      receivedTotal,
      pendingTotal,
      ticketMedio,
      revenueByMethod,
      routesSummary,
    };
  }, [deliveries, routes, selectedDateKey]);

  const formattedDateLabel =
    selectedDateKey === dateKey(new Date())
      ? 'Hoje'
      : selectedDate.toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

  return {
    selectedDate,
    selectedDateKey,

    setSelectedDateKey: (key) => {
      setSelectedDate(
        new Date(`${key}T12:00:00-03:00`),
      );
    },

    goToPreviousDay,
    goToNextDay,
    formattedDateLabel,

    ...operation,
  };
}
