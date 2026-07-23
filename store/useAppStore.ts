import { create } from 'zustand';
import { collection, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, signInWithCredential, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { db, auth, googleProvider } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import type { Route, Delivery, Customer } from '@/types';

interface AppState {
  user: FirebaseUser | null;
  authLoaded: boolean;
  routes: Route[];
  deliveries: Delivery[];
  customers: Customer[];
  selectedDate: Date;
  isSyncing: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  initData: () => Promise<void>;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  getDeliveriesByRoute: (routeId: string) => Delivery[];
  getCustomerById: (customerId: string) => Customer | undefined;
  addRoute: (route: Route) => Promise<void>;
  addDelivery: (delivery: Delivery) => Promise<void>;
  updateDelivery: (id: string, updatedData: Partial<Delivery>) => Promise<void>; // Adicionado para a Edição!
  closeRoute: (routeId: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authLoaded: false,
  routes: [],
  deliveries: [],
  customers: [],
  selectedDate: new Date(),
  isSyncing: false,

  loginWithGoogle: async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        GoogleAuth.initialize({
          clientId: '773967662232-pjodqa7f4c4drrhl80439amdp27u31ha.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });

        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        await signInWithCredential(auth, credential);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (error: any) {
      console.error('Erro no login com Google:', error);
      alert(`Erro no login: ${error?.message || 'Erro desconhecido'}`);
    }
  },

  logout: async () => {
    try {
      await signOut(auth);
      set({ routes: [], deliveries: [], customers: [], user: null });
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  },

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
    // Salva na tela instantaneamente
    set((state) => ({ deliveries: [delivery, ...state.deliveries] }));
    
    try {
      // FILTRO MÁGICO: Remove tudo que for "undefined" para o Firebase não surtar
      const safeDelivery = Object.fromEntries(
        Object.entries(delivery).filter(([_, v]) => v !== undefined)
      ) as Delivery;

      await setDoc(doc(db, 'deliveries', delivery.id), safeDelivery);
    } catch (error) {
      console.error('Erro ao salvar entrega na nuvem:', error);
    }
  },

  updateDelivery: async (id: string, updatedData: Partial<Delivery>) => {
    // Atualiza na tela instantaneamente
    set((state) => ({
      deliveries: state.deliveries.map((d) => 
        d.id === id ? { ...d, ...updatedData } : d
      )
    }));

    try {
      // FILTRO MÁGICO: Remove tudo que for "undefined"
      const safeUpdate = Object.fromEntries(
        Object.entries(updatedData).filter(([_, v]) => v !== undefined)
      );

      await updateDoc(doc(db, 'deliveries', id), safeUpdate);
    } catch (error) {
      console.error('Erro ao atualizar entrega na nuvem:', error);
    }
  },

  closeRoute: async (routeId) => {
    const endTime = new Date().toISOString();
    set((state) => ({
      routes: state.routes.map((r) =>
        r.id === routeId ? { ...r, status: 'fechada', end_time: endTime } : r
      ),
    }));
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
