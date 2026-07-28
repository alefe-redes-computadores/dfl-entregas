import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, signInWithCredential, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { db, auth, googleProvider } from '@/lib/firebase';
import { Capacitor } from '@core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import type { Route, Delivery, Customer, OrderOrigin, Motoboy } from '@/types';

interface AppState {
  user: FirebaseUser | null;
  authLoaded: boolean;
  hasHydrated: boolean;
  routes: Route[];
  deliveries: Delivery[];
  customers: Customer[];
  motoboys: Motoboy[];
  selectedDate: Date;
  isSyncing: boolean;
  syncError: boolean;
  isPrivacyMode: boolean; 
  routeAlertsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  storeSettings: {
    isOpen: boolean;
    openingTime: string;
    closingTime: string;
    activeDays: number[];
    alertsEnabled: boolean;
    storeAddress?: string;
  };
  setHasHydrated: (value: boolean) => void;
  togglePrivacyMode: () => void; 
  setRouteAlertsEnabled: (enabled: boolean) => void; 
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  updateStoreSettings: (settings: Partial<AppState['storeSettings']>) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  initData: () => Promise<void>;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  getDeliveriesByRoute: (routeId: string) => Delivery[];
  getCustomerById: (customerId?: string) => Customer | undefined;
  addRoute: (route: Route) => Promise<void>;
  startRoute: (routeId: string) => Promise<void>; 
  addDelivery: (delivery: Delivery) => Promise<void>;
  updateDelivery: (id: string, updatedData: Partial<Delivery>) => Promise<void>;
  deleteDelivery: (id: string) => Promise<void>;
  closeRoute: (routeId: string) => Promise<void>;
  reopenRoute: (routeId: string) => Promise<void>;
  reorderDelivery: (routeId: string, deliveryId: string, direction: 'up' | 'down') => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (id: string, updatedData: Partial<Customer>) => Promise<void>;
  addMotoboy: (motoboy: Motoboy) => Promise<void>;
  updateMotoboy: (id: string, updatedData: Partial<Motoboy>) => Promise<void>;
  deleteMotoboy: (id: string) => Promise<void>;
  findOrCreateCustomer: (
    name: string,
    details?: {
      address?: string;
      mapsLink?: string;
      confirmationCode?: string;
      observation?: string;
      origin?: OrderOrigin;
    }
  ) => Promise<string>;
}

