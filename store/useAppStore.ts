import { create } from 'zustand';
import { toast } from 'sonner';
import { persist } from 'zustand/middleware';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch, deleteField, runTransaction } from 'firebase/firestore';
import { signInWithPopup, signOut, signInWithCredential, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { db, auth, googleProvider } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import {
  cancelStockSupplyCheckReminder,
  DEFAULT_NOTIFICATION_PREFERENCES,
  notifyIfoodRoutePending,
  notifyRouteFinished,
  notifyStockThresholdChanges,
  notifySyncFailure,
  scheduleStockSupplyCheckReminder,
  type NotificationPreferences,
} from '@/lib/native/notifications';
import type { Route, Delivery, Customer, OrderOrigin, Motoboy, Fueling, StockSupply, StockSupplier, TeamMember, StockProduct, StockMovement, DaySchedule, StorePause, HolidayOverride, IfoodPendingConfirmation, OperationalExpense } from '@/types';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import { dateKey, deliveryDate, routeDate, routeStartedAt } from '@/lib/operational-time';
import { fuelingDate } from '@/lib/fueling-analytics';
import { INITIAL_STOCK_PRODUCTS, INITIAL_STOCK_SUPPLIERS, STOCK_CATALOG_VERSION } from '@/lib/stock-catalog';
import {
  extractCustomerNeighborhood,
  findExistingCustomer,
  nextCustomerName,
} from '@/lib/customer-identity';

interface AppState {
  user: FirebaseUser | null;
  authLoaded: boolean;
  hasHydrated: boolean;
  routes: Route[];
  deliveries: (Delivery & { is_expanded?: boolean })[];
  customers: Customer[];
  motoboys: Motoboy[];
  fuelings: Fueling[];
  stockSupplies: StockSupply[];
  stockSuppliers: StockSupplier[];
  teamMembers: TeamMember[];
  stockProducts: StockProduct[];
  stockMovements: StockMovement[];
  ifoodPendingConfirmations: IfoodPendingConfirmation[];
  operationalExpenses: OperationalExpense[];
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
    storeLatitude?: number;
    storeLongitude?: number;
    storeMapsLink?: string;
    routeReminderEnabled?: boolean;
    autoCloseCompletedRoutes?: boolean;
    notificationPreferences?: NotificationPreferences;
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
  setSelectedDate: (date: Date) => void;
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
  mergeCustomers: (sourceId: string, targetId: string) => Promise<{ deliveriesMoved: number }>;
  addMotoboy: (motoboy: Motoboy) => Promise<void>;
  updateMotoboy: (id: string, updatedData: Partial<Motoboy>) => Promise<void>;
  deleteMotoboy: (id: string) => Promise<void>;
  addFueling: (fueling: Fueling) => Promise<void>;
  updateFueling: (id: string, updatedData: Partial<Fueling>) => Promise<void>;
  deleteFueling: (id: string) => Promise<void>;
  addStockSupply: (supply: StockSupply) => Promise<void>;
  updateStockSupply: (id: string, updatedData: Partial<StockSupply>) => Promise<void>;
  deleteStockSupply: (id: string) => Promise<void>;
  addStockSupplier: (supplier: StockSupplier) => Promise<void>;
  updateStockSupplier: (id: string, data: Partial<StockSupplier>) => Promise<void>;
  seedStockCatalog: () => Promise<{ products: number; suppliers: number }>;
  addTeamMember: (member: TeamMember) => Promise<void>;
  updateTeamMember: (id: string, data: Partial<TeamMember>) => Promise<void>;
  addStockProduct: (product: StockProduct) => Promise<void>;
  updateStockProduct: (id: string, data: Partial<StockProduct>) => Promise<void>;
  addStockMovement: (movement: Omit<StockMovement, 'balance_before' | 'balance_after' | 'created_at'>) => Promise<void>;
  integrateStockSupply: (id: string) => Promise<void>;
  reverseStockSupply: (id: string) => Promise<void>;
  countStockProducts: (counts: Array<{ product_id: string; quantity: number }>, responsible?: { id?: string; name?: string }) => Promise<void>;
  addOperationalExpense: (expense: OperationalExpense) => Promise<void>;
  deleteOperationalExpense: (id: string) => Promise<void>;
  addIfoodPendingConfirmations: (items: IfoodPendingConfirmation[]) => Promise<void>;
  updateIfoodPendingConfirmation: (id: string, data: Partial<IfoodPendingConfirmation>) => Promise<void>;
  deleteIfoodPendingConfirmation: (id: string) => Promise<void>;
  findOrCreateCustomer: (name: string, details?: { address?: string; phone?: string; mapsLink?: string; confirmationCode?: string; observation?: string; origin?: OrderOrigin; }) => Promise<string>;
}

const sanitizeForFirebase = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirebase(item))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);

    // Preserva Timestamp, FieldValue/deleteField e outras instâncias especiais
    // do Firebase em vez de desmontá-las como objetos comuns.
    if (proto !== Object.prototype && proto !== null) return value;

    const sanitized = Object.fromEntries(
      Object.entries(value)
        .filter(([key, item]) => key !== 'is_expanded' && item !== undefined)
        .map(([key, item]) => [key, sanitizeForFirebase(item)])
        .filter(([, item]) => item !== undefined),
    );

    return sanitized;
  }

  return value;
};

// Gerador do schedule padrão caso o usuário seja novo
const defaultSchedule = Object.fromEntries(
  [0, 1, 2, 3, 4, 5, 6].map(day => [
    day,
    { active: day !== 1, shifts: [{ start: '18:00', end: '23:59' }] }
  ])
);

/**
 * Compras usam atualização otimista no Zustand.
 *
 * Guardamos a Promise de persistência por compra para impedir uma corrida:
 * o usuário pode sair da tela imediatamente após salvar, mas uma eventual
 * integração/estorno sempre espera a gravação anterior chegar ao Firestore.
 */
