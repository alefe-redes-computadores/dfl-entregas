import { create } from 'zustand';
import type { Route, Delivery, Customer } from '@/types';

interface AppState {
  routes: Route[];
  deliveries: Delivery[];
  customers: Customer[];
  selectedDate: Date;
  isSyncing: boolean;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  getDeliveriesByRoute: (routeId: string) => Delivery[];
  getCustomerById: (customerId: string) => Customer | undefined;
  addRoute: (route: Route) => void;
  addDelivery: (delivery: Delivery) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Começamos com arrays vazios para você cadastrar dados reais!
  routes: [],
  deliveries: [],
  customers: [],
  selectedDate: new Date(),
  isSyncing: true, // Bolinha verde pulsando simulando local-first

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

  getDeliveriesByRoute: (routeId) =>
    get().deliveries.filter((d) => d.route_id === routeId),

  getCustomerById: (customerId) =>
    get().customers.find((c) => c.id === customerId),

  addRoute: (route) =>
    set((state) => ({ routes: [route, ...state.routes] })),

  addDelivery: (delivery) =>
    set((state) => ({ deliveries: [delivery, ...state.deliveries] })),
}));