const sanitizeForFirebase = (obj: any) => {
  return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      authLoaded: false,
      hasHydrated: false,
      routes: [],
      deliveries: [],
      customers: [],
      motoboys: [],
      selectedDate: new Date(),
      isSyncing: false,
      syncError: false,
      isPrivacyMode: false,
      routeAlertsEnabled: false,
      theme: 'system',
      storeSettings: {
        isOpen: false,
        openingTime: '18:00',
        closingTime: '23:59',
        activeDays: [1, 2, 3, 4, 5, 6, 0],
        alertsEnabled: false,
        storeAddress: 'Patos de Minas, MG',
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
      togglePrivacyMode: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })), 
      setRouteAlertsEnabled: (enabled) => set({ routeAlertsEnabled: enabled }), 
      setTheme: (theme) => set({ theme }),
      
      // Sincroniza as configurações da loja localmente e na nuvem (Firebase)
      updateStoreSettings: async (settings) => {
        const currentSettings = get().storeSettings;
        const newSettings = { ...currentSettings, ...settings };
        
        // SALVA LOCALMENTE NO ZUSTAND
        set({ storeSettings: newSettings });

        // SALVA NO FIREBASE (Backup/Nuvem)
        try {
          const safeData = sanitizeForFirebase(newSettings);
          // Usa 'store_settings' como ID do documento para evitar confusão com subcoleções
          await setDoc(doc(db, 'store', 'store_settings'), safeData, { merge: true });
        } catch (error) {
          console.error('Erro ao salvar configurações da loja na nuvem:', error);
        }
      },

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
          set({ routes: [], deliveries: [], customers: [], motoboys: [], user: null });
        } catch (error) {
          console.error('Erro no logout:', error);
        }
      },

      initData: async () => {
        if (!get().hasHydrated) return;
        set({ isSyncing: true, syncError: false }); 
        try {
          const [routesSnap, deliveriesSnap, customersSnap, motoboysSnap, storeSnap] = await Promise.all([
            getDocs(collection(db, 'routes')),
            getDocs(collection(db, 'deliveries')),
            getDocs(collection(db, 'customers')),
            getDocs(collection(db, 'motoboys')),
            getDoc(doc(db, 'store', 'store_settings')) // Busca do ID correto 'store_settings'
          ]);

          const fbRoutes = routesSnap.docs.map(d => d.data() as Route);
          const fbDeliveries = deliveriesSnap.docs.map(d => d.data() as Delivery);
          const fbCustomers = customersSnap.docs.map(d => d.data() as Customer);
          const fbMotoboys = motoboysSnap.docs.map(d => d.data() as Motoboy);
          
          const cloudStoreSettings = storeSnap.exists() ? storeSnap.data() : null;

          const mergedRoutes = [...fbRoutes];
          get().routes.forEach(local => {
            if (!mergedRoutes.some(m => m.id === local.id)) mergedRoutes.push(local);
          });

          let mergedDeliveries = [...fbDeliveries];
          get().deliveries.forEach(local => {
            if (!mergedDeliveries.some(m => m.id === local.id)) mergedDeliveries.push(local);
          });
          
          mergedDeliveries = mergedDeliveries.map(d => {
             if (!(d as any).createdAt) {
                const fixedDelivery = { ...d, createdAt: d.updated_at || new Date().toISOString() } as Delivery;
                const safeData = sanitizeForFirebase(fixedDelivery);
                setDoc(doc(db, 'deliveries', fixedDelivery.id), safeData).catch(() => {});
                return fixedDelivery;
             }
             return d;
          });

          const mergedCustomers = [...fbCustomers];
          get().customers.forEach(local => {
            if (!mergedCustomers.some(m => m.id === local.id)) mergedCustomers.push(local);
          });

          const mergedMotoboys = [...fbMotoboys];
          get().motoboys.forEach(local => {
            if (!mergedMotoboys.some(m => m.id === local.id)) mergedMotoboys.push(local);
          });

          // Se houver configurações na nuvem, mescla com o padrão local (Dando preferência para a Nuvem)
          const finalStoreSettings = cloudStoreSettings 
            ? { ...get().storeSettings, ...cloudStoreSettings }
            : get().storeSettings;

          set({
            routes: mergedRoutes,
            deliveries: mergedDeliveries,
            customers: mergedCustomers,
            motoboys: mergedMotoboys,
            storeSettings: finalStoreSettings as any,
            isSyncing: false,
            syncError: false
          });
        } catch (error) {
          console.error('Erro ao sincronizar:', error);
          set({ isSyncing: false, syncError: true }); 
        }
      },

      goToPreviousDay: () => set((state) => {
        const prev = new Date(state.selectedDate);
        prev.setDate(prev.getDate() - 1);
        return { selectedDate: prev };
      }),

      goToNextDay: () => set((state) => {
        const next = new Date(state.selectedDate);
        next.setDate(next.getDate() + 1);
        return { selectedDate: next };
      }),

      getDeliveriesByRoute: (routeId) => {
        const state = get();
        if (routeId === 'rota-resgate-recuperada') {
          const selectedDateStr = state.selectedDate.toDateString();
          return state.deliveries.filter(d => {
            const deliveryDateStr = new Date(d.updated_at || Date.now()).toDateString();
            return deliveryDateStr === selectedDateStr;
          });
        }
        return state.deliveries.filter((d) => d.route_id === routeId);
      },

      getCustomerById: (customerId) => customerId ? get().customers.find((c) => c.id === customerId) : undefined,

      addRoute: async (route) => {
        const routeWithTimestamp: Route = { ...route, updated_at: new Date().toISOString() };
        set((state) => ({ routes: [routeWithTimestamp, ...state.routes] }));
        try {
          const safeData = sanitizeForFirebase(routeWithTimestamp);
          await setDoc(doc(db, 'routes', route.id), safeData);
        } catch (error) { console.error(error); }
      },

      startRoute: async (routeId) => {
        const now = new Date().toISOString();
        set((state) => ({
          routes: state.routes.map((r) => r.id === routeId ? { ...r, started_at: now, updated_at: now } : r),
        }));
        try {
          await updateDoc(doc(db, 'routes', routeId), { started_at: now, updated_at: now });
        } catch (error) { console.error(error); }
      },

      addMotoboy: async (motoboy) => {
        const dataWithTimestamp: Motoboy = { ...motoboy, updated_at: new Date().toISOString() };
        set((state) => ({ motoboys: [...state.motoboys, dataWithTimestamp] }));
        try {
          const safeData = sanitizeForFirebase(dataWithTimestamp);
          await setDoc(doc(db, 'motoboys', motoboy.id), safeData);
        } catch (error) { console.error(error); }
      },

      updateMotoboy: async (id, updatedData) => {
        const dataWithTimestamp: Partial<Motoboy> = { ...updatedData, updated_at: new Date().toISOString() };
        set((state) => ({
          motoboys: state.motoboys.map((m) => m.id === id ? { ...m, ...dataWithTimestamp } as Motoboy : m)
        }));
        try {
          const safeData = sanitizeForFirebase(dataWithTimestamp);
          await updateDoc(doc(db, 'motoboys', id), safeData);
        } catch (error) { console.error(error); }
      },

      deleteMotoboy: async (id) => {
        set((state) => ({ motoboys: state.motoboys.filter((m) => m.id !== id) }));
        try {
          await deleteDoc(doc(db, 'motoboys', id));
        } catch (error) { console.error(error); }
      },

      addDelivery: async (delivery) => {
        const now = new Date().toISOString();
        const deliveryWithTimestamp = { 
          ...delivery, 
          createdAt: (delivery as any).createdAt || now,
          updated_at: now 
        } as Delivery;
        
        set((state) => ({ deliveries: [deliveryWithTimestamp, ...state.deliveries] }));
        
        try {
          const safeData = sanitizeForFirebase(deliveryWithTimestamp);
          await setDoc(doc(db, 'deliveries', delivery.id), safeData);
          
          // NOTA: O incremento do ranking foi removido daqui a pedido do desenvolvedor 
          // e movido para a função updateDelivery (quando a entrega é concluída).
        } catch (error) { 
          console.error(error); 
        }
      },

      updateDelivery: async (id, updatedData) => {
        const dataWithTimestamp: Partial<Delivery> = { ...updatedData, updated_at: new Date().toISOString() };
        
        const state = get();
        const deliveryToUpdate = state.deliveries.find((d) => d.id === id);
        
        set((state) => ({
          deliveries: state.deliveries.map((d) => d.id === id ? { ...d, ...dataWithTimestamp } as Delivery : d)
        }));
        
        try {
          const safeData = sanitizeForFirebase(dataWithTimestamp);
          await updateDoc(doc(db, 'deliveries', id), safeData);

          // 🔥 LÓGICA DO RANKING VIP NO FECHAMENTO DA ENTREGA
          if (updatedData.completed !== undefined && deliveryToUpdate?.customer_id) {
             const customer = state.customers.find(c => c.id === deliveryToUpdate.customer_id);
             
             if (customer) {
               let newCount = customer.orderCount || 0;
               let newSpent = customer.totalSpent || 0;
               const deliveryValue = deliveryToUpdate.value || 0;

               if (updatedData.completed === true) {
                 newCount += 1; // Soma pedido
                 newSpent += deliveryValue; // Soma valor
               } else if (updatedData.completed === false) {
                 newCount = Math.max(0, newCount - 1); // Remove pedido (Desfazer)
                 newSpent = Math.max(0, newSpent - deliveryValue); // Remove valor (Desfazer)
               }

               const updatedCustomerData = {
                 orderCount: newCount,
                 totalSpent: newSpent,
                 updated_at: new Date().toISOString()
               };

               set((prev) => ({
                 customers: prev.customers.map((c) => 
                   c.id === customer.id ? { ...c, ...updatedCustomerData } : c
                 )
               }));

               const safeCustomerData = sanitizeForFirebase(updatedCustomerData);
               await updateDoc(doc(db, 'customers', customer.id), safeCustomerData);
             }
          }

          // Lógica de fechamento automático da rota 
          if (updatedData.completed === true && deliveryToUpdate) {
            const currentState = get();
            const routeDeliveries = currentState.deliveries.filter(d => d.route_id === deliveryToUpdate.route_id);
            const allDone = routeDeliveries.length > 0 && routeDeliveries.every(d => d.completed);
            if (allDone) {
              const route = currentState.routes.find(r => r.id === deliveryToUpdate.route_id);
              if (route && route.status === 'aberta') {
                await currentState.closeRoute(route.id);
              }
            }
          }
        } catch (error) { console.error(error); }
      },

      deleteDelivery: async (id) => {
        set((state) => ({ deliveries: state.deliveries.filter((d) => d.id !== id) }));
        try {
          await deleteDoc(doc(db, 'deliveries', id));
        } catch (error) { console.error(error); }
      },

      closeRoute: async (routeId) => {
        const endTime = new Date().toISOString();
        set((state) => ({
          routes: state.routes.map((r) => r.id === routeId ? { ...r, status: 'fechada', end_time: endTime, updated_at: endTime } : r),
        }));
        try {
          await updateDoc(doc(db, 'routes', routeId), { status: 'fechada', end_time: endTime, updated_at: endTime });
        } catch (error) { console.error(error); }
      },

      reopenRoute: async (routeId) => {
        const now = new Date().toISOString();
        set((state) => ({
          routes: state.routes.map((r) => r.id === routeId ? { ...r, status: 'aberta', end_time: undefined, updated_at: now } : r),
        }));
        try {
          await updateDoc(doc(db, 'routes', routeId), { status: 'aberta', end_time: null, updated_at: now });
        } catch (error) { console.error(error); }
      },

      reorderDelivery: async (routeId, deliveryId, direction) => {
        const state = get();
        const routeDeliveries = state.deliveries
          .filter(d => d.route_id === routeId)
          .sort((a, b) => {
             const orderA = a.order_index !== undefined ? a.order_index : new Date(a.updated_at || 0).getTime();
             const orderB = b.order_index !== undefined ? b.order_index : new Date(b.updated_at || 0).getTime();
             return orderA - orderB;
          });

        routeDeliveries.forEach((d, i) => d.order_index = i);

        const currentIndex = routeDeliveries.findIndex(d => d.id === deliveryId);
        if (currentIndex === -1) return;
        if (direction === 'up' && currentIndex === 0) return;
        if (direction === 'down' && currentIndex === routeDeliveries.length - 1) return;

        const targetDelivery = routeDeliveries[currentIndex];
        const swapDelivery = routeDeliveries[direction === 'up' ? currentIndex - 1 : currentIndex + 1];

        const temp = targetDelivery.order_index;
        targetDelivery.order_index = swapDelivery.order_index;
        swapDelivery.order_index = temp;

        const now = new Date().toISOString();

        set((prev) => ({
          deliveries: prev.deliveries.map(d => {
            if (d.id === targetDelivery.id) return { ...d, order_index: targetDelivery.order_index, updated_at: now };
            if (d.id === swapDelivery.id) return { ...d, order_index: swapDelivery.order_index, updated_at: now };
            return d;
          })
        }));

        try {
          await updateDoc(doc(db, 'deliveries', targetDelivery.id), { order_index: targetDelivery.order_index, updated_at: now });
          await updateDoc(doc(db, 'deliveries', swapDelivery.id), { order_index: swapDelivery.order_index, updated_at: now });
        } catch (error) {
          console.error('Erro ao salvar reordenação:', error);
        }
      },

      addCustomer: async (customer) => {
        const customerWithTimestamp: Customer = { ...customer, updated_at: new Date().toISOString() };
        set((state) => ({ customers: [customerWithTimestamp, ...state.customers] }));
        try {
          const safeData = sanitizeForFirebase(customerWithTimestamp);
          await setDoc(doc(db, 'customers', customer.id), safeData);
        } catch (error) { console.error(error); }
      },

      updateCustomer: async (id, updatedData) => {
        const dataWithTimestamp: Partial<Customer> = { ...updatedData, updated_at: new Date().toISOString() };
        set((state) => ({
          customers: state.customers.map((c) => c.id === id ? { ...c, ...dataWithTimestamp } as Customer : c)
        }));
        try {
          const safeData = sanitizeForFirebase(dataWithTimestamp);
          await updateDoc(doc(db, 'customers', id), safeData);
        } catch (error) { console.error(error); }
      },

      findOrCreateCustomer: async (name, details) => {
        const trimmed = name.trim();
        if (!trimmed) return '';

        const extractNeighborhood = (address?: string): string | undefined => {
          if (!address) return undefined;
          if (address.includes('-')) {
            const parts = address.split('-');
            const potentialHood = parts[parts.length - 1].trim();
            return potentialHood.replace(/[0-9]/g, '').trim() || undefined;
          }
          const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
          if (parts.length < 2) return undefined;
          return parts[parts.length - 1].replace(/[0-9]/g, '').trim() || undefined;
        };

        const existing = get().customers.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
        const derivedNeighborhood = extractNeighborhood(details?.address);
        const now = new Date().toISOString();

        if (existing) {
          const updatedFields: Partial<Customer> = { updated_at: now };
          if (details?.address) updatedFields.address = details.address;
          if (details?.mapsLink) updatedFields.maps_link = details.mapsLink;
          if (details?.confirmationCode) updatedFields.last_confirmation_code = details.confirmationCode;
          if (details?.observation) updatedFields.observation = details.observation;
          if (derivedNeighborhood) updatedFields.neighborhood = derivedNeighborhood;
          if (details?.origin) updatedFields.origin = details.origin;

          set((state) => ({
            customers: state.customers.map((c) => c.id === existing.id ? { ...c, ...updatedFields } : c),
          }));

          try {
            const safeData = sanitizeForFirebase(updatedFields);
            await updateDoc(doc(db, 'customers', existing.id), safeData);
          } catch (error) { console.error(error); }

          return existing.id;
        }

        const newCustomer: Customer = {
          id: Date.now().toString(),
          name: trimmed,
          origin: details?.origin || 'loja',
          neighborhood: derivedNeighborhood,
          address: details?.address || undefined,
          maps_link: details?.mapsLink || undefined,
          last_confirmation_code: details?.confirmationCode || undefined,
          observation: details?.observation || undefined,
          createdAt: now,
          updated_at: now,
        };

        set((state) => ({ customers: [newCustomer, ...state.customers] }));

        try {
          const safeData = sanitizeForFirebase(newCustomer);
          await setDoc(doc(db, 'customers', newCustomer.id), safeData);
        } catch (error) { console.error(error); }

        return newCustomer.id;
      },
    }),
    {
      name: 'dfl-entregas-cofre-offline',
      partialize: (state) => ({ 
        routes: state.routes, 
        deliveries: state.deliveries, 
        customers: state.customers,
        motoboys: state.motoboys,
        isPrivacyMode: state.isPrivacyMode,
        routeAlertsEnabled: state.routeAlertsEnabled,
        theme: state.theme,
        storeSettings: state.storeSettings
      }),
      onRehydrateStorage: () => (state) => { 
        state?.setHasHydrated(true); 
        setTimeout(() => {
          if (state && state.deliveries) {
             const rescuedDeliveries = state.deliveries.map(d => (!(d as any).createdAt ? { ...d, createdAt: d.updated_at || new Date().toISOString() } as Delivery : d));
             useAppStore.setState({ deliveries: rescuedDeliveries });
          }
          state?.initData();
        }, 300);
      },
    }
  )
);