const pendingStockSupplyWrites = new Map<string, Promise<void>>();

const trackStockSupplyWrite = (
  id: string,
  operation: Promise<void>,
): Promise<void> => {
  const tracked = operation.finally(() => {
    if (pendingStockSupplyWrites.get(id) === tracked) {
      pendingStockSupplyWrites.delete(id);
    }
  });

  pendingStockSupplyWrites.set(id, tracked);
  return tracked;
};

const waitForStockSupplyWrite = async (id: string) => {
  const pending = pendingStockSupplyWrites.get(id);

  if (pending) {
    await pending;
  }
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
      fuelings: [],
      stockSupplies: [],
      stockSuppliers: [],
      teamMembers: [],
      stockProducts: [],
      stockMovements: [],
      ifoodPendingConfirmations: [],
      operationalExpenses: [],
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
        holidaysOverrides: {},
        routeReminderEnabled: true,
        autoCloseCompletedRoutes: true,
        notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
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
          toast.error('Erro no login', { description: error?.message || 'Erro desconhecido' });
        }
      },

      logout: async () => {
        try {
          await signOut(auth);
          set({ routes: [], deliveries: [], customers: [], motoboys: [], fuelings: [], stockSupplies: [], stockSuppliers: [], teamMembers: [], stockProducts: [], stockMovements: [], user: null });
        } catch (error) { console.error('Erro no logout:', error); }
      },

      initData: async () => {
        if (!get().hasHydrated) return;

        // Header/AuthGuard ou duas montagens React não podem iniciar
        // duas tomografias completas do Firestore ao mesmo tempo.
        if (get().isSyncing) return;

        set({ isSyncing: true, syncError: false });
        try {
          const [routesSnap, deliveriesSnap, customersSnap, motoboysSnap, fuelingsSnap, stockSuppliesSnap, stockSuppliersSnap, teamMembersSnap, stockProductsSnap, stockMovementsSnap, pendingConfirmationsSnap, operationalExpensesSnap, storeSnap] = await Promise.all([
            getDocs(collection(db, 'routes')),
            getDocs(collection(db, 'deliveries')),
            getDocs(collection(db, 'customers')),
            getDocs(collection(db, 'motoboys')),
            getDocs(collection(db, 'fuelings')),
            getDocs(collection(db, 'stock_supplies')),
            getDocs(collection(db, 'stock_suppliers')),
            getDocs(collection(db, 'team_members')),
            getDocs(collection(db, 'stock_products')),
            getDocs(collection(db, 'stock_movements')),
            getDocs(collection(db, 'ifood_pending_confirmations')),
            getDocs(collection(db, 'operational_expenses')),
            getDoc(doc(db, 'store', 'store_settings'))
          ]);

          const fbRoutes = routesSnap.docs.map(d => d.data() as Route);
          const fbDeliveries = deliveriesSnap.docs.map(d => d.data() as Delivery);
          const fbCustomers = customersSnap.docs.map(d => d.data() as Customer);
          const fbMotoboys = motoboysSnap.docs.map(d => d.data() as Motoboy);
          const fbFuelings = fuelingsSnap.docs.map(d => d.data() as Fueling);
          const fbStockSupplies = stockSuppliesSnap.docs.map(d => d.data() as StockSupply);
          const fbStockSuppliers = stockSuppliersSnap.docs.map(d => d.data() as StockSupplier);
          const fbTeamMembers = teamMembersSnap.docs.map(d => d.data() as TeamMember);
          const fbStockProducts = stockProductsSnap.docs.map(d => d.data() as StockProduct);
          const fbStockMovements = stockMovementsSnap.docs.map(d => d.data() as StockMovement);
          const fbOperationalExpenses = operationalExpensesSnap.docs.map(d => d.data() as OperationalExpense);
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

          const mergedStockSupplies = [...fbStockSupplies];
          get().stockSupplies.forEach(local => {
            if (!mergedStockSupplies.some(item => item.id === local.id)) mergedStockSupplies.push(local);
          });
          mergedStockSupplies.sort(
            (a, b) => new Date(b.occurred_at || b.created_at).getTime() - new Date(a.occurred_at || a.created_at).getTime(),
          );

          const mergeById = <T extends { id: string }>(cloud: T[], local: T[]) => {
            const merged = [...cloud];
            local.forEach((item) => { if (!merged.some((current) => current.id === item.id)) merged.push(item); });
            return merged;
          };
          const mergedTeamMembers = mergeById(fbTeamMembers, get().teamMembers).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
          const mergedStockSuppliers = mergeById(fbStockSuppliers, get().stockSuppliers).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
          const mergedStockProducts = mergeById(fbStockProducts, get().stockProducts).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
          const mergedStockMovements = mergeById(fbStockMovements, get().stockMovements).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

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
                notificationPreferences: {
                  ...DEFAULT_NOTIFICATION_PREFERENCES,
                  ...((cloudStoreSettings as any).notificationPreferences || {}),
                },
              }
            : defaultSettings;

          set({
            routes: mergedRoutes,
            deliveries: mergedDeliveries,
            customers: mergedCustomers,
            motoboys: mergedMotoboys,
            fuelings: mergedFuelings,
            stockSupplies: mergedStockSupplies,
            stockSuppliers: mergedStockSuppliers,
            teamMembers: mergedTeamMembers,
            stockProducts: mergedStockProducts,
            stockMovements: mergedStockMovements,
            ifoodPendingConfirmations: mergedPendingConfirmations,
            operationalExpenses: mergeById(fbOperationalExpenses, get().operationalExpenses)
              .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()),
            storeSettings: finalStoreSettings as any,
            isSyncing: false,
            syncError: false
          });
        } catch (error) {
          console.error('Erro ao sincronizar:', error);
          set({ isSyncing: false, syncError: true });
          void notifySyncFailure(
            get().storeSettings.notificationPreferences,
          );
        }
      },

      setSelectedDate: (date) => set({ selectedDate: new Date(date) }),

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
        if (!get().deliveries.some((delivery) => delivery.route_id === routeId)) {
          throw new Error('Adicione pelo menos uma entrega antes de iniciar a rota.');
        }
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
        const routeToDelete = get().routes.find((route) => route.id === routeId);
        if (!routeToDelete) throw new Error('Rota não encontrada.');
        if (routeToDelete.status === 'fechada' || routeStartedAt(routeToDelete)) {
          throw new Error(
            'Rotas iniciadas ou finalizadas fazem parte do histórico e não podem ser excluídas.',
          );
        }
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
          console.error('Erro ao adicionar compra de estoque:', error);
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
          console.error('Erro ao atualizar compra de estoque:', error);
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
          console.error('Erro ao excluir compra de estoque:', error);
          throw error;
        }
      },

      addStockSupply: async (supply) => {
        const now = new Date().toISOString();
        const next: StockSupply = {
          ...supply,
          created_at: supply.created_at || now,
          updated_at: now,
        };

        set((state) => ({
          stockSupplies: [next, ...state.stockSupplies],
        }));

        const operation = setDoc(
          doc(db, 'stock_supplies', next.id),
          sanitizeForFirebase(next),
        ).catch((error) => {
          set((state) => ({
            stockSupplies: state.stockSupplies.filter(
              (item) => item.id !== next.id,
            ),
          }));
          throw error;
        });

        await trackStockSupplyWrite(next.id, operation);
      },

      updateStockSupply: async (id, updatedData) => {
        const current = get().stockSupplies.find((item) => item.id === id);

        if (!current) {
          throw new Error('Compra não encontrada.');
        }

        if (current.stock_integrated_at) {
          throw new Error(
            'Compra já integrada ao estoque. Estorne a integração antes de alterar itens ou valores.',
          );
        }

        const next: Partial<StockSupply> = {
          ...updatedData,
          updated_at: new Date().toISOString(),
        };

        set((state) => ({
          stockSupplies: state.stockSupplies.map((item) =>
            item.id === id ? { ...item, ...next } : item,
          ),
        }));

        const operation = updateDoc(
          doc(db, 'stock_supplies', id),
          sanitizeForFirebase(next),
        )
          .then(() => {
            if (
              updatedData.status === 'recebido' &&
              current.status !== 'recebido'
            ) {
              void scheduleStockSupplyCheckReminder(
                id,
                updatedData.supplier || current.supplier,
                updatedData.items?.length || current.items?.length,
                get().storeSettings.notificationPreferences,
              );
            } else if (updatedData.status === 'conferido') {
              void cancelStockSupplyCheckReminder(id);
            }
          })
          .catch((error) => {
            // Rollback localizado: não desfaz outra compra que tenha sido
            // modificada enquanto esta gravação estava em andamento.
            set((state) => ({
              stockSupplies: state.stockSupplies.map((item) =>
                item.id === id ? current : item,
              ),
            }));
            throw error;
          });

        await trackStockSupplyWrite(id, operation);
      },

      deleteStockSupply: async (id) => {
        const current = get().stockSupplies.find((item) => item.id === id);
        if (current?.stock_integrated_at) throw new Error('Compra já integrada ao estoque e não pode ser excluída.');
        const previous = get().stockSupplies;
        set((state) => ({ stockSupplies: state.stockSupplies.filter((item) => item.id !== id) }));
        try {
          await deleteDoc(doc(db, 'stock_supplies', id));
        } catch (error) {
          set({ stockSupplies: previous });
          throw error;
        }
      },

      addStockSupplier: async (supplier) => {
        const previous = get().stockSuppliers;
        set({ stockSuppliers: [...previous, supplier].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) });
        try { await setDoc(doc(db, 'stock_suppliers', supplier.id), sanitizeForFirebase(supplier)); }
        catch (error) { set({ stockSuppliers: previous }); throw error; }
      },

      updateStockSupplier: async (id, data) => {
        const previous = get().stockSuppliers;
        const next = { ...data, updated_at: new Date().toISOString() };
        set({ stockSuppliers: previous.map((item) => item.id === id ? { ...item, ...next } : item) });
        try { await updateDoc(doc(db, 'stock_suppliers', id), sanitizeForFirebase(next)); }
        catch (error) { set({ stockSuppliers: previous }); throw error; }
      },

      seedStockCatalog: async () => {
        const markerRef = doc(db, 'store', 'stock_catalog');
        const result = await runTransaction(db, async (transaction) => {
          const productRefs = INITIAL_STOCK_PRODUCTS.map((item) => doc(db, 'stock_products', item.id));
          const supplierRefs = INITIAL_STOCK_SUPPLIERS.map((item) => doc(db, 'stock_suppliers', item.id));
          const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
          const supplierSnaps = await Promise.all(supplierRefs.map((ref) => transaction.get(ref)));
          let products = 0; let suppliers = 0;
          productSnaps.forEach((snap, index) => { if (!snap.exists()) { transaction.set(productRefs[index], sanitizeForFirebase(INITIAL_STOCK_PRODUCTS[index])); products += 1; } });
          supplierSnaps.forEach((snap, index) => { if (!snap.exists()) { transaction.set(supplierRefs[index], sanitizeForFirebase(INITIAL_STOCK_SUPPLIERS[index])); suppliers += 1; } });
          transaction.set(markerRef, { version: STOCK_CATALOG_VERSION, installed_at: new Date().toISOString() }, { merge: true });
          return { products, suppliers };
        });
        await get().initData();
        return result;
      },

      addTeamMember: async (member) => {
        const previous = get().teamMembers;
        set({ teamMembers: [...previous, member].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) });
        try { await setDoc(doc(db, 'team_members', member.id), sanitizeForFirebase(member)); }
        catch (error) { set({ teamMembers: previous }); throw error; }
      },

      updateTeamMember: async (id, data) => {
        const previous = get().teamMembers;
        const next = { ...data, updated_at: new Date().toISOString() };
        set({ teamMembers: previous.map((item) => item.id === id ? { ...item, ...next } : item) });
        try { await updateDoc(doc(db, 'team_members', id), sanitizeForFirebase(next)); }
        catch (error) { set({ teamMembers: previous }); throw error; }
      },

      addStockProduct: async (product) => {
        const previous = get().stockProducts;
        const previousMovements = get().stockMovements;
        const initial = product.current_quantity > 0 ? { id: `initial-${product.id}`, product_id: product.id, product_name: product.name, type: 'entrada' as const, quantity: product.current_quantity, balance_before: 0, balance_after: product.current_quantity, unit_cost: product.average_cost, reason: 'Saldo inicial do cadastro', occurred_at: product.created_at, created_at: product.created_at } : null;
        set({ stockProducts: [...previous, product].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), stockMovements: initial ? [initial, ...previousMovements] : previousMovements });
        try { const batch = writeBatch(db); batch.set(doc(db, 'stock_products', product.id), sanitizeForFirebase(product)); if (initial) batch.set(doc(db, 'stock_movements', initial.id), sanitizeForFirebase(initial)); await batch.commit(); }
        catch (error) { set({ stockProducts: previous, stockMovements: previousMovements }); throw error; }
      },

      updateStockProduct: async (id, data) => {
        const previous = get().stockProducts;
        const next = { ...data, updated_at: new Date().toISOString() };
        set({ stockProducts: previous.map((item) => item.id === id ? { ...item, ...next } : item) });
        try { await updateDoc(doc(db, 'stock_products', id), sanitizeForFirebase(next)); }
        catch (error) { set({ stockProducts: previous }); throw error; }
      },

      addStockMovement: async (movement) => {
        const product = get().stockProducts.find((item) => item.id === movement.product_id);
        if (!product) throw new Error('Produto de estoque não encontrado.');
        const before = product.current_quantity;
        if ((movement.type === 'saida' || movement.type === 'perda') && movement.quantity > before) {
          throw new Error(`Saldo insuficiente. Disponível: ${before.toLocaleString('pt-BR')} ${product.unit}.`);
        }
        const after = movement.type === 'contagem' || movement.type === 'ajuste'
          ? movement.quantity
          : movement.type === 'entrada'
            ? before + movement.quantity
            : before - movement.quantity;
        const createdAt = new Date().toISOString();
        const record: StockMovement = { ...movement, balance_before: before, balance_after: after, created_at: createdAt };
        const previousProducts = get().stockProducts;
        const previousMovements = get().stockMovements;
        const productPatch: Partial<StockProduct> = {
          current_quantity: after,
          average_cost: movement.type === 'entrada' && movement.unit_cost
            ? Number((((before * (product.average_cost || 0)) + (movement.quantity * movement.unit_cost)) / Math.max(after, movement.quantity)).toFixed(4))
            : product.average_cost,
          last_counted_at: movement.type === 'contagem' ? movement.occurred_at : product.last_counted_at,
          updated_at: createdAt,
        };
        set({
          stockProducts: previousProducts.map((item) => item.id === product.id ? { ...item, ...productPatch } : item),
          stockMovements: [record, ...previousMovements],
        });
        try {
          const batch = writeBatch(db);
          batch.update(doc(db, 'stock_products', product.id), sanitizeForFirebase(productPatch));
          batch.set(doc(db, 'stock_movements', record.id), sanitizeForFirebase(record));
          await batch.commit();
          void notifyStockThresholdChanges(
            [
              {
                before: product,
                after: { ...product, ...productPatch },
              },
            ],
            get().storeSettings.notificationPreferences,
          );
        } catch (error) {
          set({ stockProducts: previousProducts, stockMovements: previousMovements });
          throw error;
        }
      },

      integrateStockSupply: async (id) => {
        // Se o usuário acabou de editar/criar a compra e já tocou em
        // "Conferir", a transação deve enxergar a versão mais recente.
        await waitForStockSupplyWrite(id);

        const previousProducts = get().stockProducts;
        const previousMovements = get().stockMovements;
        const previousSupplies = get().stockSupplies;
        try {
          const result = await runTransaction(db, async (transaction) => {
            const supplyRef = doc(db, 'stock_supplies', id);
            const supplySnap = await transaction.get(supplyRef);
            if (!supplySnap.exists()) throw new Error('Compra não encontrada.');
            const supply = supplySnap.data() as StockSupply;
            if (supply.stock_integrated_at) return null;
            if (supply.status !== 'recebido' && supply.status !== 'conferido') throw new Error('Marque a compra como recebida antes de conferir.');
            const missing = supply.items.find((item) => !item.stock_product_id);
            if (missing) throw new Error(`Vincule todos os itens ao estoque. Pendente: ${missing.name}.`);
            const refs = supply.items.map((item) => doc(db, 'stock_products', item.stock_product_id!));
            const snaps = await Promise.all(refs.map((ref) => transaction.get(ref)));
            const now = new Date().toISOString();
            const changed: StockProduct[] = [];
            const records: StockMovement[] = [];
            supply.items.forEach((item, index) => {
              const snap = snaps[index];
              if (!snap.exists()) throw new Error(`Produto vinculado não encontrado: ${item.name}.`);
              const product = snap.data() as StockProduct;
              if (product.unit !== item.unit) throw new Error(`Unidade incompatível em ${item.name}.`);
              const before = product.current_quantity; const after = before + item.quantity;
              const averageCost = item.unit_price ? Number((((before * (product.average_cost || 0)) + item.quantity * item.unit_price) / Math.max(after, item.quantity)).toFixed(4)) : product.average_cost;
              const next = { ...product, current_quantity: after, average_cost: averageCost, updated_at: now };
              changed.push(next); transaction.update(refs[index], sanitizeForFirebase(next));
              const record: StockMovement = { id: `supply-${supply.id}-${item.id}`, product_id: product.id, product_name: product.name, type: 'entrada', quantity: item.quantity, balance_before: before, balance_after: after, unit_cost: item.unit_price, reason: `Compra${supply.supplier ? ` em ${supply.supplier}` : ''}`, supply_id: supply.id, team_member_id: supply.purchaser_id, team_member_name: supply.purchaser_name, occurred_at: supply.occurred_at, created_at: now };
              records.push(record); transaction.set(doc(db, 'stock_movements', record.id), sanitizeForFirebase(record));
            });
            const supplyPatch: Partial<StockSupply> = { status: 'conferido', checked_at: supply.checked_at || now, stock_integrated_at: now, updated_at: now };
            transaction.update(supplyRef, sanitizeForFirebase(supplyPatch));
            return { changed, records, supplyPatch };
          });
          if (!result) return;
          const changedMap = new Map(result.changed.map((item) => [item.id, item]));
          set({ stockProducts: previousProducts.map((item) => changedMap.get(item.id) || item), stockMovements: [...result.records, ...previousMovements.filter((item) => !result.records.some((record) => record.id === item.id))], stockSupplies: previousSupplies.map((item) => item.id === id ? { ...item, ...result.supplyPatch } : item) });
          void cancelStockSupplyCheckReminder(id);
        } catch (error) {
          set({ stockProducts: previousProducts, stockMovements: previousMovements, stockSupplies: previousSupplies });
          throw error;
        }
      },

      reverseStockSupply: async (id) => {
        await waitForStockSupplyWrite(id);

        const previousProducts = get().stockProducts; const previousMovements = get().stockMovements; const previousSupplies = get().stockSupplies;
        try {
          const result = await runTransaction(db, async (transaction) => {
            const supplyRef=doc(db,'stock_supplies',id);const supplySnap=await transaction.get(supplyRef);if(!supplySnap.exists())throw new Error('Compra não encontrada.');const supply=supplySnap.data() as StockSupply;
            if(!supply.stock_integrated_at)throw new Error('Esta compra ainda não foi integrada.');if(supply.stock_reversed_at)return null;
            const refs=supply.items.map(item=>doc(db,'stock_products',item.stock_product_id!));const snaps=await Promise.all(refs.map(ref=>transaction.get(ref)));const now=new Date().toISOString();const changed:StockProduct[]=[];const records:StockMovement[]=[];
            supply.items.forEach((item,index)=>{const snap=snaps[index];if(!snap.exists())throw new Error(`Produto não encontrado: ${item.name}.`);const product=snap.data() as StockProduct;if(product.current_quantity<item.quantity)throw new Error(`Não é possível estornar ${item.name}: saldo atual menor que a entrada original.`);const after=product.current_quantity-item.quantity;const previousValue=product.current_quantity*(product.average_cost||0)-item.quantity*(item.unit_price||product.average_cost||0);const averageCost=after>0?Number(Math.max(0,previousValue/after).toFixed(4)):undefined;const next={...product,current_quantity:after,average_cost:averageCost,updated_at:now};changed.push(next);transaction.update(refs[index],sanitizeForFirebase({...next,average_cost:averageCost??deleteField()}));const record:StockMovement={id:`reversal-${supply.id}-${item.id}`,product_id:product.id,product_name:product.name,type:'saida',quantity:item.quantity,balance_before:product.current_quantity,balance_after:after,unit_cost:item.unit_price,reason:'Estorno auditável de compra integrada',supply_id:supply.id,team_member_id:supply.purchaser_id,team_member_name:supply.purchaser_name,occurred_at:now,created_at:now};records.push(record);transaction.set(doc(db,'stock_movements',record.id),sanitizeForFirebase(record));});
            const supplyPatch:Partial<StockSupply>={stock_reversed_at:now,updated_at:now};transaction.update(supplyRef,sanitizeForFirebase(supplyPatch));return{changed,records,supplyPatch};
          });
          if(!result)return;const changedMap=new Map(result.changed.map(item=>[item.id,item]));set({stockProducts:previousProducts.map(item=>changedMap.get(item.id)||item),stockMovements:[...result.records,...previousMovements.filter(item=>!result.records.some(record=>record.id===item.id))],stockSupplies:previousSupplies.map(item=>item.id===id?{...item,...result.supplyPatch}:item)});
          void notifyStockThresholdChanges(
            result.changed.map((after) => ({
              before:
                previousProducts.find((item) => item.id === after.id) ||
                after,
              after,
            })),
            get().storeSettings.notificationPreferences,
          );
        } catch(error){set({stockProducts:previousProducts,stockMovements:previousMovements,stockSupplies:previousSupplies});throw error;}
      },

      countStockProducts: async (counts, responsible) => {
        if (!counts.length) return;
        const previousProducts = get().stockProducts;
        const previousMovements = get().stockMovements;
        const now = new Date().toISOString();
        const stamp = Date.now();
        const nextProducts = [...previousProducts];
        const records: StockMovement[] = [];
        counts.forEach((count, position) => {
          const index = nextProducts.findIndex((item) => item.id === count.product_id);
          if (index < 0 || !Number.isFinite(count.quantity) || count.quantity < 0) throw new Error('Contagem inválida.');
          const product = nextProducts[index];
          nextProducts[index] = { ...product, current_quantity: count.quantity, last_counted_at: now, updated_at: now };
          records.push({ id: `count-${stamp}-${position}-${product.id}`, product_id: product.id, product_name: product.name, type: 'contagem', quantity: count.quantity, balance_before: product.current_quantity, balance_after: count.quantity, reason: 'Contagem física em lote', team_member_id: responsible?.id, team_member_name: responsible?.name, occurred_at: now, created_at: now });
        });
        set({ stockProducts: nextProducts, stockMovements: [...records, ...previousMovements] });
        try {
          const batch = writeBatch(db);
          nextProducts.forEach((product) => {
            const before = previousProducts.find((item) => item.id === product.id);
            if (before !== product) {
              batch.update(
                doc(db, 'stock_products', product.id),
                sanitizeForFirebase(product),
              );
            }
          });
          records.forEach((record) =>
            batch.set(
              doc(db, 'stock_movements', record.id),
              sanitizeForFirebase(record),
            ),
          );
          await batch.commit();
          void notifyStockThresholdChanges(
            nextProducts
              .filter((after) =>
                records.some((record) => record.product_id === after.id),
              )
              .map((after) => ({
                before:
                  previousProducts.find((item) => item.id === after.id) ||
                  after,
                after,
              })),
            get().storeSettings.notificationPreferences,
          );
        }
        catch (error) { set({ stockProducts: previousProducts, stockMovements: previousMovements }); throw error; }
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

        const nextRouteId =
          updatedData.route_id !== undefined
            ? updatedData.route_id
            : deliveryToUpdate.route_id;
        const routeChanged = nextRouteId !== deliveryToUpdate.route_id;

        if (routeChanged && deliveryToUpdate.completed === true) {
          throw new Error(
            'Desfaça a baixa antes de mover uma entrega concluída para outra rota.',
          );
        }

        if (routeChanged && updatedData.completed === true) {
          throw new Error(
            'Mova a entrega primeiro e dê baixa somente depois, já na rota correta.',
          );
        }

        if (routeChanged && nextRouteId) {
          const targetRoute = state.routes.find((route) => route.id === nextRouteId);
          if (!targetRoute) {
            throw new Error('A rota de destino não existe.');
          }
          if (targetRoute.status !== 'aberta') {
            throw new Error('A rota de destino precisa estar aberta.');
          }

          const deliveryKey = deliveryDate(deliveryToUpdate);
          const targetRouteKey = routeDate(targetRoute);
          if (
            !deliveryKey ||
            !targetRouteKey ||
            dateKey(deliveryKey) !== dateKey(targetRouteKey)
          ) {
            throw new Error(
              'A rota de destino precisa ser do mesmo dia operacional da entrega.',
            );
          }
        }

        const previousRouteId = deliveryToUpdate.route_id;

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

          if (routeChanged && previousRouteId) {
            const currentState = get();
            const previousRoute = currentState.routes.find(
              (route) => route.id === previousRouteId,
            );
            const remainingPreviousRouteDeliveries =
              currentState.deliveries.filter(
                (delivery) => delivery.route_id === previousRouteId,
              );
            const previousRouteReadyToClose =
              previousRoute?.status === 'aberta' &&
              Boolean(routeStartedAt(previousRoute)) &&
              remainingPreviousRouteDeliveries.every(
                (delivery) => delivery.completed === true,
              );

            if (previousRouteReadyToClose && previousRoute) {
              await currentState.closeRoute(previousRoute.id);
            }
          }

          if (
            updatedData.completed === true &&
            isDeliveryFulfillment(nextDelivery) &&
            nextDelivery.route_id
          ) {
            const currentState = get();
            const routeDeliveries = currentState.deliveries.filter(
              (delivery) => delivery.route_id === nextDelivery.route_id,
            );
            const allDone =
              routeDeliveries.length > 0 &&
              routeDeliveries.every((delivery) => delivery.completed === true);

            if (allDone) {
              const route = currentState.routes.find(
                (item) => item.id === nextDelivery.route_id,
              );
              if (
                route &&
                route.status === 'aberta' &&
                Boolean(routeStartedAt(route))
              ) {
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
        const state = get();
        const deliveryToDelete = state.deliveries.find((delivery) => delivery.id === id);
        if (!deliveryToDelete) throw new Error('Entrega não encontrada.');

        if (deliveryToDelete.completed === true) {
          throw new Error(
            'Desfaça a baixa antes de excluir uma entrega concluída.',
          );
        }

        const previousDeliveries = state.deliveries;
        const linkedRouteId = deliveryToDelete.route_id;

        set((current) => ({
          deliveries: current.deliveries.filter((delivery) => delivery.id !== id),
        }));

        let deletionCommitted = false;
        try {
          await deleteDoc(doc(db, 'deliveries', id));
          deletionCommitted = true;

          if (linkedRouteId) {
            const currentState = get();
            const linkedRoute = currentState.routes.find(
              (route) => route.id === linkedRouteId,
            );
            const remainingDeliveries = currentState.deliveries.filter(
              (delivery) => delivery.route_id === linkedRouteId,
            );
            const routeReadyToClose =
              linkedRoute?.status === 'aberta' &&
              Boolean(routeStartedAt(linkedRoute)) &&
              remainingDeliveries.every(
                (delivery) => delivery.completed === true,
              );

            if (routeReadyToClose && linkedRoute) {
              await currentState.closeRoute(linkedRoute.id);
            }
          }
        } catch (error) {
          if (deletionCommitted) {
            set({ syncError: true });
            console.error(
              'Entrega excluída, mas não foi possível reconciliar a rota:',
              error,
            );
            return;
          }

          set({ deliveries: previousDeliveries, syncError: true });
          console.error(error);
          throw error;
        }
      },

      closeRoute: async (routeId) => {
        const previousRoutes = get().routes;
        const routeBeforeClose = previousRoutes.find((route) => route.id === routeId);

        if (!routeBeforeClose) throw new Error('Rota não encontrada.');
        if (routeBeforeClose.status === 'fechada') return;
        if (!routeStartedAt(routeBeforeClose)) {
          throw new Error('Inicie a rota antes de finalizá-la.');
        }

        const routeDeliveries = get().deliveries.filter(
          (delivery) => delivery.route_id === routeId,
        );

        if (routeDeliveries.some((delivery) => !delivery.completed)) {
          throw new Error('Conclua todas as entregas antes de finalizar a rota.');
        }

        const endTime = new Date().toISOString();

        set((state) => ({
          routes: state.routes.map((route) =>
            route.id === routeId
              ? {
                  ...route,
                  status: 'fechada',
                  end_time: route.end_time || endTime,
                  updated_at: endTime,
                }
              : route,
          ),
        }));

        try {
          const route = get().routes.find((item) => item.id === routeId);
          const finalEndTime = route?.end_time || endTime;

          await updateDoc(doc(db, 'routes', routeId), {
            status: 'fechada',
            end_time: finalEndTime,
            updated_at: endTime,
          });
        } catch (error) {
          set({ routes: previousRoutes });
          console.error(error);
          throw error;
        }

        // Encerrar a rota não significa que os pedidos já foram confirmados
        // no portal do iFood. Criamos uma fila externa, idempotente.
        try {
          const current = get();
          const now = new Date().toISOString();

          const confirmationItems: IfoodPendingConfirmation[] = routeDeliveries
            .filter((delivery) => delivery.origin === 'ifood')
            .map((delivery) => {
              const customer = current.customers.find(
                (item) => item.id === delivery.customer_id,
              );

              const code =
                (delivery.confirmation_code || customer?.last_confirmation_code || '')
                  .replace(/\D/g, '')
                  .slice(0, 4);

              const ifoodId = (delivery.ifood_id || '')
                .replace(/\D/g, '')
                .slice(0, 8);

              return {
                id: `ifood-route-${delivery.id}`,
                delivery_id: delivery.id,
                route_id: routeId,
                route_name: routeBeforeClose.name,
                source_kind: 'route',
                order_id: delivery.order_id || undefined,
                ifood_id: ifoodId || undefined,
                confirmation_code: code || undefined,
                customer_name:
                  delivery.customer_name || customer?.name || 'Cliente',
                value: delivery.value,
                note: 'Entrega concluída; confirmação externa do iFood ainda pendente.',
                status: 'pending',
                created_at: now,
                updated_at: now,
              } satisfies IfoodPendingConfirmation;
            });

          const pendingBefore = current.ifoodPendingConfirmations.length;
          await current.addIfoodPendingConfirmations(confirmationItems);
          const pendingAfter = get().ifoodPendingConfirmations;
          const routePendingCount = pendingAfter.filter(
            (item) => item.route_id === routeId && item.status === 'pending',
          ).length;

          if (routePendingCount > 0) {
            void notifyIfoodRoutePending(
              routeId,
              routeBeforeClose.name || 'a rota',
              routePendingCount,
            );
          } else if (pendingAfter.length >= pendingBefore) {
            void notifyRouteFinished(
              routeId,
              routeBeforeClose.name || 'Rota',
            );
          }
        } catch (error) {
          // A rota já foi encerrada com sucesso. Falha da fila não deve
          // reabrir a operação nem corromper a duração da rota.
          set({ syncError: true });
          console.error(
            'Rota finalizada, mas houve falha ao preparar confirmações do iFood:',
            error,
          );
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
        if (state.deliveries.find((delivery) => delivery.id === deliveryId)?.order_locked) throw new Error('Destrave a parada antes de reordenar.');

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
        if (state.deliveries.find((delivery) => delivery.id === deliveryId)?.order_locked) throw new Error('Destrave a parada antes de reordenar.');

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

      addOperationalExpense: async (expense) => {
        const previous = get().operationalExpenses;
        if (expense.source_id && previous.some((item) => item.source_id === expense.source_id)) {
          throw new Error('Esta despesa já foi lançada.');
        }
        set((state) => ({ operationalExpenses: [expense, ...state.operationalExpenses] }));
        try {
          await setDoc(doc(db, 'operational_expenses', expense.id), sanitizeForFirebase(expense));
        } catch (error) {
          set({ operationalExpenses: previous });
          console.error(error);
          throw error;
        }
      },

      deleteOperationalExpense: async (id) => {
        const previous = get().operationalExpenses;
        set((state) => ({ operationalExpenses: state.operationalExpenses.filter((item) => item.id !== id) }));
        try {
          await deleteDoc(doc(db, 'operational_expenses', id));
        } catch (error) {
          set({ operationalExpenses: previous });
          throw error;
        }
      },

      addIfoodPendingConfirmations: async (items) => {
        if (!items.length) return;

        const previous = get().ifoodPendingConfirmations;
        const normalizeDigits = (value?: string) => (value || '').replace(/\D/g, '');

        const incoming = items.filter((item, index, source) => {
          const deliveryKey = item.delivery_id?.trim();
          const ifoodKey = normalizeDigits(item.ifood_id);
          const orderKey = normalizeDigits(item.order_id);

          const duplicatedBefore = source.slice(0, index).some((other) =>
            Boolean(deliveryKey && other.delivery_id === deliveryKey) ||
            Boolean(ifoodKey && normalizeDigits(other.ifood_id) === ifoodKey) ||
            Boolean(!ifoodKey && orderKey && normalizeDigits(other.order_id) === orderKey),
          );

          if (duplicatedBefore) return false;

          return !previous.some((other) =>
            Boolean(deliveryKey && other.delivery_id === deliveryKey) ||
            Boolean(ifoodKey && normalizeDigits(other.ifood_id) === ifoodKey) ||
            Boolean(!ifoodKey && orderKey && normalizeDigits(other.order_id) === orderKey),
          );
        });

        if (!incoming.length) return;

        set((state) => ({
          ifoodPendingConfirmations: [...incoming, ...state.ifoodPendingConfirmations],
        }));

        try {
          const batch = writeBatch(db);
          incoming.forEach((item) => {
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

      mergeCustomers: async (sourceId, targetId) => {
        if (!sourceId || !targetId || sourceId === targetId) {
          throw new Error('Selecione dois clientes diferentes.');
        }

        const state = get();
        const source = state.customers.find((item) => item.id === sourceId);
        const target = state.customers.find((item) => item.id === targetId);

        if (!source || !target) {
          throw new Error('Um dos clientes não foi encontrado.');
        }

        const linkedDeliveries = state.deliveries.filter(
          (delivery) => delivery.customer_id === sourceId,
        );

        // Firestore limita batches. Deixamos margem para cliente + referências.
        if (linkedDeliveries.length > 450) {
          throw new Error(
            'Este cliente possui entregas demais para consolidação segura em um único lote.',
          );
        }

        const now = new Date().toISOString();
        const allAfterMerge = state.deliveries.map((delivery) =>
          delivery.customer_id === sourceId
            ? {
                ...delivery,
                customer_id: targetId,
                customer_name: target.name,
                updated_at: now,
              }
            : delivery,
        );

        const completed = allAfterMerge.filter(
          (delivery) =>
            delivery.customer_id === targetId &&
            delivery.completed === true,
        );

        const prefer = (primary?: string, fallback?: string) =>
          primary?.trim() || fallback?.trim() || undefined;

        const mergedTarget: Customer = {
          ...target,
          phone: prefer(target.phone, source.phone),
          address: prefer(target.address, source.address),
          neighborhood: prefer(target.neighborhood, source.neighborhood),
          maps_link: prefer(target.maps_link, source.maps_link),
          observation: prefer(target.observation, source.observation),
          last_confirmation_code: prefer(
            target.last_confirmation_code,
            source.last_confirmation_code,
          ),
          orderCount: completed.length,
          totalSpent: completed.reduce(
            (sum, delivery) => sum + (delivery.value || 0),
            0,
          ),
          updated_at: now,
        };

        const previousCustomers = state.customers;
        const previousDeliveries = state.deliveries;

        set({
          customers: state.customers
            .filter((customer) => customer.id !== sourceId)
            .map((customer) =>
              customer.id === targetId ? mergedTarget : customer,
            ),
          deliveries: allAfterMerge,
        });

        try {
          const batch = writeBatch(db);

          linkedDeliveries.forEach((delivery) => {
            batch.update(
              doc(db, 'deliveries', delivery.id),
              sanitizeForFirebase({
                customer_id: targetId,
                customer_name: target.name,
                updated_at: now,
              }),
            );
          });

          batch.set(
            doc(db, 'customers', targetId),
            sanitizeForFirebase(mergedTarget),
            { merge: true },
          );
          batch.delete(doc(db, 'customers', sourceId));

          await batch.commit();
          return { deliveriesMoved: linkedDeliveries.length };
        } catch (error) {
          set({
            customers: previousCustomers,
            deliveries: previousDeliveries,
            syncError: true,
          });
          console.error('Erro ao consolidar clientes:', error);
          throw error;
        }
      },

      findOrCreateCustomer: async (name, details) => {
        const rawName = name.trim();
        if (!rawName) return '';

        const previousCustomers = get().customers;
        const now = new Date().toISOString();

        const existing = findExistingCustomer(
          previousCustomers,
          rawName,
          {
            address: details?.address,
            phone: details?.phone,
          },
        );

        const derivedNeighborhood = extractCustomerNeighborhood(details?.address);

        if (existing) {
          const updatedFields: Partial<Customer> = {
            updated_at: now,
          };

          // Enriquece o cadastro, mas não destrói dado bom com valor vazio.
          if (details?.address?.trim()) updatedFields.address = details.address.trim();
          if (details?.mapsLink?.trim()) updatedFields.maps_link = details.mapsLink.trim();
          if (details?.confirmationCode?.trim()) {
            updatedFields.last_confirmation_code = details.confirmationCode.trim();
          }
          if (details?.observation?.trim()) updatedFields.observation = details.observation.trim();
          if (derivedNeighborhood) updatedFields.neighborhood = derivedNeighborhood;
          if (details?.origin) updatedFields.origin = details.origin;
          if (details?.phone?.trim()) updatedFields.phone = details.phone.trim();

          set((state) => ({
            customers: state.customers.map((customer) =>
              customer.id === existing.id
                ? { ...customer, ...updatedFields }
                : customer,
            ),
          }));

          try {
            await updateDoc(
              doc(db, 'customers', existing.id),
              sanitizeForFirebase(updatedFields),
            );
          } catch (error) {
            set({ customers: previousCustomers });
            console.error('Erro ao atualizar cliente existente:', error);
            throw error;
          }

          return existing.id;
        }

        // Mesmo nome com identidade diferente = cadastro separado e explícito.
        const customerName = nextCustomerName(previousCustomers, rawName);
        const newCustomer: Customer = {
          id: `customer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: customerName,
          origin: details?.origin || 'loja',
          neighborhood: derivedNeighborhood,
          address: details?.address?.trim() || undefined,
          maps_link: details?.mapsLink?.trim() || undefined,
          last_confirmation_code: details?.confirmationCode?.trim() || undefined,
          observation: details?.observation?.trim() || undefined,
          phone: details?.phone?.trim() || undefined,
          createdAt: now,
          updated_at: now,
        };

        // Segunda checagem síncrona evita duplicata em chamadas encadeadas.
        const rechecked = findExistingCustomer(
          get().customers,
          rawName,
          {
            address: details?.address,
            phone: details?.phone,
          },
        );

        if (rechecked) return rechecked.id;

        set((state) => ({
          customers: [newCustomer, ...state.customers],
        }));

        try {
          await setDoc(
            doc(db, 'customers', newCustomer.id),
            sanitizeForFirebase(newCustomer),
          );
          return newCustomer.id;
        } catch (error) {
          set({ customers: previousCustomers });
          console.error('Erro ao criar cliente:', error);
          throw error;
        }
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
        // Cache local operacional: mantém a experiência offline,
        // mas evita serializar indefinidamente históricos grandes
        // a cada atualização do Zustand.
        stockSupplies: state.stockSupplies.slice(0, 150),
        stockSuppliers: state.stockSuppliers,
        teamMembers: state.teamMembers,
        stockProducts: state.stockProducts,
        stockMovements: state.stockMovements.slice(0, 500),
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
