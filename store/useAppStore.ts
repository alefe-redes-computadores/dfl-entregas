import { create } from 'zustand';
import { collection, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
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
  closeRoute: (routeId: string) => Promise<void>;
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
      console.error('Erro ao sincronizar com Firebase:', error);
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
      console.error('Erro ao salvar rota:', error);
    }
  },

  addDelivery: async (delivery) => {
    set((state) => ({ deliveries: [delivery, ...state.deliveries] }));
    try {
      await setDoc(doc(db, 'deliveries', delivery.id), delivery);
    } catch (error) {
      console.error('Erro ao salvar entrega:', error);
    }
  },

  closeRoute: async (routeId) => {
    const endTime = new Date().toISOString();
    // Atualiza a tela primeiro (otimista)
    set((state) => ({
      routes: state.routes.map((r) =>
        r.id === routeId ? { ...r, status: 'fechada', end_time: endTime } : r
      ),
    }));
    // Envia a atualização para o Firebase
    try {
      await updateDoc(doc(db, 'routes', routeId), {
        status: 'fechada',
        end_time: endTime
      });
    } catch (error) {
      console.error('Erro ao fechar rota:', error);
    }
  }
}));
