import { create } from 'zustand';
import type { Route, Delivery, Customer } from '@/types';
import { mockRoutes, mockDeliveries, mockCustomers } from '@/lib/mock-data';

interface AppState {
  // ---- Dados (local-first: hoje mockado, amanhã hidratado pelo Supabase) ----
  routes: Route[];
  deliveries: Delivery[];
  customers: Customer[];

  // ---- Status de sincronização (bolinha pulsante no header) ----
  isSyncing: boolean;
  lastSyncedAt: string | null;

  // ---- Filtro de data da Home ----
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;

  // ---- Seletores utilitários ----
  getDeliveriesByRoute: (routeId: string) => Delivery[];
  getCustomerById: (customerId: string) => Customer | undefined;

  // ---- Ações ----
  togglePaidStatus: (deliveryId: string) => void;
  triggerManualSync: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  routes: mockRoutes,
  deliveries: mockDeliveries,
  customers: mockCustomers,

  isSyncing: true,
  lastSyncedAt: new Date().toISOString(),

  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),
  goToPreviousDay: () =>
    set((state) => {
      const prev = new Date(state.selectedDate);
      prev.setDate(prev.getDate() - 1);
      return { selectedDate: prev };
    }),
  goToNextDay: () =>
    set((state) => {
      const next = new Date(state.selectedDate);
      next.setDate(next.getDate() + 1);
      return { selectedDate: next };
    }),
  goToToday: () => set({ selectedDate: new Date() }),

  getDeliveriesByRoute: (routeId) => {
    return get().deliveries.filter((d) => d.route_id === routeId);
  },

  getCustomerById: (customerId) => {
    return get().customers.find((c) => c.id === customerId);
  },

  togglePaidStatus: (deliveryId) =>
    set((state) => ({
      deliveries: state.deliveries.map((d) =>
        d.id === deliveryId ? { ...d, is_paid: !d.is_paid } : d
      ),
    })),

  triggerManualSync: () => {
    set({ isSyncing: true });
    // Placeholder: aqui entra a chamada real pro Supabase futuramente.
    setTimeout(() => {
      set({ isSyncing: true, lastSyncedAt: new Date().toISOString() });
    }, 800);
  },
}));
