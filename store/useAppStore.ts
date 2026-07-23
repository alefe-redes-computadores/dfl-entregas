import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  updateDelivery: (id: string, updatedData: Partial<Delivery>) => Promise<void>;
  closeRoute: (routeId: string) => Promise<void>;
}

// O (persist) envolve a loja toda para criar o "Cofre Físico" no celular
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
          console.error('Erro no login:', error);
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
          // 1. Busca o que tem na nuvem
          const [routesSnap, deliveriesSnap, customersSnap] = await Promise.all([
            getDocs(collection(db, 'routes')),
            getDocs(collection(db, 'deliveries')),
            getDocs(collection(db, 'customers'))
          ]);

          const fbRoutes = routesSnap.docs.map(d => d.data() as Route);
          const fbDeliveries = deliveriesSnap.docs.map(d => d.data() as Delivery);
          const fbCustomers = customersSnap.docs.map(d => d.data() as Customer);

          set((state) => {
            // 2. A MÁGICA DA SINCRONIZAÇÃO: Mescla os dados da Nuvem com os dados Físicos do Celular
            // Se o Firebase apagou ou rejeitou, o celular restaura as entregas pendentes
            
            const mergedDeliveries = [...fbDeliveries];
            state.deliveries.forEach(localDelivery => {
              // Se a entrega local não existir no Firebase, adiciona ela de volta e tenta reenviar silenciosamente
              if (!mergedDeliveries.find(fbD => fbD.id === localDelivery.id)) {
                mergedDeliveries.push(localDelivery);
                
                // Tenta reenviar pra nuvem para reparar o erro anterior
                const safeDelivery = Object.fromEntries(
                  Object.entries(localDelivery).filter(([_, v]) => v !== undefined)
                ) as Delivery;
                setDoc(doc(db, 'deliveries', localDelivery.id), safeDelivery).catch(console.error);
              }
            });

            const mergedRoutes = [...fbRoutes];
            state.routes.forEach(localRoute => {
              if (!mergedRoutes.find(fbR => fbR.id === localRoute.id)) {
                mergedRoutes.push(localRoute);
                setDoc(doc(db, 'routes', localRoute.id), localRoute).catch(console.error);
              }
            });

            return {
              routes: mergedRoutes,
              deliveries: mergedDeliveries,
              customers: fbCustomers,
              isSyncing: false
            };
          });

        } catch (error) {
          console.error('Erro ao sincronizar, mantendo dados offline:', error);
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
        // Salva fisicamente no celular na mesma hora
        set((state) => ({ routes: [route, ...state.routes] }));
        try {
          await setDoc(doc(db, 'routes', route.id), route);
        } catch (error) {
          console.error('Erro ao salvar rota, mas tá seguro no celular:', error);
        }
      },

      addDelivery: async (delivery) => {
        // Salva fisicamente no celular ANTES de falar com a nuvem
        set((state) => ({ deliveries: [delivery, ...state.deliveries] }));
        
        try {
          // Filtro que impede o Firebase de recusar o envio
          const safeDelivery = Object.fromEntries(
            Object.entries(delivery).filter(([_, v]) => v !== undefined)
          ) as Delivery;

          await setDoc(doc(db, 'deliveries', delivery.id), safeDelivery);
        } catch (error) {
          console.error('Falha no Firebase, mas a entrega está segura offline:', error);
        }
      },

      updateDelivery: async (id: string, updatedData: Partial<Delivery>) => {
        set((state) => ({
          deliveries: state.deliveries.map((d) => 
            d.id === id ? { ...d, ...updatedData } : d
          )
        }));

        try {
          const safeUpdate = Object.fromEntries(
            Object.entries(updatedData).filter(([_, v]) => v !== undefined)
          );
          await updateDoc(doc(db, 'deliveries', id), safeUpdate);
        } catch (error) {
          console.error('Erro no update Firebase, salvo apenas no celular:', error);
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
          console.error('Erro no Firebase, rota fechada apenas no celular:', error);
        }
      }
    }),
    {
      name: 'dfl-entregas-cofre-offline', // Nome do banco de dados no celular
      partialize: (state) => ({ 
        routes: state.routes, 
        deliveries: state.deliveries, 
        customers: state.customers 
      }), // Garante que as entregas fiquem grudadas na memória
    }
  )
);
