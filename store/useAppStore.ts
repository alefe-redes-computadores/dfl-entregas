import { create } from 'zustand';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Route, Delivery, Customer } from '@/types';

interface AppState {
  routes: Route[];
  deliveries: Delivery[];
  customers: Customer[];
  selectedDate: Date;
  isSyncing: boolean;
  initData: () => Promise<void>;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  getDeliveriesByRoute: (routeId: string) => Delivery[];
  getCustomerById: (customerId: string) => Customer | undefined;
  addRoute: (route: Route) => Promise<void>;
  addDelivery: (delivery: Delivery) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  routes: [],
  deliveries: [],
  customers: [],
  selectedDate: new Date(),
  isSyncing: false,

  initData: async () => {
    set({ isSyncing: true });
    try {
      const [routesSnap, deliveriesSnap, customersSnap] = await Promise.all([
        getDocs(collection(db, 'routes')),
        getDocs(collection(db, 'deliveries')),
        getDocs(collection(db, 'customers'))
      ]);

      set({
        routes: routesSnap.docs.map(d => d.data() as Route),
        deliveries: deliveriesSnap.docs.map(d => d.data() as Delivery),
        customers: customersSnap.docs.map(d => d.data() as Customer),
        isSyncing: false
      });
    } catch (error) {
      console.error('Erro ao buscar dados do Firebase:', error);
      set({ isSyncing: false });
    }
  },

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

  addRoute: async (route) => {
    set((state) => ({ routes: [route, ...state.routes] }));
    try {
      await setDoc(doc(db, 'routes', route.id), route);
    } catch (error) {
      console.error('Erro ao salvar rota no Firebase:', error);
    }
  },

  addDelivery: async (delivery) => {
    set((state) => ({ deliveries: [delivery, ...state.deliveries] }));
    try {
      await setDoc(doc(db, 'deliveries', delivery.id), delivery);
    } catch (error) {
      console.error('Erro ao salvar entrega no Firebase:', error);
    }
  },
}));
