import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch, deleteField } from 'firebase/firestore';
import { signInWithPopup, signOut, signInWithCredential, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { db, auth, googleProvider } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Route, Delivery, Customer, OrderOrigin, Motoboy, Fueling, DaySchedule, StorePause, HolidayOverride, IfoodPendingConfirmation } from '@/types';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import { dateKey, deliveryDate, routeStartedAt } from '@/lib/operational-time';
import { fuelingDate } from '@/lib/fueling-analytics';

interface AppState {
  user: FirebaseUser | null;
  authLoaded: boolean;
  hasHydrated: boolean;
  routes: Route[];
  deliveries: (Delivery & { is_expanded?: boolean })[];
  customers: Customer[];
  motoboys: Motoboy[];
  fuelings: Fueling[];
  ifoodPendingConfirmations: IfoodPendingConfirmation[];
  selectedDate: Date;
  isSyncing: boolean;
  syncError: boolean;
  isPrivacyMode: boolean; 
  routeAlertsEnabled: boolean;
  theme: 'dark' | 'light' | 'system';
  storeSettings: {
    isOpen: boolean;
    openingTime: string; // Legado
    closingTime: string; // Legado
    activeDays: number[]; // Legado
    alertsEnabled: boolean;
    storeAddress?: string;
    // 🔥 NOVOS CAMPOS DE EXPEDIENTE AVANÇADO
    schedule?: Record<number, DaySchedule>;
    pauses?: StorePause[];
    holidaysOverrides?: Record<string, HolidayOverride>;
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
  updateRoute: (routeId: string, data: Partial<Route>) => Promise<void>;
  startRoute: (routeId: string) => Promise<void>; 
  deleteRoute: (routeId: string) => Promise<void>;
  addDelivery: (delivery: Delivery) => Promise<void>;
  updateDelivery: (id: string, updatedData: Partial<Delivery>) => Promise<void>;
  deleteDelivery: (id: string) => Promise<void>;
  closeRoute: (routeId: string) => Promise<void>;
  reopenRoute: (routeId: string) => Promise<void>;
  reorderDelivery: (routeId: string, deliveryId: string, direction: 'up' | 'down') => Promise<void>;
  moveDeliveryToIndex: (routeId: string, deliveryId: string, targetIndex: number) => Promise<void>;
  setDeliveryOrder: (routeId: string, orderedPendingIds: string[]) => Promise<void>;
  toggleDeliveryExpansion: (id: string, isExpanded: boolean) => void;
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (id: string, updatedData: Partial<Customer>) => Promise<void>;
  addMotoboy: (motoboy: Motoboy) => Promise<void>;
  updateMotoboy: (id: string, updatedData: Partial<Motoboy>) => Promise<void>;
  deleteMotoboy: (id: string) => Promise<void>;
  addFueling: (fueling: Fueling) => Promise<void>;
  updateFueling: (id: string, updatedData: Partial<Fueling>) => Promise<void>;
  deleteFueling: (id: string) => Promise<void>;
  addIfoodPendingConfirmations: (items: IfoodPendingConfirmation[]) => Promise<void>;
  updateIfoodPendingConfirmation: (id: string, data: Partial<IfoodPendingConfirmation>) => Promise<void>;
  deleteIfoodPendingConfirmation: (id: string) => Promise<void>;
  findOrCreateCustomer: (name: string, details?: { address?: string; phone?: string; mapsLink?: string; confirmationCode?: string; observation?: string; origin?: OrderOrigin; }) => Promise<string>;
}

const sanitizeForFirebase = (obj: any) => {
  const sanitized = Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined));
  delete sanitized.is_expanded;
  return sanitized;
};

