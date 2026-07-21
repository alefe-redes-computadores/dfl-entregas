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
        // 1. Inicializa o plugin do Capacitor com a sua chave Web
        // IMPORTANTE: Substitua o ID abaixo pelo Client ID da Web lá do painel do Firebase
        GoogleAuth.initialize({
          clientId: 'COLOQUE_SEU_CLIENT_ID_WEB_AQUI.apps.googleusercontent.com',
          scopes: ['profile', 'email'],
          grantOfflineAccess: true,
        });

        // 2. Abre a interface nativa do Android para o usuário escolher a conta
        const googleUser = await GoogleAuth.signIn();

        // 3. Pega o token seguro e loga no Firebase silenciosamente
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        await signInWithCredential(auth, credential);
      } else {
        // Mantém funcionando normalmente quando testar pelo navegador na Vercel
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
    set((state) => ({ deliveries: [delivery, ...state.deliveries] }));
    try {
      await setDoc(doc(db, 'deliveries', delivery.id), delivery);
    } catch (error) {
      console.error('Erro ao salvar entrega:', error);
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