// Gerador do schedule padrão caso o usuário seja novo
const defaultSchedule = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map(day => [
    day, 
    { active: day !== 1, shifts: [{ start: '18:00', end: '23:59' }] }
  ])
);

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
      fuelings: [],
      ifoodPendingConfirmations: [],
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
        schedule: defaultSchedule,
        pauses: [],
        holidaysOverrides: {}
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
      togglePrivacyMode: () => set((state) => ({ isPrivacyMode: !state.isPrivacyMode })), 
      setRouteAlertsEnabled: (enabled) => set({ routeAlertsEnabled: enabled }), 
      setTheme: (theme) => set({ theme }),
      
      updateStoreSettings: async (settings) => {
        const currentSettings = get().storeSettings;
        const newSettings = { ...currentSettings, ...settings };
        
        set({ storeSettings: newSettings });

        try {
          const safeData = sanitizeForFirebase(newSettings);
          await setDoc(doc(db, 'store', 'store_settings'), safeData, { merge: true });
        } catch (error) {
          console.error('Erro ao salvar configurações:', error);
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
          alert(`Erro no login: ${error?.message || 'Erro desconhecido'}`);
        }
      },

      logout: async () => {
        try {
          await signOut(auth);
          set({ routes: [], deliveries: [], customers: [], motoboys: [], fuelings: [], user: null });
        } catch (error) { console.error('Erro no logout:', error); }
      },

      initData: async () => {
        if (!get().hasHydrated) return;
        set({ isSyncing: true, syncError: false }); 
        try {
          const [routesSnap, deliveriesSnap, customersSnap, motoboysSnap, fuelingsSnap, pendingConfirmationsSnap, storeSnap] = await Promise.all([
            getDocs(collection(db, 'routes')),
            getDocs(collection(db, 'deliveries')),
            getDocs(collection(db, 'customers')),
            getDocs(collection(db, 'motoboys')),
            getDocs(collection(db, 'fuelings')),
            getDocs(collection(db, 'ifood_pending_confirmations')),
            getDoc(doc(db, 'store', 'store_settings'))
          ]);

          const fbRoutes = routesSnap.docs.map(d => d.data() as Route);
          const fbDeliveries = deliveriesSnap.docs.map(d => d.data() as Delivery);
          const fbCustomers = customersSnap.docs.map(d => d.data() as Customer);
          const fbMotoboys = motoboysSnap.docs.map(d => d.data() as Motoboy);
          const fbFuelings = fuelingsSnap.docs.map(d => d.data() as Fueling);
          const fbPendingConfirmations = pendingConfirmationsSnap.docs.map(
            d => d.data() as IfoodPendingConfirmation,
          );
          
          const cloudStoreSettings = storeSnap.exists() ? storeSnap.data() : null;

          const mergedRoutes = [...fbRoutes];
          get().routes.forEach(local => {
            if (!mergedRoutes.some(m => m.id === local.id)) mergedRoutes.push(local);
          });

          let mergedDeliveries: (Delivery & { is_expanded?: boolean })[] = [...fbDeliveries].map(fbDel => {
            const localDel = get().deliveries.find(l => l.id === fbDel.id);
            return {
              ...fbDel,
              is_expanded: localDel ? localDel.is_expanded : false
            };
          });

          get().deliveries.forEach(local => {
            if (!mergedDeliveries.some(m => m.id === local.id)) mergedDeliveries.push(local);
          });
          
          mergedDeliveries.sort((a, b) => {
             const orderA = a.order_index !== undefined ? a.order_index : new Date(a.updated_at || 0).getTime();
             const orderB = b.order_index !== undefined ? b.order_index : new Date(b.updated_at || 0).getTime();
             return orderA - orderB;
          });

          const mergedCustomers = [...fbCustomers];
          get().customers.forEach(local => {
            if (!mergedCustomers.some(m => m.id === local.id)) mergedCustomers.push(local);
          });

          const mergedMotoboys = [...fbMotoboys];
          get().motoboys.forEach(local => {
            if (!mergedMotoboys.some(m => m.id === local.id)) mergedMotoboys.push(local);
          });

          const mergedFuelings = [...fbFuelings];
          get().fuelings.forEach(local => {
            if (!mergedFuelings.some(item => item.id === local.id)) mergedFuelings.push(local);
          });
          mergedFuelings.sort(
            (a, b) => fuelingDate(b).getTime() - fuelingDate(a).getTime(),
          );

          const mergedPendingConfirmations = [...fbPendingConfirmations];
          get().ifoodPendingConfirmations.forEach(local => {
            if (!mergedPendingConfirmations.some(item => item.id === local.id)) {
              mergedPendingConfirmations.push(local);
            }
          });
          mergedPendingConfirmations.sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );

          const defaultSettings = get().storeSettings;
          
          // Tratamento para puxar dados novos e velhos sem quebrar
          const finalStoreSettings = cloudStoreSettings 
            ? { 
                ...defaultSettings, 
                ...cloudStoreSettings,
                schedule: (cloudStoreSettings as any).schedule || defaultSettings.schedule,
                pauses: (cloudStoreSettings as any).pauses || defaultSettings.pauses,
                holidaysOverrides: (cloudStoreSettings as any).holidaysOverrides || defaultSettings.holidaysOverrides,
              }
            : defaultSettings;

          set({
            routes: mergedRoutes,
            deliveries: mergedDeliveries,
            customers: mergedCustomers,
            motoboys: mergedMotoboys,
            fuelings: mergedFuelings,
            ifoodPendingConfirmations: mergedPendingConfirmations,
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
          const selectedDateKey = dateKey(state.selectedDate);
          const validRouteIds = new Set(state.routes.map((route) => route.id));

          return state.deliveries.filter((delivery) => {
            if (!isDeliveryFulfillment(delivery)) return false;

            const value = deliveryDate(delivery);
            const isSelectedDate =
              Boolean(value) && dateKey(value) === selectedDateKey;
            const hasValidRoute = Boolean(
              delivery.route_id && validRouteIds.has(delivery.route_id),
            );

            return isSelectedDate && !hasValidRoute;
          });
        }
        return state.deliveries.filter((d) => d.route_id === routeId);
      },

      getCustomerById: (customerId) => customerId ? get().customers.find((c) => c.id === customerId) : undefined,

      addRoute: async (route) => {
        const now = new Date().toISOString();
        const routeWithTimestamp: Route = { ...route, created_at: route.created_at || now, updated_at: now };
        set((state) => ({ routes: [routeWithTimestamp, ...state.routes] }));
        try {
          const safeData = sanitizeForFirebase(routeWithTimestamp);
          await setDoc(doc(db, 'routes', route.id), safeData);
        } catch (error) {
          set((state) => ({ routes: state.routes.filter((r) => r.id !== route.id) }));
          console.error(error);
          throw error;
        }
      },

      updateRoute: async (routeId, data) => {
        const previousRoutes = get().routes;
        const now = new Date().toISOString();
        const nextData: Partial<Route> = { ...data, updated_at: now };
        set((state) => ({ routes: state.routes.map((route) => route.id === routeId ? { ...route, ...nextData } : route) }));
        try {
          await updateDoc(doc(db, 'routes', routeId), sanitizeForFirebase(nextData));
        } catch (error) {
          set({ routes: previousRoutes });
          console.error('Erro ao atualizar rota:', error);
          throw error;
        }
      },

      startRoute: async (routeId) => {
        const previousRoutes = get().routes;
        const current = previousRoutes.find((route) => route.id === routeId);
        if (!current) throw new Error('Rota não encontrada.');
        if (current.status === 'fechada') throw new Error('Reabra a rota antes de iniciá-la.');
        if (routeStartedAt(current)) return;
        const now = new Date().toISOString();
        set((state) => ({
          routes: state.routes.map((r) => r.id === routeId ? { ...r, started_at: now, updated_at: now } : r),
        }));
        try {
          await updateDoc(doc(db, 'routes', routeId), { started_at: now, departure_time: now, updated_at: now });
        } catch (error) {
          set({ routes: previousRoutes });
          console.error(error);
          throw error;
        }
      },

      deleteRoute: async (routeId) => {
        if (get().deliveries.some((delivery) => delivery.route_id === routeId)) {
          throw new Error('Não é possível excluir uma rota que possui entregas.');
        }
        const previousRoutes = get().routes;
        set((state) => ({ routes: state.routes.filter((r) => r.id !== routeId) }));
        try {
          await deleteDoc(doc(db, 'routes', routeId));
        } catch (error) {
          set({ routes: previousRoutes });
          console.error('Erro ao excluir rota:', error);
          throw error;
        }
      },

      addMotoboy: async (motoboy) => {
        const dataWithTimestamp: Motoboy = { ...motoboy, updated_at: new Date().toISOString() };
        set((state) => ({ motoboys: [...state.motoboys, dataWithTimestamp] }));
        try {
          const safeData = sanitizeForFirebase(dataWithTimestamp);
          await setDoc(doc(db, 'motoboys', motoboy.id), safeData);
        } catch (error) {
          set((state) => ({ motoboys: state.motoboys.filter((item) => item.id !== motoboy.id) }));
          console.error(error);
          throw error;
        }
      },

      updateMotoboy: async (id, updatedData) => {
        const previousMotoboys = get().motoboys;
        const dataWithTimestamp: Partial<Motoboy> = { ...updatedData, updated_at: new Date().toISOString() };
        set((state) => ({
          motoboys: state.motoboys.map((m) => m.id === id ? { ...m, ...dataWithTimestamp } as Motoboy : m)
        }));
        try {
          const safeData = sanitizeForFirebase(dataWithTimestamp);
          await updateDoc(doc(db, 'motoboys', id), safeData);
        } catch (error) {
          set({ motoboys: previousMotoboys });
          console.error(error);
          throw error;
        }
      },

      deleteMotoboy: async (id) => {
        if (get().routes.some((route) => route.motoboy_id === id)) {
          throw new Error('Não é possível excluir um motoboy que possui rotas. Desative o cadastro para preservar o histórico.');
        }
        const previousMotoboys = get().motoboys;
        set((state) => ({ motoboys: state.motoboys.filter((m) => m.id !== id) }));
        try {
          await deleteDoc(doc(db, 'motoboys', id));
        } catch (error) {
          set({ motoboys: previousMotoboys });
          console.error(error);
          throw error;
        }
      },

      addFueling: async (fueling) => {
        const now = new Date().toISOString();
        const dataWithTimestamp: Fueling = {
          ...fueling,
          occurred_at: fueling.occurred_at || now,
          created_at: fueling.created_at || now,
          updated_at: now,
        };
        set((state) => ({ fuelings: [dataWithTimestamp, ...state.fuelings] }));
        try {
          await setDoc(doc(db, 'fuelings', fueling.id), sanitizeForFirebase(dataWithTimestamp));
        } catch (error) {
          set((state) => ({ fuelings: state.fuelings.filter((item) => item.id !== fueling.id) }));
          console.error('Erro ao adicionar abastecimento:', error);
          throw error;
        }
      },

      updateFueling: async (id, updatedData) => {
        const previousFuelings = get().fuelings;
        const dataWithTimestamp: Partial<Fueling> = {
          ...updatedData,
          updated_at: new Date().toISOString(),
        };
        set((state) => ({
          fuelings: state.fuelings.map((item) =>
            item.id === id ? { ...item, ...dataWithTimestamp } as Fueling : item
          ),
        }));
        try {
          await updateDoc(doc(db, 'fuelings', id), sanitizeForFirebase(dataWithTimestamp));
        } catch (error) {
          set({ fuelings: previousFuelings });
          console.error('Erro ao atualizar abastecimento:', error);
          throw error;
        }
      },

      deleteFueling: async (id) => {
        const previousFuelings = get().fuelings;
        set((state) => ({ fuelings: state.fuelings.filter((item) => item.id !== id) }));
        try {
          await deleteDoc(doc(db, 'fuelings', id));
        } catch (error) {
          set({ fuelings: previousFuelings });
          console.error('Erro ao excluir abastecimento:', error);
          throw error;
        }
      },

      addDelivery: async (delivery) => {
        const now = new Date().toISOString();
        const deliveryWithTimestamp = { 
          ...delivery, 
          createdAt: delivery.createdAt || delivery.created_at || now,
          created_at: delivery.created_at || delivery.createdAt || now,
          updated_at: now 
        } as Delivery;
        
        set((state) => ({ deliveries: [deliveryWithTimestamp, ...state.deliveries] }));
        
        try {
          const safeData = sanitizeForFirebase(deliveryWithTimestamp);
          await setDoc(doc(db, 'deliveries', delivery.id), safeData);
        } catch (error) { 
          set((state) => ({ deliveries: state.deliveries.filter((item) => item.id !== delivery.id) }));
          console.error(error); 
          throw error;
        }
      },

      updateDelivery: async (id, updatedData) => {
        const state = get();
        const deliveryToUpdate = state.deliveries.find((d) => d.id === id);
        if (!deliveryToUpdate) throw new Error('Entrega não encontrada.');

        const now = new Date().toISOString();
        const isCompleting = updatedData.completed === true && deliveryToUpdate.completed !== true;
        const isReopening = updatedData.completed === false && deliveryToUpdate.completed === true;
        const dataWithTimestamp: Partial<Delivery> = {
          ...updatedData,
          ...(isCompleting ? { completed_at: now } : {}),
          updated_at: now,
        };
        const previousDeliveries = state.deliveries;
        const previousCustomers = state.customers;
        const customer = deliveryToUpdate.customer_id
          ? state.customers.find((item) => item.id === deliveryToUpdate.customer_id)
          : undefined;

        const nextDelivery = { ...deliveryToUpdate, ...dataWithTimestamp } as Delivery;
        if (isReopening) delete nextDelivery.completed_at;

        let updatedCustomerData: Partial<Customer> | undefined;
        if ((isCompleting || isReopening) && customer) {
          const completedForCustomer = state.deliveries
            .map((item) => item.id === id ? nextDelivery : item)
            .filter((item) => item.customer_id === customer.id && item.completed === true);
          updatedCustomerData = {
            orderCount: completedForCustomer.length,
            totalSpent: completedForCustomer.reduce((total, item) => total + (item.value || 0), 0),
            updated_at: now,
          };
        }
        if (customer && updatedData.confirmation_code) {
          updatedCustomerData = {
            ...updatedCustomerData,
            last_confirmation_code: updatedData.confirmation_code,
            updated_at: now,
          };
        }
        
        set((current) => ({
          deliveries: current.deliveries.map((d) => d.id === id ? nextDelivery : d),
          customers: updatedCustomerData && customer
            ? current.customers.map((item) => item.id === customer.id ? { ...item, ...updatedCustomerData } : item)
            : current.customers,
        }));
        
        let deliveryCommitCompleted = false;
        try {
          const batch = writeBatch(db);
          const safeData: Record<string, unknown> = sanitizeForFirebase(dataWithTimestamp);
          if (isReopening) safeData.completed_at = deleteField();
          batch.update(doc(db, 'deliveries', id), safeData);
          if (updatedCustomerData && customer) {
            batch.update(doc(db, 'customers', customer.id), sanitizeForFirebase(updatedCustomerData));
          }
          await batch.commit();
          deliveryCommitCompleted = true;

          if (updatedData.completed === true && deliveryToUpdate && isDeliveryFulfillment(deliveryToUpdate) && deliveryToUpdate.route_id) {
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
        } catch (error) {
          if (deliveryCommitCompleted) {
            set({ syncError: true });
            console.error('Entrega salva, mas não foi possível fechar a rota automaticamente:', error);
            return;
          }
          set({ deliveries: previousDeliveries, customers: previousCustomers, syncError: true });
          console.error(error);
          throw error;
        }
      },

      deleteDelivery: async (id) => {
        const previousDeliveries = get().deliveries;
        set((state) => ({ deliveries: state.deliveries.filter((d) => d.id !== id) }));
        try {
          await deleteDoc(doc(db, 'deliveries', id));
        } catch (error) {
          set({ deliveries: previousDeliveries });
          console.error(error);
          throw error;
        }
      },

      closeRoute: async (routeId) => {
        const previousRoutes = get().routes;
        const routeBeforeClose = previousRoutes.find((route) => route.id === routeId);
        if (!routeBeforeClose) throw new Error('Rota não encontrada.');
        if (routeBeforeClose.status === 'fechada') return;
        if (!routeStartedAt(routeBeforeClose)) throw new Error('Inicie a rota antes de finalizá-la.');
        if (get().deliveries.some((delivery) => delivery.route_id === routeId && !delivery.completed)) {
          throw new Error('Conclua todas as entregas antes de finalizar a rota.');
        }
        const endTime = new Date().toISOString();
        set((state) => ({
          routes: state.routes.map((r) => 
            // O segredo está aqui: r.end_time || endTime
            r.id === routeId ? { ...r, status: 'fechada', end_time: r.end_time || endTime, updated_at: endTime } : r
          ),
        }));
        try {
          const route = get().routes.find(r => r.id === routeId);
          const finalEndTime = route?.end_time || endTime;
          await updateDoc(doc(db, 'routes', routeId), { status: 'fechada', end_time: finalEndTime, updated_at: endTime });
        } catch (error) {
          set({ routes: previousRoutes });
          console.error(error);
          throw error;
        }
      },

      reopenRoute: async (routeId) => {
        const previousRoutes = get().routes;
        const current = previousRoutes.find((route) => route.id === routeId);
        if (!current) throw new Error('Rota não encontrada.');
        if (current.status !== 'fechada') return;

        const now = new Date().toISOString();

        // end_time é o primeiro encerramento operacional real da rota.
        // Reabrir serve para correções posteriores e não pode distorcer a duração histórica.
        set((state) => ({
          routes: state.routes.map((r) =>
            r.id === routeId
              ? { ...r, status: 'aberta', reopened_at: now, updated_at: now }
              : r
          ),
        }));

        try {
          await updateDoc(doc(db, 'routes', routeId), {
            status: 'aberta',
            reopened_at: now,
            updated_at: now,
          });
        } catch (error) {
          set({ routes: previousRoutes });
          console.error(error);
          throw error;
        }
      },

      reorderDelivery: async (routeId, deliveryId, direction) => {
        const state = get();

        const routeDeliveries = state.deliveries
          .filter((delivery) => delivery.route_id === routeId)
          .map((delivery) => ({ ...delivery }))
          .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;

            const aOrder = a.order_index;
            const bOrder = b.order_index;

            if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) {
              return aOrder - bOrder;
            }
            if (aOrder !== undefined && bOrder === undefined) return -1;
            if (aOrder === undefined && bOrder !== undefined) return 1;

            const timeA = new Date(a.created_at || a.createdAt || a.updated_at || 0).getTime();
            const timeB = new Date(b.created_at || b.createdAt || b.updated_at || 0).getTime();
            if (timeA !== timeB) return timeA - timeB;

            return a.id.localeCompare(b.id);
          });

        const pending = routeDeliveries.filter((delivery) => !delivery.completed);
        const completed = routeDeliveries.filter((delivery) => delivery.completed);

        const currentIndex = pending.findIndex((delivery) => delivery.id === deliveryId);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= pending.length) return;

        [pending[currentIndex], pending[targetIndex]] = [pending[targetIndex], pending[currentIndex]];

        const normalized = [...pending, ...completed].map((delivery, index) => ({
          ...delivery,
          order_index: index,
        }));

        const now = new Date().toISOString();
        const nextIndexById = new Map(
          normalized.map((delivery) => [delivery.id, delivery.order_index] as const)
        );

        set((prev) => ({
          deliveries: prev.deliveries.map((delivery) => {
            const nextIndex = nextIndexById.get(delivery.id);
            return nextIndex === undefined
              ? delivery
              : { ...delivery, order_index: nextIndex, updated_at: now };
          }),
        }));

        try {
          const batch = writeBatch(db);

          normalized.forEach((delivery) => {
            batch.update(doc(db, 'deliveries', delivery.id), {
              order_index: delivery.order_index,
              updated_at: now,
            });
          });

          await batch.commit();
        } catch (error) {
          set({ deliveries: state.deliveries });
          console.error('Erro ao salvar reordenação:', error);
          throw error;
        }
      },

      moveDeliveryToIndex: async (routeId, deliveryId, targetIndex) => {
        const state = get();

        const routeDeliveries = state.deliveries
          .filter((delivery) => delivery.route_id === routeId)
          .map((delivery) => ({ ...delivery }))
          .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;

            const aOrder = a.order_index;
            const bOrder = b.order_index;

            if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) {
              return aOrder - bOrder;
            }
            if (aOrder !== undefined && bOrder === undefined) return -1;
            if (aOrder === undefined && bOrder !== undefined) return 1;

            const timeA = new Date(a.created_at || a.createdAt || a.updated_at || 0).getTime();
            const timeB = new Date(b.created_at || b.createdAt || b.updated_at || 0).getTime();
            if (timeA !== timeB) return timeA - timeB;

            return a.id.localeCompare(b.id);
          });

        const pending = routeDeliveries.filter((delivery) => !delivery.completed);
        const completed = routeDeliveries.filter((delivery) => delivery.completed);
        const currentIndex = pending.findIndex((delivery) => delivery.id === deliveryId);

        if (currentIndex === -1 || pending.length < 2) return;

        const safeTarget = Math.max(0, Math.min(targetIndex, pending.length - 1));
        if (safeTarget === currentIndex) return;

        const [moved] = pending.splice(currentIndex, 1);
        pending.splice(safeTarget, 0, moved);

        const normalized = [...pending, ...completed].map((delivery, index) => ({
          ...delivery,
          order_index: index,
        }));

        const now = new Date().toISOString();
        const nextIndexById = new Map(
          normalized.map((delivery) => [delivery.id, delivery.order_index] as const)
        );

        set((prev) => ({
          deliveries: prev.deliveries.map((delivery) => {
            const nextIndex = nextIndexById.get(delivery.id);
            return nextIndex === undefined
              ? delivery
              : { ...delivery, order_index: nextIndex, updated_at: now };
          }),
        }));

        try {
          const batch = writeBatch(db);
          normalized.forEach((delivery) => {
            batch.update(doc(db, 'deliveries', delivery.id), {
              order_index: delivery.order_index,
              updated_at: now,
            });
          });
          await batch.commit();
        } catch (error) {
          set({ deliveries: state.deliveries });
          console.error('Erro ao mover entrega para posição:', error);
          throw error;
        }
      },

      setDeliveryOrder: async (routeId, orderedPendingIds) => {
        const state = get();
        const routeDeliveries = state.deliveries
          .filter((delivery) => delivery.route_id === routeId)
          .map((delivery) => ({ ...delivery }));

        const pending = routeDeliveries.filter((delivery) => !delivery.completed);
        const completed = routeDeliveries.filter((delivery) => delivery.completed);
        const pendingById = new Map(pending.map((delivery) => [delivery.id, delivery]));

        const uniqueIds = Array.from(new Set(orderedPendingIds));
        const validIds = uniqueIds.filter((id) => pendingById.has(id));
        const missingIds = pending.map((delivery) => delivery.id).filter((id) => !validIds.includes(id));
        const finalPendingIds = [...validIds, ...missingIds];

        if (finalPendingIds.length !== pending.length) {
          throw new Error('A ordem recebida não corresponde às entregas pendentes da rota.');
        }

        const orderedPending = finalPendingIds.map((id) => pendingById.get(id)!);
        const completedSorted = [...completed].sort((a, b) => {
          const aOrder = a.order_index ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.order_index ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.id.localeCompare(b.id);
        });

        const normalized = [...orderedPending, ...completedSorted].map((delivery, index) => ({
          ...delivery,
          order_index: index,
        }));

        const now = new Date().toISOString();
        const indexById = new Map(normalized.map((delivery) => [delivery.id, delivery.order_index] as const));

        set((prev) => ({
          deliveries: prev.deliveries.map((delivery) => {
            const nextIndex = indexById.get(delivery.id);
            return nextIndex === undefined ? delivery : { ...delivery, order_index: nextIndex, updated_at: now };
          }),
        }));

        try {
          const batch = writeBatch(db);
          normalized.forEach((delivery) => {
            batch.update(doc(db, 'deliveries', delivery.id), {
              order_index: delivery.order_index,
              updated_at: now,
            });
          });
          await batch.commit();
        } catch (error) {
          set({ deliveries: state.deliveries });
          console.error('Erro ao aplicar ordem da rota:', error);
          throw error;
        }
      },


      toggleDeliveryExpansion: (id, isExpanded) => {
        set((state) => ({
          deliveries: state.deliveries.map(d => d.id === id ? { ...d, is_expanded: isExpanded } : d)
        }));
      },

      addIfoodPendingConfirmations: async (items) => {
        if (!items.length) return;

        const previous = get().ifoodPendingConfirmations;
        set((state) => ({
          ifoodPendingConfirmations: [...items, ...state.ifoodPendingConfirmations],
        }));

        try {
          const batch = writeBatch(db);
          items.forEach((item) => {
            batch.set(
              doc(db, 'ifood_pending_confirmations', item.id),
              sanitizeForFirebase(item),
            );
          });
          await batch.commit();
        } catch (error) {
          set({ ifoodPendingConfirmations: previous });
          console.error(error);
          throw error;
        }
      },

      updateIfoodPendingConfirmation: async (id, data) => {
        const previous = get().ifoodPendingConfirmations;
        const updated = {
          ...data,
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          ifoodPendingConfirmations: state.ifoodPendingConfirmations.map((item) =>
            item.id === id ? { ...item, ...updated } : item,
          ),
        }));

        try {
          await updateDoc(
            doc(db, 'ifood_pending_confirmations', id),
            sanitizeForFirebase(updated),
          );
        } catch (error) {
          set({ ifoodPendingConfirmations: previous });
          console.error(error);
          throw error;
        }
      },

      deleteIfoodPendingConfirmation: async (id) => {
        const previous = get().ifoodPendingConfirmations;
        set((state) => ({
          ifoodPendingConfirmations: state.ifoodPendingConfirmations.filter(
            (item) => item.id !== id,
          ),
        }));

        try {
          await deleteDoc(doc(db, 'ifood_pending_confirmations', id));
        } catch (error) {
          set({ ifoodPendingConfirmations: previous });
          console.error(error);
          throw error;
        }
      },

      addCustomer: async (customer) => {
        const customerWithTimestamp: Customer = { ...customer, updated_at: new Date().toISOString() };
        set((state) => ({ customers: [customerWithTimestamp, ...state.customers] }));
        try {
          const safeData = sanitizeForFirebase(customerWithTimestamp);
          await setDoc(doc(db, 'customers', customer.id), safeData);
        } catch (error) {
          set((state) => ({ customers: state.customers.filter((item) => item.id !== customer.id) }));
          console.error(error);
          throw error;
        }
      },

      updateCustomer: async (id, updatedData) => {
        const previousCustomers = get().customers;
        const dataWithTimestamp: Partial<Customer> = { ...updatedData, updated_at: new Date().toISOString() };
        set((state) => ({
          customers: state.customers.map((c) => c.id === id ? { ...c, ...dataWithTimestamp } as Customer : c)
        }));
        try {
          const safeData = sanitizeForFirebase(dataWithTimestamp);
          await updateDoc(doc(db, 'customers', id), safeData);
        } catch (error) {
          set({ customers: previousCustomers });
          console.error(error);
          throw error;
        }
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
          if (details?.phone) updatedFields.phone = details.phone;

          set((state) => ({
            customers: state.customers.map((c) => c.id === existing.id ? { ...c, ...updatedFields } : c),
          }));

          try {
            const safeData = sanitizeForFirebase(updatedFields);
            await updateDoc(doc(db, 'customers', existing.id), safeData);
          } catch (error) {
            set((state) => ({
              customers: state.customers.map((item) => item.id === existing.id ? existing : item),
            }));
            console.error(error);
            throw error;
          }

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
          phone: details?.phone || undefined,
          createdAt: now,
          updated_at: now,
        };

        set((state) => ({ customers: [newCustomer, ...state.customers] }));

        try {
          const safeData = sanitizeForFirebase(newCustomer);
          await setDoc(doc(db, 'customers', newCustomer.id), safeData);
        } catch (error) {
          set((state) => ({ customers: state.customers.filter((item) => item.id !== newCustomer.id) }));
          console.error(error);
          throw error;
        }

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
        fuelings: state.fuelings,
        ifoodPendingConfirmations: state.ifoodPendingConfirmations,
        isPrivacyMode: state.isPrivacyMode,
        routeAlertsEnabled: state.routeAlertsEnabled,
        theme: state.theme,
        storeSettings: state.storeSettings
      }),
      onRehydrateStorage: () => (state) => { 
        state?.setHasHydrated(true); 
      },
    }
  )
);
