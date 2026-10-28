import { create } from 'zustand';
import { isFutureScheduledDelivery } from "@/lib/scheduled-delivery";
import { toast } from '@/lib/operational-toast';
import { persist } from 'zustand/middleware';
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch, deleteField, runTransaction, query, where } from 'firebase/firestore';
import { createSerializedWriteQueue } from '@/lib/store/serializedWriteQueue';
import { queueDeliveryDocuments } from '@/lib/store/atomicDeliveryWriteQueue';
import { createKeyedWriteQueue } from '@/lib/store/keyedWriteQueue';
import { rollbackAddedEntity, rollbackUpdatedEntity, rollbackDeletedEntity, rollbackAddedEntities, rollbackUpdatedEntities } from '@/lib/operation/optimisticRollback';
import { signInWithPopup, signOut, signInWithCredential, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { db, auth, googleProvider } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import {
  cancelRouteDurationReminder,
  notifyRouteStarted,
  scheduleRouteDurationReminder,
  cancelStockSupplyCheckReminder,
  DEFAULT_NOTIFICATION_PREFERENCES,
  notifyIfoodRoutePending,
  notifyNewSiteOrder,
  notifyRouteFinished,
  notifyStockThresholdChanges,
  notifySyncFailure,
  scheduleStockSupplyCheckReminder,
  type NotificationPreferences,
} from '@/lib/native/notifications';
import type { Route, Delivery, Customer, OrderOrigin, Motoboy, Fueling, StockSupply, StockSupplier, TeamMember, StockProduct, StockMovement, DaySchedule, StorePause, HolidayOverride, IfoodPendingConfirmation, OperationalExpense, MotoboySettlementCategory, MotoboyAdjustment } from '@/types';
import { isDeliveryFulfillment } from '@/lib/delivery-mode';
import {
  dateKey,
  deliveryDate,
  isSyntheticOperationalRoute,
  routeDate,
  routeOperationalDateKey,
  routeStartedAt,
} from '@/lib/operational-time';
import { isClosedSettlement, settlementDocumentId } from '@/lib/motoboy-settlement-authority';
import { reconcileIfoodConfirmation } from '@/lib/ifood-confirmation-authority';
import { orderConfirmationCode } from '@/lib/operation/ifoodOrderCode';
import { fuelingDate } from '@/lib/fueling-analytics';
import { INITIAL_STOCK_PRODUCTS, INITIAL_STOCK_SUPPLIERS, STOCK_CATALOG_VERSION } from '@/lib/stock-catalog';
import {
  customerIdentityEvidence,
  extractCustomerNeighborhood,
  findExistingCustomer,
  nextCustomerName,
  normalizeCustomerAddress,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from '@/lib/customer-identity';
import { customerPhones, customerAddresses, customerContactPayload } from '@/lib/customer-contact-book';
import { stockProductCategory, suggestStockCategory } from '@/lib/stock-categories';
import { deliveryStopKey, expandStopOrder, groupDeliveriesByStop, keepPinnedStopPositions, moveStopToIndex, stopDeliveryIds } from '@/lib/route-stops';
import { rollbackRouteOrderFields, withRouteOrderWriteLock } from '@/lib/route-order-write-guard';
import { validOriginPoint } from '@/lib/store-origin';
import { deliveryCustomerCharge, paymentStateForInput } from '@/lib/delivery-finance';
import { isSiteOrderAwaitingConfirmation, isSiteOrderAwaitingHomeReview } from '@/lib/integration/site-order';
import { recordSyncDiagnostic } from '@/lib/sync-diagnostics';
import { mergeCloudFirstById, mergeDeliveriesPreservingExpansion } from '@/lib/operation/snapshotMerge';
import { assertRemoteDeliveryTransition, assertRouteClosureStable, assertRemoteSettlementAdjustment } from '@/lib/operation/remoteOperationGuards';
import { captureOperationalBaseline, operationalDeliverySignature, operationalRouteSignature, preserveInFlightLocalEdits, trustedIncrementalCheckpoint, syncOwnerStillCurrent } from '@/lib/operation/snapshot-sync-safety';
import { markUnreadSiteOrders } from '@/lib/site-order-inbox';
import { buildSmartRouteOrder, deliveryPoint } from '@/lib/route-intelligence';
import { kickSiteRoute } from '@/lib/integration/client/routeKick';
import {
  clampStockExit,
  roundStockQuantity,
  stockExitExceeds,
} from '@/lib/stock-precision';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { assertSiteRouteAllocation, siteInboxProjection } from '@/lib/operation/siteInboxPolicy';
import { activeRouteDeliveries, canAutoCloseRoute } from '@/lib/route-closure-eligibility';
import { groupStockSupplyItems, planStockSupplyLedger } from '@/lib/stock-supply-ledger';
import { planStockMovement, planStockCount, type StockCountInput } from '@/lib/stock-mutation-plan';

const stockWriteConnectionError = (error: unknown) => {
  const code = String((error as { code?: unknown } | null)?.code || '');
  return /unavailable|deadline-exceeded|failed-precondition/.test(code);
};

const routeCreateLocks = new Set<string>();
const deliveryMutationLocks = new Set<string>();
// Serializa cadastros do mesmo nome dentro desta sessão, sem presumir identidade.
const customerCreationFlights = new Map<string, Promise<string>>();

// A chave do lock representa a tentativa/ID, não o motoboy: o mesmo motoboy pode ter várias rotas no dia.
const routeOperationKey = (route: Pick<Route, 'id'>) => route.id;

const sameExternalDelivery = (left: Delivery, right: Delivery) => {
  if (left.id === right.id) return true;
  if (left.external_order_id && right.external_order_id) {
    return left.source_system === right.source_system && left.external_order_id === right.external_order_id;
  }
  const leftIfood = (left.ifood_id || '').replace(/\D/g, '');
  const rightIfood = (right.ifood_id || '').replace(/\D/g, '');
  if (leftIfood && rightIfood && leftIfood === rightIfood) return true;
  const left99 = left.origin === 'food99' ? (left.order_id || '').replace(/\D/g, '') : '';
  const right99 = right.origin === 'food99' ? (right.order_id || '').replace(/\D/g, '') : '';
  if (!left99 || !right99 || left99 !== right99) return false;
  const leftDate = deliveryDate(left);
  const rightDate = deliveryDate(right);
  return Boolean(leftDate && rightDate && dateKey(leftDate) === dateKey(rightDate));
};


async function autoOrganizeLoadedRouteAfterInsert(
  routeId: string,
  deliveries: Delivery[],
  customers: Customer[],
  settings: { storeLatitude?: number; storeLongitude?: number },
) {
  if (!routeId) return;
  const items = deliveries
    .filter((delivery) => delivery.route_id === routeId && !delivery.completed && !isCancelledSiteDelivery(delivery))
    .sort((a, b) => (a.order_index ?? 999999) - (b.order_index ?? 999999));
  const groups = groupDeliveriesByStop(items);
  if (groups.length < 2) return;

  const origin = validOriginPoint(settings.storeLatitude, settings.storeLongitude);
  if (!origin) return;

  const lockedAt = new Map<number, (typeof groups)[number]>();
  const freeGroups: typeof groups = [];
  groups.forEach((group, index) => {
    const locked = group.deliveries.some(
      (delivery) => delivery.order_locked === true && delivery.order_source !== 'smart',
    );
    if (locked) lockedAt.set(index, group);
    else freeGroups.push(group);
  });
  if (freeGroups.length < 2) return;

  const customerMap = new Map(customers.map((customer) => [customer.id, customer]));
  const freeStops = freeGroups.map((group) => {
    const delivery = group.representative;
    const customer = customerMap.get(delivery.customer_id);
    return { delivery, customer, point: deliveryPoint(delivery, customer) };
  });
  if (freeStops.filter((stop) => Boolean(stop.point)).length < 2) return;

  const smartFree = buildSmartRouteOrder(origin, freeStops);
  // Evita varrer todos os grupos livres para cada parada escolhida.
  const freeByKey = new Map(freeGroups.map((group) => [group.key, group] as const));
  const orderedFree = smartFree
    .map((stop) => freeByKey.get(deliveryStopKey(stop.delivery)))
    .filter((group): group is (typeof groups)[number] => Boolean(group));
  const finalGroups: typeof groups = [];
  let freeCursor = 0;
  for (let index = 0; index < groups.length; index += 1) {
    finalGroups[index] = lockedAt.get(index) || orderedFree[freeCursor++];
  }

  const expanded = finalGroups.flatMap((group) => group.deliveries.map((delivery) => delivery.id));
  const byDeliveryId = new Map(items.map((item) => [item.id, item] as const));
  const now = new Date().toISOString();
  const updates = expanded
    .map((id, index) => {
      const current = byDeliveryId.get(id);
      if (!current || current.order_locked === true) return null;
      if ((current.order_index ?? -1) === index && current.order_source === 'smart') return null;
      return { id, order_index: index, order_source: 'smart' as const, order_updated_at: now };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!updates.length) return;

  const batch = writeBatch(db);
  updates.forEach((update) => batch.update(doc(db, 'deliveries', update.id), sanitizeForFirebase(update)));
  await batch.commit();
}

interface AppState {
  user: FirebaseUser | null;
  authLoaded: boolean;
  hasHydrated: boolean;
  routes: Route[];
  /** Somente UI: rotas aguardando confirmação remota de fechamento. */
  closingRouteIds: string[];
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
  motoboyAdjustments: MotoboyAdjustment[];
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
    /** Plataforma entrega ou DFL entrega; ausencia preserva o padrao anterior. */
    marketplaceDeliveryModes?: { ifood: 'dfl' | 'platform'; food99: 'dfl' | 'platform' };
    purchasePlanningTime?: string;
    stockReviewTime?: string;
    /** Categorias personalizadas do acerto, sincronizadas no documento da loja. */
    settlementAdjustmentCategories?: MotoboySettlementCategory[];
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
  getDeliveriesByRoute: (routeId: string) => (Delivery & { is_expanded?: boolean })[];
  getCustomerById: (customerId?: string) => Customer | undefined;
  addRoute: (route: Route) => Promise<void>;
  updateRoute: (routeId: string, data: Partial<Route>) => Promise<void>;
  startRoute: (routeId: string) => Promise<void>;
  deleteRoute: (routeId: string) => Promise<void>;
  addDelivery: (delivery: Delivery) => Promise<void>;
  addDeliveries: (deliveries: Delivery[]) => Promise<void>;
  updateDelivery: (id: string, updatedData: Partial<Delivery>) => Promise<void>;
  allocateSiteDelivery: (deliveryId: string, target: ({routeId: string} | {newRoute: {name: string; motoboyId: string}}) & {operational?: {address_string?:string;phone?:string;observation?:string;payment_method?:Delivery['payment_method']}}) => Promise<string>;
  deleteDelivery: (id: string) => Promise<void>;
  closeRoute: (routeId: string, options?: { effectiveEndTime?: string; autoClosedAt?: string }) => Promise<void>;
  reopenRoute: (routeId: string) => Promise<void>;
  reorderDelivery: (routeId: string, deliveryId: string, direction: 'up' | 'down') => Promise<void>;
  moveDeliveryToIndex: (routeId: string, deliveryId: string, targetIndex: number) => Promise<void>;
  setDeliveryOrder: (
    routeId: string,
    orderedPendingIds: string[],
    options?: {
      metadata?: {
        order_locked?: boolean;
        order_source?: 'manual' | 'smart';
        order_updated_at?: string;
      };
    },
  ) => Promise<void>;
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
  cleanupDuplicateStockProducts: () => Promise<{ deleted: number; archived: number; groups: number }>;
  addStockMovement: (movement: Omit<StockMovement, 'balance_before' | 'balance_after' | 'created_at'> & { expected_balance?: number }) => Promise<void>;
  integrateStockSupply: (id: string) => Promise<void>;
  reverseStockSupply: (id: string) => Promise<void>;
  countStockProducts: (counts: StockCountInput[], responsible?: { id?: string; name?: string }) => Promise<void>;
  addOperationalExpense: (expense: OperationalExpense) => Promise<void>;
  addMotoboyAdjustment: (adjustment: MotoboyAdjustment) => Promise<void>;
  cancelMotoboyAdjustment: (id: string) => Promise<void>;
  closeMotoboySettlement: (expense: OperationalExpense, adjustmentIds: string[]) => Promise<void>;
  updateOperationalExpense: (id: string, data: Partial<OperationalExpense>) => Promise<void>;
  deleteOperationalExpense: (id: string) => Promise<void>;
  addIfoodPendingConfirmations: (items: IfoodPendingConfirmation[]) => Promise<void>;
  updateIfoodPendingConfirmation: (id: string, data: Partial<IfoodPendingConfirmation>) => Promise<void>;
  deleteIfoodPendingConfirmation: (id: string) => Promise<void>;
  findOrCreateCustomer: (
    name: string,
    details?: {
      address?: string;
      phone?: string;
      mapsLink?: string;
      confirmationCode?: string;
      observation?: string;
      origin?: OrderOrigin;
      preferredCustomerId?: string;
    },
  ) => Promise<string>;
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

// Todas as gravações do documento store_settings seguem a ordem das alterações locais.
const queueStoreSettingsWrite = createSerializedWriteQueue();
// Serializa somente escritas do MESMO documento; evita sobrescrita fora de ordem.
const queueEntityWrite = createKeyedWriteQueue();

/**
 * V39 — orçamento de leituras Firestore.
 *
 * As três coleções historicamente mais pesadas deixam de ser baixadas por
 * inteiro em toda abertura. O estado persistido do Zustand vira o checkpoint:
 * buscamos somente documentos posteriores ao item local mais recente.
 *
 * O overlap curto protege contra diferenças de relógio/retries e o merge por
 * id mantém a versão da nuvem soberana quando o mesmo registro reaparece.
 *
 * Sem cache local válido, o comportamento continua sendo bootstrap completo,
 * portanto instalação nova / storage limpo não perde histórico.
 */
const FIRESTORE_INCREMENTAL_OVERLAP_MS = 5 * 60 * 1000;

const incrementalCollection = <T>(
  collectionName: string,
  localItems: T[],
  timestampField: string,
  timestampOf: (item: T) => string | undefined | null,
) => {
  if (!localItems.length) {
    return collection(db, collectionName);
  }

  // Relógio de aparelho adiantado não pode criar buraco no checkpoint.
  // O overlap de 5 minutos continua aplicado abaixo normalmente.
  const newestLocalMs = trustedIncrementalCheckpoint(localItems, timestampOf, Date.now());

  if (!newestLocalMs) {
    return collection(db, collectionName);
  }

  const since = new Date(
    Math.max(0, newestLocalMs - FIRESTORE_INCREMENTAL_OVERLAP_MS),
  ).toISOString();

  return query(
    collection(db, collectionName),
    where(timestampField, '>', since),
  );
};

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

let initDataInFlight = false;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      authLoaded: false,
      hasHydrated: false,
      routes: [],
      closingRouteIds: [],
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
      motoboyAdjustments: [],
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
        const newSettings = {
          ...currentSettings,
          ...settings,
        };

        // Optimistic UI: a Loja reage imediatamente.
        set({ storeSettings: newSettings });

        try {
          const safeData =
            sanitizeForFirebase(newSettings);

          await queueStoreSettingsWrite(safeData, (snapshot) => setDoc(
            doc(db, 'store', 'store_settings'),
            snapshot,
            { merge: true },
          ));
        } catch (error) {
          console.error(
            'Erro ao salvar configurações:',
            error,
          );

          /*
           * Rollback apenas se ninguém alterou as configurações depois.
           * Evita uma gravação antiga apagar uma mudança mais recente.
           */
          if (get().storeSettings === newSettings) {
            set({ storeSettings: currentSettings });
          }

          throw error;
        }
      },

      loginWithGoogle: async () => {
        try {
          if (Capacitor.isNativePlatform()) {
            /*
             * O DFL usa o Google apenas para obter o ID token e autenticar
             * no Firebase. Não precisamos de serverAuthCode/offline access.
             *
             * No CapacitorGoogleAuth 3.4.x o clientId passado aqui tem
             * prioridade sobre as demais fontes de configuração.
             */
            GoogleAuth.initialize({
              clientId: '773967662232-pjodqa7f4c4drrhl80439amdp27u31ha.apps.googleusercontent.com',
              scopes: ['profile', 'email'],
              grantOfflineAccess: false,
            });

            const googleUser = await GoogleAuth.signIn();
            const idToken = googleUser?.authentication?.idToken;

            if (!idToken) {
              throw new Error(
                'O Google retornou a conta, mas não retornou um ID token válido.',
              );
            }

            const credential = GoogleAuthProvider.credential(idToken);
            const result = await signInWithCredential(auth, credential);

            if (!result.user) {
              throw new Error('O Firebase não concluiu a autenticação do usuário.');
            }
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
        // Sessão sem UID confirmado jamais deve iniciar leitura global de dados.
        if (!get().hasHydrated || !get().authLoaded || !get().user?.uid) return;

        // AuthGuard já inicializa uma única vez por montagem/login.
        // Chamadas explícitas posteriores são permitidas, mas nunca concorrentes.
        if (initDataInFlight || get().isSyncing) return;
        initDataInFlight = true;

        const syncStartedAt = new Date().toISOString();
        // A consulta assíncrona não pode reaplicar dados de uma conta anterior.
        const syncOwnerUid = get().user?.uid;
        // Captura somente campos operacionais; gestos visuais não concorrem com Firestore.
        const deliveryBaseline = captureOperationalBaseline(get().deliveries, operationalDeliverySignature);
        const routeBaseline = captureOperationalBaseline(get().routes, operationalRouteSignature);
        const knownDeliveryIds = new Set(get().deliveries.map((item) => item.id));
        let siteOrderWatchReady = false;
        try {
          siteOrderWatchReady = localStorage.getItem('dfl-site-order-watch-ready') === '1';
        } catch {
          siteOrderWatchReady = false;
        }
        const syncStartedMs = Date.now();
        set({ isSyncing: true, syncError: false });
        try {
          const [routesSnap, deliveriesSnap, customersSnap, motoboysSnap, fuelingsSnap, stockSuppliesSnap, stockSuppliersSnap, teamMembersSnap, stockProductsSnap, stockMovementsSnap, pendingConfirmationsSnap, operationalExpensesSnap, motoboyAdjustmentsSnap, storeSnap] = await Promise.all([
            getDocs(incrementalCollection('routes', get().routes, 'updated_at', (item) => item.updated_at || item.created_at)),
            getDocs(incrementalCollection(
              'deliveries',
              get().deliveries,
              'updated_at',
              (item) => item.updated_at || item.created_at || item.createdAt,
            )),
            getDocs(incrementalCollection(
              'customers',
              get().customers,
              'updated_at',
              (item) => item.updated_at,
            )),
            getDocs(incrementalCollection('motoboys', get().motoboys, 'updated_at', (item) => item.updated_at || item.createdAt)),
            getDocs(incrementalCollection(
              'fuelings',
              get().fuelings,
              'updated_at',
              (item) => item.updated_at || item.created_at || item.occurred_at,
            )),
            getDocs(incrementalCollection(
              'stock_supplies',
              get().stockSupplies,
              'updated_at',
              (item) => item.updated_at || item.created_at || item.occurred_at,
            )),
            getDocs(incrementalCollection('stock_suppliers', get().stockSuppliers, 'updated_at', (item) => item.updated_at || item.created_at)),
            getDocs(incrementalCollection('team_members', get().teamMembers, 'updated_at', (item) => item.updated_at || item.created_at)),
            getDocs(incrementalCollection('stock_products', get().stockProducts, 'updated_at', (item) => item.updated_at || item.created_at)),
            getDocs(incrementalCollection(
              'stock_movements',
              get().stockMovements,
              'created_at',
              (item) => item.created_at || item.occurred_at,
            )),
            getDocs(incrementalCollection('ifood_pending_confirmations', get().ifoodPendingConfirmations, 'updated_at', (item) => item.updated_at || item.created_at)),
            getDocs(incrementalCollection(
              'operational_expenses',
              get().operationalExpenses,
              'updated_at',
              (item) => item.updated_at || item.created_at || item.occurred_at,
            )),
            getDocs(incrementalCollection(
              'motoboy_adjustments',
              get().motoboyAdjustments,
              'updated_at',
              (item) => item.updated_at || item.created_at,
            )),
            getDoc(doc(db, 'store', 'store_settings'))
          ]);

          // Logout/troca de usuário enquanto as queries estavam em voo:
          // descartar a resposta antes de qualquer merge ou notificação.
          if (!syncOwnerStillCurrent(syncOwnerUid, get().user?.uid)) {
            set({ isSyncing: false });
            return;
          }

          const syncCollections: Record<string, number> = {
            routes: routesSnap.size,
            deliveries: deliveriesSnap.size,
            customers: customersSnap.size,
            motoboys: motoboysSnap.size,
            fuelings: fuelingsSnap.size,
            stock_supplies: stockSuppliesSnap.size,
            stock_suppliers: stockSuppliersSnap.size,
            team_members: teamMembersSnap.size,
            stock_products: stockProductsSnap.size,
            stock_movements: stockMovementsSnap.size,
            ifood_pending_confirmations: pendingConfirmationsSnap.size,
            operational_expenses: operationalExpensesSnap.size,
            motoboy_adjustments: motoboyAdjustmentsSnap.size,
            store_settings: storeSnap.exists() ? 1 : 0,
          };

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
          const fbMotoboyAdjustments = motoboyAdjustmentsSnap.docs.map(d => d.data() as MotoboyAdjustment);
          const fbPendingConfirmations = pendingConfirmationsSnap.docs.map(
            d => d.data() as IfoodPendingConfirmation,
          );

          const cloudStoreSettings = storeSnap.exists() ? storeSnap.data() : null;

          // R47: cloud authority and local UI state, with indexed reconciliation.
          // No Firestore reads or writes are added by this merge.
          // Cloud-first permanece a regra. Só edições feitas DURANTE esta
          // consulta vencem um snapshot remoto anterior; não criar writes extras.
          const mergedRoutes = preserveInFlightLocalEdits(mergeCloudFirstById(fbRoutes, get().routes), get().routes, routeBaseline, operationalRouteSignature);
          let mergedDeliveries = preserveInFlightLocalEdits(mergeDeliveriesPreservingExpansion(fbDeliveries, get().deliveries), get().deliveries, deliveryBaseline, operationalDeliverySignature);

          mergedDeliveries.sort((a, b) => {
             const orderA = a.order_index !== undefined ? a.order_index : new Date(a.updated_at || 0).getTime();
             const orderB = b.order_index !== undefined ? b.order_index : new Date(b.updated_at || 0).getTime();
             return orderA - orderB;
          });

          const mergedCustomers = mergeCloudFirstById(fbCustomers, get().customers);
          const mergedMotoboys = mergeCloudFirstById(fbMotoboys, get().motoboys);
          const mergedFuelings = mergeCloudFirstById(fbFuelings, get().fuelings);
          mergedFuelings.sort(
            (a, b) => fuelingDate(b).getTime() - fuelingDate(a).getTime(),
          );

          const mergedStockSupplies = mergeCloudFirstById(fbStockSupplies, get().stockSupplies);
          mergedStockSupplies.sort(
            (a, b) => new Date(b.occurred_at || b.created_at).getTime() - new Date(a.occurred_at || a.created_at).getTime(),
          );

          // Preserve the historical mergeById call sites while removing O(n²) scans.
          const mergeById = mergeCloudFirstById;
          const mergedTeamMembers = mergeById(fbTeamMembers, get().teamMembers).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
          const mergedStockSuppliers = mergeById(fbStockSuppliers, get().stockSuppliers).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
          const mergedStockProducts = mergeById(fbStockProducts, get().stockProducts).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

          // Migração conservadora de categorias antigas.
          // Depois que existe uma categoria explícita válida, ela é soberana.
          const categoryMigrations = mergedStockProducts
            .map((product) => {
              const current = (product.category || '').trim();

              const normalize = (value: string) =>
                value
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .trim()
                  .toLocaleLowerCase('pt-BR');

              const currentNorm = normalize(current);
              const nameNorm = normalize(product.name);

              let inferred: string | null = null;

              // Alias histórico.
              if (currentNorm === 'frios e laticinios') {
                inferred = 'Frios';
              }

              // Categoria genérica antiga: pode ser migrada uma vez.
              else if (/^ingredientes?$/.test(currentNorm)) {
                inferred = suggestStockCategory(product.name);
              }

              // Correções comprovadas de dados legados.
              else if (
                currentNorm === 'mercearia' &&
                /bacon(?:\s+fatiado)?/.test(nameNorm)
              ) {
                inferred = 'Frios';
              }

              else if (
                currentNorm === 'mercearia' &&
                /hamburg/.test(nameNorm)
              ) {
                inferred = 'Congelados';
              }

              else if (
                currentNorm === 'mercearia' &&
                /(file.*frango|peito.*frango)/.test(nameNorm)
              ) {
                inferred = 'Açougue';
              }

              else if (
                currentNorm === 'mercearia' &&
                /salsich/.test(nameNorm)
              ) {
                inferred = 'Frios';
              }

              return inferred && inferred !== current
                ? { product, inferred }
                : null;
            })
            .filter(
              (
                item,
              ): item is {
                product: StockProduct;
                inferred: string;
              } => Boolean(item),
            );

          if (categoryMigrations.length) {
            const migrationBatch = writeBatch(db);

            categoryMigrations.forEach(
              ({ product, inferred }) => {
                migrationBatch.update(
                  doc(db, 'stock_products', product.id),
                  {
                    category: inferred,
                    updated_at: new Date().toISOString(),
                  },
                );

                product.category = inferred;
              },
            );

            void migrationBatch.commit().catch((error) => {
              console.error(
                'Falha ao persistir categorias legadas do estoque:',
                error,
              );
            });
          }

          // V24.6: completa apenas apresentações canônicas ausentes.
          // Nunca apaga/reescreve opções personalizadas nem altera saldo/histórico.
          const normalizeCatalogKey = (value: string) =>
            value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();

          const canonicalById = new Map(INITIAL_STOCK_PRODUCTS.map((item) => [item.id, item]));
          const canonicalByName = new Map(INITIAL_STOCK_PRODUCTS.map((item) => [normalizeCatalogKey(item.name), item]));

          const presentationMigrations = mergedStockProducts
            .map((product) => {
              const canonical = canonicalById.get(product.id) || canonicalByName.get(normalizeCatalogKey(product.name));
              if (!canonical?.presentations?.length) return null;
              // V24.7: conversões são expressas na unidade-base do produto.
              // Nunca injete apresentação de um catálogo canônico com unidade diferente
              // em um cadastro legado (ex.: 0,4 kg não pode virar 0,4 g).
              if (canonical.unit !== product.unit) return null;
              const existing = [...(product.presentations || [])];
              let changed = false;
              for (const item of canonical.presentations) {
                const equivalent = existing.some((current) =>
                  current.id === item.id ||
                  (
                    current.purchase_unit === item.purchase_unit &&
                    Math.abs(Number(current.conversion_quantity) - Number(item.conversion_quantity)) < 1e-7
                  )
                );
                if (!equivalent) {
                  existing.push({ ...item });
                  changed = true;
                }
              }
              return changed ? { product, presentations: existing } : null;
            })
            .filter((item): item is { product: StockProduct; presentations: NonNullable<StockProduct['presentations']> } => Boolean(item));

          if (presentationMigrations.length) {
            const presentationBatch = writeBatch(db);
            const migratedAt = new Date().toISOString();
            presentationMigrations.forEach(({ product, presentations }) => {
              product.presentations = presentations;
              product.updated_at = migratedAt;
              presentationBatch.update(
                doc(db, 'stock_products', product.id),
                sanitizeForFirebase({ presentations, updated_at: migratedAt }),
              );
            });
            void presentationBatch.commit().catch((error) => {
              console.error('Falha ao padronizar apresentações comerciais do estoque:', error);
            });
          }

          const mergedStockMovements = mergeById(fbStockMovements, get().stockMovements).sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

          const mergedPendingConfirmations = mergeCloudFirstById(fbPendingConfirmations, get().ifoodPendingConfirmations);
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

          if (siteOrderWatchReady) {
            const newSiteOrders = fbDeliveries.filter((delivery) =>
              !knownDeliveryIds.has(delivery.id) &&
              delivery.source_system === 'dfl_site' &&
              (delivery.site_order_status || '').trim().toLocaleLowerCase('pt-BR') === 'pendente'
            );
            markUnreadSiteOrders(newSiteOrders.map((delivery) => delivery.id));
            const customerById = new Map(mergedCustomers.map((item) => [item.id, item] as const));
            newSiteOrders.slice(0, 3).forEach((delivery) => {
              const customer = customerById.get(delivery.customer_id || '');
              void notifyNewSiteOrder(
                delivery.id,
                customer?.name,
                finalStoreSettings.notificationPreferences,
              );
            });
          }
          try {
            localStorage.setItem('dfl-site-order-watch-ready', '1');
          } catch {
            // Persistência indisponível: a sincronização continua normalmente.
          }

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
            motoboyAdjustments: mergeById(fbMotoboyAdjustments, get().motoboyAdjustments)
              .sort((a, b) => b.created_at.localeCompare(a.created_at)),
            storeSettings: finalStoreSettings as any,
            isSyncing: false,
            syncError: false
          });
          recordSyncDiagnostic({
            startedAt: syncStartedAt,
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - syncStartedMs,
            status: 'success',
            totalDocuments: Object.values(syncCollections).reduce(
              (sum, count) => sum + count,
              0,
            ),
            collections: syncCollections,
          });
        } catch (error) {
          // Resultado atrasado de outra conta não contamina a sessão atual.
          if (!syncOwnerStillCurrent(syncOwnerUid, get().user?.uid)) {
            set({ isSyncing: false });
            return;
          }
          console.error('Erro ao sincronizar:', error);
          set({ isSyncing: false, syncError: true });
          recordSyncDiagnostic({
            startedAt: syncStartedAt,
            finishedAt: new Date().toISOString(),
            durationMs: Date.now() - syncStartedMs,
            status: 'error',
            totalDocuments: 0,
            collections: {},
            message: error instanceof Error ? error.message : 'Falha desconhecida',
          });
          void notifySyncFailure(
            get().storeSettings.notificationPreferences,
          );
        } finally {
          initDataInFlight = false;
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
        if (routeId === 'rota-site-aguardando-confirmacao' || routeId === 'rota-aguardando-vinculo' || routeId === 'rota-resgate-recuperada') {
          const selectedDateKey = dateKey(state.selectedDate);
          const validRouteIds = new Set(state.routes.map((route) => route.id));
          return state.deliveries.filter((delivery) => {
            if (!isDeliveryFulfillment(delivery)) return false;
            if (delivery.operational_dismissed_at) return false;
            const value = deliveryDate(delivery);
            const isSelectedDate = Boolean(value) && dateKey(value) === selectedDateKey;
            if (!isSelectedDate) return false;
            if (routeId === 'rota-site-aguardando-confirmacao') return !delivery.route_id && isSiteOrderAwaitingHomeReview(delivery);
            if (routeId === 'rota-aguardando-vinculo') return !delivery.route_id && !isSiteOrderAwaitingHomeReview(delivery);
            return Boolean(delivery.route_id) && !validRouteIds.has(delivery.route_id);
          });
        }
        return state.deliveries.filter((d) => d.route_id === routeId);
      },

      getCustomerById: (customerId) => customerId ? get().customers.find((c) => c.id === customerId) : undefined,

      addRoute: async (route) => {
        const now = new Date().toISOString();
        const routeWithTimestamp: Route = {
          ...route,
          created_at: route.created_at || now,
          operational_date: route.operational_date || dateKey(route.created_at || now),
          updated_at: now,
        };
        const operationKey = routeOperationKey(routeWithTimestamp);
        if (routeCreateLocks.has(operationKey)) {
          throw new Error('Esta rota já está sendo criada. Aguarde um instante.');
        }
        // Bloqueia apenas colisão real de ID; rotas distintas podem coexistir, inclusive com o mesmo motoboy.
        const equivalent = get().routes.find((current) => current.id === routeWithTimestamp.id);
        if (equivalent) throw new Error('ROUTE_ID_COLLISION');
        routeCreateLocks.add(operationKey);
        set((state) => ({ routes: [routeWithTimestamp, ...state.routes] }));
        try {
          const safeData = sanitizeForFirebase(routeWithTimestamp);
          await setDoc(doc(db, 'routes', route.id), safeData);
        } catch (error) {
          set((state) => ({ routes: rollbackAddedEntity(state.routes, routeWithTimestamp) }));
          console.error(error);
          throw error;
        } finally {
          routeCreateLocks.delete(operationKey);
        }
      },

      updateRoute: async (routeId, data) => {
        const previousRoute = get().routes.find((route) => route.id === routeId);
        if (!previousRoute) throw new Error('Rota não encontrada.');
        const now = new Date().toISOString();
        const nextData: Partial<Route> = { ...data, updated_at: now };
        const optimisticRoute: Route = { ...previousRoute, ...nextData };
        set((state) => ({ routes: state.routes.map((route) => route.id === routeId ? optimisticRoute : route) }));
        try {
          await queueEntityWrite('routes', routeId, () => updateDoc(doc(db, 'routes', routeId), sanitizeForFirebase(nextData)));
        } catch (error) {
          set((state) => ({ routes: rollbackUpdatedEntity(state.routes, previousRoute, optimisticRoute) }));
          console.error('Erro ao atualizar rota:', error);
          throw error;
        }
      },

      startRoute: async (routeId) => {
        const previousRoutes = get().routes;
        const current = previousRoutes.find((route) => route.id === routeId);
        if (!current) throw new Error('Rota não encontrada.');
        if (isSyntheticOperationalRoute(routeId)) {
          throw new Error('Este agrupador operacional não é uma rota real. Vincule os pedidos a uma rota antes de iniciar.');
        }
        if (current.status === 'fechada') throw new Error('Reabra a rota antes de iniciá-la.');
        const routeDeliveries = get().deliveries.filter((delivery) => delivery.route_id === routeId && !isCancelledSiteDelivery(delivery));
        if (routeDeliveries.length === 0) throw new Error('Adicione pelo menos uma entrega antes de iniciar a rota.');
        if (routeDeliveries.some(isSiteOrderAwaitingConfirmation)) throw new Error('Há pedido do Site aguardando confirmação da loja. Confirme no Admin antes de iniciar a rota.');
        if (routeDeliveries.some((delivery) => isFutureScheduledDelivery(delivery))) {
          throw new Error('Há pedido agendado nesta rota que ainda não foi liberado para operação.');
        }
        if (routeStartedAt(current)) {
          const result = await kickSiteRoute(routeId, {
            reason: 'manual_recovery',
            maxAttempts: 3,
          });

          console.info(
            '[route-kick:recovery] fast lane concluída',
            result,
          );

          return;
        }

        const now = new Date().toISOString();
        const actor = get().user;
        const startedByName = actor?.displayName?.trim() || actor?.email?.split('@')[0] || 'Usuário logado';
        const audit = {
          started_by_uid: actor?.uid || undefined,
          started_by_name: startedByName,
          started_by_email: actor?.email || undefined,
        };
        const optimisticRoute: Route = { ...current, started_at: now, updated_at: now, ...audit };
        set((state) => ({
          routes: state.routes.map((r) => r.id === routeId ? optimisticRoute : r),
        }));
        try {
          await queueEntityWrite('routes', routeId, () => updateDoc(doc(db, 'routes', routeId), sanitizeForFirebase({ started_at: now, departure_time: now, updated_at: now, ...audit })));

          /*
           * Fast lane reverso:
           *
           * A persistência da rota é autoridade local. A sincronização com o
           * Site acontece logo depois e possui retry curto/event-driven.
           * Se ainda falhar, a rota NÃO volta atrás: o operador recebe
           * feedback visível e o botão "Sincronizar Site" permanece como
           * recuperação manual.
           */
          void kickSiteRoute(routeId, {
              reason: 'route_started',
              maxAttempts: 3,
            })
            .then((result) => {
            console.info(
              '[route-kick] fast lane concluída',
              result,
            );
            })
            .catch((kickError) => {
            console.warn(
              '[route-kick] falhou; fallback periódico preservado',
              kickError,
            );
            toast.warning('Rota iniciada; Site aguardando sincronização.', {
              description:
                'A saída foi salva. Se o aviso não aparecer no Site, use Reprocessar integração nas ferramentas da rota.',
              duration: 5000,
            });
            });

          const stops = groupDeliveriesByStop(routeDeliveries).length;
          void notifyRouteStarted(routeId, current.name || 'Rota', current.motoboy_name || '', startedByName, stops, routeDeliveries.length, get().storeSettings.notificationPreferences);
          void scheduleRouteDurationReminder({ ...current, started_at: now, ...audit }, get().storeSettings.notificationPreferences);
        } catch (error) {
          set((state) => ({ routes: rollbackUpdatedEntity(state.routes, current, optimisticRoute) }));
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
        const previousIndex = get().routes.findIndex((route) => route.id === routeId);
        set((state) => ({ routes: state.routes.filter((r) => r.id !== routeId) }));
        try {
          await queueEntityWrite('routes', routeId, () => deleteDoc(doc(db, 'routes', routeId)));
        } catch (error) {
          set((state) => ({ routes: rollbackDeletedEntity(state.routes, routeToDelete, previousIndex) }));
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
          set((state) => ({ motoboys: rollbackAddedEntity(state.motoboys, dataWithTimestamp) }));
          console.error(error);
          throw error;
        }
      },

      updateMotoboy: async (id, updatedData) => {
        const previousMotoboy = get().motoboys.find((item) => item.id === id);
        if (!previousMotoboy) throw new Error('Motoboy não encontrado.');
        const dataWithTimestamp: Partial<Motoboy> = { ...updatedData, updated_at: new Date().toISOString() };
        const optimisticMotoboy: Motoboy = { ...previousMotoboy, ...dataWithTimestamp };
        set((state) => ({
          motoboys: state.motoboys.map((m) => m.id === id ? optimisticMotoboy : m)
        }));
        try {
          const safeData = sanitizeForFirebase(dataWithTimestamp);
          await queueEntityWrite('motoboys', id, () => updateDoc(doc(db, 'motoboys', id), safeData));
        } catch (error) {
          set((state) => ({ motoboys: rollbackUpdatedEntity(state.motoboys, previousMotoboy, optimisticMotoboy) }));
          console.error(error);
          throw error;
        }
      },

      deleteMotoboy: async (id) => {
        const currentMotoboy = get().motoboys.find(
          (motoboy) => motoboy.id === id,
        );

        if (!currentMotoboy) {
          throw new Error('Motoboy não encontrado.');
        }

        const hasHistoricalRoute = get().routes.some(
          (route) =>
            route.motoboy_id === id ||
            (
              !route.motoboy_id &&
              route.motoboy_name
                .trim()
                .toLocaleLowerCase('pt-BR') ===
                currentMotoboy.name
                  .trim()
                  .toLocaleLowerCase('pt-BR')
            ),
        );

        if (hasHistoricalRoute) {
          throw new Error(
            'Não é possível excluir um motoboy que possui rotas. Desative o cadastro para preservar o histórico.',
          );
        }

        const previousIndex = get().motoboys.findIndex((item) => item.id === id);
        set((state) => ({ motoboys: state.motoboys.filter((m) => m.id !== id) }));
        try {
          await queueEntityWrite('motoboys', id, () => deleteDoc(doc(db, 'motoboys', id)));
        } catch (error) {
          set((state) => ({ motoboys: rollbackDeletedEntity(state.motoboys, currentMotoboy, previousIndex) }));
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
          set((state) => ({ fuelings: rollbackAddedEntity(state.fuelings, dataWithTimestamp) }));
          console.error('Erro ao adicionar compra de estoque:', error);
          throw error;
        }
      },

      updateFueling: async (id, updatedData) => {
        const previousFueling = get().fuelings.find((item) => item.id === id);
        if (!previousFueling) throw new Error('Compra não encontrada.');
        const dataWithTimestamp: Partial<Fueling> = {
          ...updatedData,
          updated_at: new Date().toISOString(),
        };
        const optimisticFueling: Fueling = { ...previousFueling, ...dataWithTimestamp };
        set((state) => ({
          fuelings: state.fuelings.map((item) =>
            item.id === id ? optimisticFueling : item
          ),
        }));
        try {
          await queueEntityWrite('fuelings', id, () => updateDoc(doc(db, 'fuelings', id), sanitizeForFirebase(dataWithTimestamp)));
        } catch (error) {
          set((state) => ({ fuelings: rollbackUpdatedEntity(state.fuelings, previousFueling, optimisticFueling) }));
          console.error('Erro ao atualizar compra de estoque:', error);
          throw error;
        }
      },

      deleteFueling: async (id) => {
        const previousFuelings = get().fuelings;
        const previousFueling = previousFuelings.find((item) => item.id === id);
        const previousIndex = previousFuelings.findIndex((item) => item.id === id);
        set((state) => ({ fuelings: state.fuelings.filter((item) => item.id !== id) }));
        try {
          await queueEntityWrite('fuelings', id, () => deleteDoc(doc(db, 'fuelings', id)));
        } catch (error) {
          set((state) => ({ fuelings: rollbackDeletedEntity(state.fuelings, previousFueling, previousIndex) }));
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

        if (
          updatedData.status === 'conferido' &&
          !current.stock_integrated_at
        ) {
          throw new Error(
            'Conferido é resultado da integração real com o estoque. Marque como recebido e use Conferir e lançar no estoque.',
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
        const before = get().stockSupplies;
        const current = before.find((item) => item.id === id);
        if (current?.stock_integrated_at) throw new Error('Compra já integrada ao estoque e não pode ser excluída.');
        const originalIndex = before.findIndex((item) => item.id === id);
        set((state) => ({ stockSupplies: state.stockSupplies.filter((item) => item.id !== id) }));
        try {
          await deleteDoc(doc(db, 'stock_supplies', id));
        } catch (error) {
          set((state) => ({ stockSupplies: rollbackDeletedEntity(state.stockSupplies, current, originalIndex) }));
          throw error;
        }
      },

      addStockSupplier: async (supplier) => {
        set((state) => ({ stockSuppliers: [...state.stockSuppliers, supplier].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }));
        try { await setDoc(doc(db, 'stock_suppliers', supplier.id), sanitizeForFirebase(supplier)); }
        catch (error) {
          set((state) => ({ stockSuppliers: rollbackAddedEntity(state.stockSuppliers, supplier) }));
          throw error;
        }
      },

      updateStockSupplier: async (id, data) => {
        const current = get().stockSuppliers.find((item) => item.id === id);
        if (!current) throw new Error('Fornecedor não encontrado.');
        const next = { ...data, updated_at: new Date().toISOString() };
        const optimistic = { ...current, ...next };
        set((state) => ({ stockSuppliers: state.stockSuppliers.map((item) => item.id === id ? optimistic : item) }));
        try { await queueEntityWrite('stock_suppliers', id, () => updateDoc(doc(db, 'stock_suppliers', id), sanitizeForFirebase(next))); }
        catch (error) {
          set((state) => ({ stockSuppliers: rollbackUpdatedEntity(state.stockSuppliers, current, optimistic) }));
          throw error;
        }
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
        set((state) => ({ teamMembers: [...state.teamMembers, member].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) }));
        try { await setDoc(doc(db, 'team_members', member.id), sanitizeForFirebase(member)); }
        catch (error) {
          set((state) => ({ teamMembers: rollbackAddedEntity(state.teamMembers, member) }));
          throw error;
        }
      },

      updateTeamMember: async (id, data) => {
        const current = get().teamMembers.find((item) => item.id === id);
        if (!current) throw new Error('Integrante da equipe não encontrado.');
        const next = { ...data, updated_at: new Date().toISOString() };
        const optimistic = { ...current, ...next };
        set((state) => ({ teamMembers: state.teamMembers.map((item) => item.id === id ? optimistic : item) }));
        try { await queueEntityWrite('team_members', id, () => updateDoc(doc(db, 'team_members', id), sanitizeForFirebase(next))); }
        catch (error) {
          set((state) => ({ teamMembers: rollbackUpdatedEntity(state.teamMembers, current, optimistic) }));
          throw error;
        }
      },

      addStockProduct: async (product) => {
        const initial = product.current_quantity > 0 ? { id: `initial-${product.id}`, product_id: product.id, product_name: product.name, type: 'entrada' as const, quantity: product.current_quantity, balance_before: 0, balance_after: product.current_quantity, unit_cost: product.average_cost, reason: 'Saldo inicial do cadastro', occurred_at: product.created_at, created_at: product.created_at } : null;
        set((state) => ({
          stockProducts: [...state.stockProducts, product].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
          stockMovements: initial ? [initial, ...state.stockMovements] : state.stockMovements,
        }));
        try {
          const batch = writeBatch(db);
          batch.set(doc(db, 'stock_products', product.id), sanitizeForFirebase(product));
          if (initial) batch.set(doc(db, 'stock_movements', initial.id), sanitizeForFirebase(initial));
          await batch.commit();
        } catch (error) {
          set((state) => ({
            stockProducts: rollbackAddedEntity(state.stockProducts, product),
            stockMovements: initial ? rollbackAddedEntity(state.stockMovements, initial) : state.stockMovements,
          }));
          throw error;
        }
      },

      updateStockProduct: async (id, data) => {
        const previous = get().stockProducts;
        const current = previous.find((item) => item.id === id);
        if (!current) throw new Error('Produto de estoque não encontrado.');

        const hasHistory = get().stockMovements.some(
          (movement) => movement.product_id === id,
        );

        // Categoria é classificação atual e pode evoluir sem reescrever o histórico.
        // Unidade é contrato quantitativo e fica imutável após a primeira movimentação.
        if (hasHistory && data.unit && data.unit !== current.unit) {
          throw new Error(
            'A unidade de controle não pode ser alterada porque este produto já possui histórico.',
          );
        }

        const next = { ...data, updated_at: new Date().toISOString() };
        const optimistic = { ...current, ...next };
        set((state) => ({ stockProducts: state.stockProducts.map((item) => item.id === id ? optimistic : item) }));
        try { await queueEntityWrite('stock_products', id, () => updateDoc(doc(db, 'stock_products', id), sanitizeForFirebase(next))); }
        catch (error) { set((state) => ({ stockProducts: rollbackUpdatedEntity(state.stockProducts, current, optimistic) })); throw error; }
      },

      cleanupDuplicateStockProducts: async () => {
        const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').trim();
        const products = get().stockProducts;
        const movements = get().stockMovements;
        const groups = new Map<string, StockProduct[]>();
        for (const product of products) {
          const key = normalize(product.name);
          if (!key) continue;
          const list = groups.get(key) || [];
          list.push(product); groups.set(key, list);
        }
        let deleted = 0, archived = 0, groupCount = 0;
        const deleteIds = new Set<string>();
        const archiveIds = new Set<string>();
        for (const list of groups.values()) {
          if (list.length < 2) continue;
          groupCount++;
          const scored = [...list].sort((a,b) => {
            const ah = movements.some(m=>m.product_id===a.id) ? 1 : 0;
            const bh = movements.some(m=>m.product_id===b.id) ? 1 : 0;
            if (ah !== bh) return bh-ah;
            if (a.active !== b.active) return Number(b.active)-Number(a.active);
            return (new Date(a.created_at||0).getTime()||0)-(new Date(b.created_at||0).getTime()||0);
          });
          const keep = scored[0];
          for (const duplicate of scored.slice(1)) {
            const hasHistory = movements.some(m=>m.product_id===duplicate.id);
            if (hasHistory) archiveIds.add(duplicate.id);
            else deleteIds.add(duplicate.id);
          }
          deleteIds.delete(keep.id); archiveIds.delete(keep.id);
        }
        if (!deleteIds.size && !archiveIds.size) return { deleted:0, archived:0, groups:groupCount };
        const previous = get().stockProducts;
        set({ stockProducts: previous.filter(p=>!deleteIds.has(p.id)).map(p=>archiveIds.has(p.id)?{...p,active:false,updated_at:new Date().toISOString()}:p) });
        try {
          const ops = [...deleteIds].map(id=>deleteDoc(doc(db,'stock_products',id)));
          const now = new Date().toISOString();
          ops.push(...[...archiveIds].map(id=>updateDoc(doc(db,'stock_products',id),{active:false,updated_at:now})));
          await Promise.all(ops);
          deleted=deleteIds.size; archived=archiveIds.size;
          return {deleted,archived,groups:groupCount};
        } catch(error) {
          set({stockProducts:previous});
          throw error;
        }
      },

      addStockMovement: async (movement) => {
        // A origem de verdade é o saldo confirmado pelo servidor. Uma cópia local
        // antiga NUNCA deve escrever um novo saldo baseado nela.
        if (get().stockMovements.some((item) => item.id === movement.id)) return;
        let result: ReturnType<typeof planStockMovement> & { alreadyExisted: boolean };
        const lastServerRead: { current: StockProduct | null } = { current: null };
        try {
          result = await runTransaction(db, async (transaction) => {
            const productRef = doc(db, 'stock_products', movement.product_id);
            const movementRef = doc(db, 'stock_movements', movement.id);
            // Todas as leituras ocorrem antes das escritas, como exige Firestore.
            const [productSnap, priorMovement] = await Promise.all([
              transaction.get(productRef), transaction.get(movementRef),
            ]);
            if (!productSnap.exists()) throw new Error('Produto de estoque não encontrado no servidor.');
            const currentProduct = productSnap.data() as StockProduct;
            lastServerRead.current = currentProduct;
            if (priorMovement.exists()) {
              // O ID já foi gravado em outro aparelho. Hidratar a store local
              // para não continuar sugerindo a mesma baixa; nunca duplicar o lançamento.
              const recorded = priorMovement.data() as StockMovement;
              if (recorded.product_id !== movement.product_id) throw new Error('Identificador de movimentação já utilizado por outro produto.');
              return { before: currentProduct, changed: currentProduct, record: recorded, alreadyExisted: true };
            }
            const now = new Date().toISOString();
            const plan = planStockMovement(currentProduct, movement, now);
            transaction.update(productRef, sanitizeForFirebase(plan.changed));
            transaction.set(movementRef, sanitizeForFirebase(plan.record));
            return { ...plan, alreadyExisted: false };
          });
        } catch (error) {
          const fresh = lastServerRead.current;
          if (fresh && error instanceof Error && /mudou em outro aparelho|Saldo insuficiente/.test(error.message)) {
            set((state) => ({
              stockProducts: state.stockProducts.map((item) => item.id === fresh.id ? fresh : item),
            }));
          }
          if (stockWriteConnectionError(error)) {
            throw new Error('Não foi possível confirmar o saldo no servidor. Confira a conexão e tente novamente; a movimentação não foi confirmada.');
          }
          throw error;
        }
        // Só refletir na interface depois da confirmação transacional.
        set((state) => ({
          stockProducts: state.stockProducts.map((item) => item.id === result.changed.id ? result.changed : item),
          stockMovements: [result.record, ...state.stockMovements.filter((item) => item.id !== result.record.id)],
        }));
        if (result.alreadyExisted) return; // não disparar notificações novamente
        const reviewActive = typeof window !== 'undefined' && Boolean(sessionStorage.getItem('dfl-stock-review-queue'));
        const thresholdChange = { before: result.before, after: result.changed };
        if (reviewActive) {
          try {
            const current = JSON.parse(sessionStorage.getItem('dfl-stock-review-changes') || '[]');
            sessionStorage.setItem('dfl-stock-review-changes', JSON.stringify([...current, thresholdChange]));
          } catch { sessionStorage.setItem('dfl-stock-review-changes', JSON.stringify([thresholdChange])); }
        } else {
          void notifyStockThresholdChanges([thresholdChange], get().storeSettings.notificationPreferences);
        }
      },

      integrateStockSupply: async (id) => {
        await waitForStockSupplyWrite(id);
        const result = await runTransaction(db, async (transaction) => {
          const supplyRef = doc(db, 'stock_supplies', id);
          const supplySnap = await transaction.get(supplyRef);
          if (!supplySnap.exists()) throw new Error('Compra não encontrada.');
          const supply = supplySnap.data() as StockSupply;
          if (supply.stock_integrated_at) return null;
          if (supply.status !== 'recebido') {
            throw new Error(supply.status === 'conferido'
              ? 'Compra legada conferida sem integração. Volte para Recebido antes de lançar no estoque.'
              : 'Marque a compra como recebida antes de conferir.');
          }
          // Uma leitura por produto distinto; evita snapshot desatualizado quando
          // a mesma compra inclui múltiplas linhas do mesmo insumo.
          const groups = groupStockSupplyItems(supply);
          const keys = [...groups.keys()];
          const refs = keys.map((productId) => doc(db, 'stock_products', productId));
          const snaps = await Promise.all(refs.map((ref) => transaction.get(ref)));
          const products = new Map<string, StockProduct>();
          snaps.forEach((snap, index) => {
            if (snap.exists()) products.set(keys[index], snap.data() as StockProduct);
          });
          const now = new Date().toISOString();
          const plan = planStockSupplyLedger(supply, products, 'integrate', now);
          plan.changed.forEach((product) => {
            transaction.update(doc(db, 'stock_products', product.id), sanitizeForFirebase(product));
          });
          plan.records.forEach((record) => {
            transaction.set(doc(db, 'stock_movements', record.id), sanitizeForFirebase(record));
          });
          const supplyPatch: Partial<StockSupply> = {
            status: 'conferido', checked_at: supply.checked_at || now,
            stock_integrated_at: now, updated_at: now,
          };
          transaction.update(supplyRef, sanitizeForFirebase(supplyPatch));
          return { ...plan, supplyPatch };
        });
        if (!result) return;
        const changedMap = new Map(result.changed.map((item) => [item.id, item]));
        const recordIds = new Set(result.records.map((item) => item.id));
        // A transação já confirmou no servidor: não substituir outras mudanças
        // recebidas na store durante a espera.
        set((state) => ({
          stockProducts: state.stockProducts.map((item) => changedMap.get(item.id) || item),
          stockMovements: [...result.records, ...state.stockMovements.filter((item) => !recordIds.has(item.id))],
          stockSupplies: state.stockSupplies.map((item) => item.id === id ? { ...item, ...result.supplyPatch } : item),
        }));
        void cancelStockSupplyCheckReminder(id);
      },

      reverseStockSupply: async (id) => {
        await waitForStockSupplyWrite(id);
        const beforeLocal = get().stockProducts;
        const result = await runTransaction(db, async (transaction) => {
          const supplyRef = doc(db, 'stock_supplies', id);
          const supplySnap = await transaction.get(supplyRef);
          if (!supplySnap.exists()) throw new Error('Compra não encontrada.');
          const supply = supplySnap.data() as StockSupply;
          if (!supply.stock_integrated_at) throw new Error('Esta compra ainda não foi integrada.');
          if (supply.stock_reversed_at) return null;
          const groups = groupStockSupplyItems(supply);
          const keys = [...groups.keys()];
          const refs = keys.map((productId) => doc(db, 'stock_products', productId));
          const snaps = await Promise.all(refs.map((ref) => transaction.get(ref)));
          const products = new Map<string, StockProduct>();
          snaps.forEach((snap, index) => {
            if (snap.exists()) products.set(keys[index], snap.data() as StockProduct);
          });
          const now = new Date().toISOString();
          const plan = planStockSupplyLedger(supply, products, 'reverse', now);
          plan.changed.forEach((product) => {
            transaction.update(doc(db, 'stock_products', product.id), sanitizeForFirebase({
              ...product, average_cost: product.average_cost ?? deleteField(),
            }));
          });
          plan.records.forEach((record) => {
            transaction.set(doc(db, 'stock_movements', record.id), sanitizeForFirebase(record));
          });
          const supplyPatch: Partial<StockSupply> = { stock_reversed_at: now, updated_at: now };
          transaction.update(supplyRef, sanitizeForFirebase(supplyPatch));
          return { ...plan, supplyPatch };
        });
        if (!result) return;
        const changedMap = new Map(result.changed.map((item) => [item.id, item]));
        const recordIds = new Set(result.records.map((item) => item.id));
        set((state) => ({
          stockProducts: state.stockProducts.map((item) => changedMap.get(item.id) || item),
          stockMovements: [...result.records, ...state.stockMovements.filter((item) => !recordIds.has(item.id))],
          stockSupplies: state.stockSupplies.map((item) => item.id === id ? { ...item, ...result.supplyPatch } : item),
        }));
        void notifyStockThresholdChanges(
          result.changed.map((after) => ({
            before: beforeLocal.find((item) => item.id === after.id) || after,
            after,
          })),
          get().storeSettings.notificationPreferences,
        );
      },

      countStockProducts: async (counts, responsible) => {
        if (!counts.length) return;
        // 2 escritas por item (produto + movimento); limite conservador
        // para preservar atomicidade e evitar lotes acima do limite Firestore.
        if (counts.length > 200) throw new Error('Confira até 200 produtos por vez. Divida a contagem para manter cada lote atômico.');
        // Validar antes de abrir a transação, incluindo referências duplicadas.
        const ids = new Set<string>();
        for (const row of counts) {
          if (!row.product_id || ids.has(row.product_id)) throw new Error('Produto duplicado na contagem física. Revise os itens antes de salvar.');
          if (!Number.isFinite(row.quantity) || row.quantity < 0) throw new Error('Quantidade de contagem inválida.');
          if (!Number.isFinite(row.expected_quantity) || row.expected_quantity < 0) {
            throw new Error('Saldo original da contagem ausente. Reabra a conferência para evitar sobrescrever outra movimentação.');
          }
          ids.add(row.product_id);
        }
        // Identificador único por tentativa, criado FORA do callback que o SDK pode repetir.
        const operationId = `count-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        let result: ReturnType<typeof planStockCount>;
        const latestProducts = new Map<string, StockProduct>();
        try {
          result = await runTransaction(db, async (transaction) => {
            const refs = counts.map((row) => doc(db, 'stock_products', row.product_id));
            const snaps = await Promise.all(refs.map((ref) => transaction.get(ref)));
            const products = new Map<string, StockProduct>();
            snaps.forEach((snap, index) => {
              if (snap.exists()) {
                const remoteProduct = snap.data() as StockProduct;
                products.set(counts[index].product_id, remoteProduct);
                latestProducts.set(remoteProduct.id, remoteProduct);
              }
            });
            const now = new Date().toISOString();
            const plan = planStockCount(counts, products, operationId, now, responsible);
            // Se algum produto mudou desde que a contagem foi iniciada,
            // o planejador lança erro e NENHUMA escrita é feita.
            plan.changed.forEach((product) => {
              transaction.update(doc(db, 'stock_products', product.id), sanitizeForFirebase(product));
            });
            plan.records.forEach((record) => {
              transaction.set(doc(db, 'stock_movements', record.id), sanitizeForFirebase(record));
            });
            return plan;
          });
        } catch (error) {
          if (latestProducts.size && error instanceof Error && /mudou em outro aparelho/.test(error.message)) {
            set((state) => ({
              stockProducts: state.stockProducts.map((item) => latestProducts.get(item.id) || item),
            }));
          }
          if (stockWriteConnectionError(error)) {
            throw new Error('Sem confirmação do servidor para a contagem. Mantenha o rascunho e tente novamente com internet.');
          }
          throw error;
        }
        const changed = new Map(result.changed.map((item) => [item.id, item]));
        const records = new Set(result.records.map((item) => item.id));
        set((state) => ({
          stockProducts: state.stockProducts.map((item) => changed.get(item.id) || item),
          stockMovements: [...result.records, ...state.stockMovements.filter((item) => !records.has(item.id))],
        }));
        void notifyStockThresholdChanges(
          result.changed.map((after) => ({ before: result.before.get(after.id) || after, after })),
          get().storeSettings.notificationPreferences,
        );
      },

      addDelivery: async (delivery) => {
        if (isCancelledSiteDelivery(delivery)) throw new Error('Pedido cancelado não pode ser importado como entrega ativa.');
        const mutationKey = `delivery:add:${delivery.id}`;
        if (deliveryMutationLocks.has(mutationKey)) return;
        if (get().deliveries.some((current) => sameExternalDelivery(current, delivery))) {
          throw new Error('Este pedido já foi importado. Abra a entrega existente.');
        }
        deliveryMutationLocks.add(mutationKey);
        const now = new Date().toISOString();
        const siblings = get().deliveries.filter((item) => item.route_id === delivery.route_id && !item.completed && !isCancelledSiteDelivery(item));
        const siblingIndexes = siblings.map((item) => item.order_index).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        const minIndex = siblingIndexes.length ? Math.min(...siblingIndexes) : 0;
        const maxIndex = siblingIndexes.length ? Math.max(...siblingIndexes) : -1;
        const automaticIndex = delivery.is_urgent ? minIndex - 1 : maxIndex + 1;
        const deliveryWithTimestamp = {
          ...delivery,
          // Urgência entra no topo e fica fixada até destravamento explícito.
          order_index: delivery.is_urgent ? automaticIndex : delivery.order_index ?? automaticIndex,
          order_locked: delivery.is_urgent ? true : delivery.order_locked,
          order_source: delivery.is_urgent ? 'manual' : delivery.order_source || 'smart',
          order_updated_at: delivery.order_updated_at || now,
          createdAt: delivery.createdAt || delivery.created_at || now,
          created_at: delivery.created_at || delivery.createdAt || now,
          updated_at: now
        } as Delivery;

        set((state) => ({ deliveries: [deliveryWithTimestamp, ...state.deliveries] }));

        try {
          const safeData = sanitizeForFirebase(deliveryWithTimestamp);
          await queueEntityWrite('deliveries', delivery.id, () => setDoc(doc(db, 'deliveries', delivery.id), safeData));
          if (deliveryWithTimestamp.route_id && !deliveryWithTimestamp.is_urgent) {
            try {
              await autoOrganizeLoadedRouteAfterInsert(deliveryWithTimestamp.route_id, get().deliveries, get().customers, get().storeSettings);
            } catch (organizeError) {
              console.warn('Auto-organização incremental não aplicada:', organizeError);
            }
          }
        } catch (error) {
          set((state) => ({ deliveries: rollbackAddedEntity(state.deliveries, deliveryWithTimestamp) }));
          console.error(error);
          throw error;
        } finally {
          deliveryMutationLocks.delete(mutationKey);
        }
      },

      addDeliveries: async (items) => {
        if (!items.length) return;
        if (items.some(isCancelledSiteDelivery)) throw new Error('O lote contém pedido cancelado. Revise antes de importar.');
        const existing = get().deliveries;
        const duplicated = items.find((item, index) =>
          existing.some((current) => sameExternalDelivery(current, item)) ||
          items.slice(0, index).some((current) => sameExternalDelivery(current, item))
        );
        if (duplicated) {
          throw new Error('Um dos pedidos deste lote já foi importado. Revise os IDs antes de salvar.');
        }
        const now = new Date().toISOString();
        const routeTail = new Map<string, number>();
        const routeHead = new Map<string, number>();
        get().deliveries.filter((item)=>!item.completed && !isCancelledSiteDelivery(item)).forEach((item)=>{
          const index = typeof item.order_index === 'number' && Number.isFinite(item.order_index) ? item.order_index : 0;
          routeTail.set(item.route_id, Math.max(routeTail.get(item.route_id) ?? -1, index));
          routeHead.set(item.route_id, Math.min(routeHead.get(item.route_id) ?? 0, index));
        });
        const prepared = items.map((delivery) => {
          const tail = routeTail.get(delivery.route_id) ?? -1;
          const head = routeHead.get(delivery.route_id) ?? 0;
          const nextIndex = delivery.is_urgent ? head - 1 : tail + 1;
          if (delivery.is_urgent) routeHead.set(delivery.route_id, nextIndex);
          else routeTail.set(delivery.route_id, nextIndex);
          return {
            ...delivery,
            order_index: delivery.is_urgent ? nextIndex : delivery.order_index ?? nextIndex,
            order_locked: delivery.is_urgent ? true : delivery.order_locked,
            order_source: delivery.is_urgent ? 'manual' : delivery.order_source || 'smart',
            order_updated_at: delivery.order_updated_at || now,
            createdAt: delivery.createdAt || delivery.created_at || now,
            created_at: delivery.created_at || delivery.createdAt || now,
            updated_at: now,
          } as Delivery;
        });
        set((state) => ({ deliveries: [...prepared, ...state.deliveries] }));
        try {
          const batch = writeBatch(db);
          prepared.forEach((delivery) => batch.set(
            doc(db, 'deliveries', delivery.id),
            sanitizeForFirebase(delivery),
          ));
          await queueDeliveryDocuments(queueEntityWrite, prepared.map((delivery) => delivery.id), () => batch.commit());
          const touchedRoutes = Array.from(new Set(prepared.map((delivery) => delivery.route_id).filter(Boolean)));
          for (const touchedRouteId of touchedRoutes) {
            // Não desfazer, no mesmo cadastro, a prioridade fixada de uma urgência.
            if (prepared.some((delivery) => delivery.route_id === touchedRouteId && delivery.is_urgent)) continue;
            try {
              await autoOrganizeLoadedRouteAfterInsert(
                touchedRouteId,
                get().deliveries,
                get().customers,
                get().storeSettings,
              );
            } catch (organizeError) {
              console.warn('Auto-organização do lote não aplicada:', organizeError);
            }
          }
        } catch (error) {
          set((state) => ({ deliveries: rollbackAddedEntities(state.deliveries, prepared), syncError: true }));
          console.error('Erro ao adicionar pedidos em lote:', error);
          throw error;
        }
      },

      // R66: Firestore e a autoridade final. Nenhuma Delivery/Route duplicada e criada
      // pela Caixa. Em cancelamento ou confirmacao tardia a transacao e reavaliada.
      allocateSiteDelivery: async (deliveryId, target) => {
        if (deliveryMutationLocks.has(`site-allocate:${deliveryId}`)) throw new Error('Ja existe uma alocacao em andamento para este pedido.');
        deliveryMutationLocks.add(`site-allocate:${deliveryId}`);
        try {
          const initial = get();
          // A UI e o Store precisam negar uma identidade externa em colisao.
          // O Firestore continua sendo revalidado na transacao abaixo.
          const localCandidate = siteInboxProjection(initial.deliveries).rows.find(row => row.delivery.id === deliveryId);
          if (!localCandidate || localCandidate.state !== 'pronto' || localCandidate.duplicate) {
            throw new Error('Pedido ainda não liberado ou identidade duplicada. Sincronize e revise na Caixa.');
          }
          const chosenMotoboy = 'newRoute' in target ? initial.motoboys.find(item => item.id === target.newRoute.motoboyId && item.active) : null;
          if ('newRoute' in target && (!chosenMotoboy || !target.newRoute.name.trim())) throw new Error('Informe o nome da rota e um motoboy ativo.');
          const now = new Date();
          const nowIso = now.toISOString();
          const routeId = 'newRoute' in target
            ? `site-route-${now.getTime()}-${Math.random().toString(36).slice(2, 11)}`
            : target.routeId;
          if (!routeId || isSyntheticOperationalRoute(routeId)) throw new Error('Rota de destino invalida.');
          const deliveryRef = doc(db, 'deliveries', deliveryId);
          const routeRef = doc(db, 'routes', routeId);
          const saved = await runTransaction(db, async (transaction) => {
            const deliverySnap = await transaction.get(deliveryRef);
            const routeSnap = await transaction.get(routeRef);
            if (!deliverySnap.exists()) throw new Error('Pedido não encontrado no Firestore. Sincronize a Caixa.');
            const remoteDelivery = { ...deliverySnap.data(), id: deliverySnap.id } as Delivery;
            let route: Route;
            if ('newRoute' in target) {
              if (routeSnap.exists()) throw new Error('Identificador de rota já utilizado. Tente novamente.');
              route = { id: routeId, name: target.newRoute.name.trim(), status: 'aberta',
                motoboy_id: chosenMotoboy!.id, motoboy_name: chosenMotoboy!.name,
                change_money: 0, drinks_summary: '', created_at: nowIso,
                operational_date: dateKey(now), updated_at: nowIso };
            } else {
              if (!routeSnap.exists()) throw new Error('A rota selecionada não existe mais.');
              route = { ...routeSnap.data(), id: routeSnap.id } as Route;
            }
            // Endereco revisado no mesmo ato de alocacao tambem pode
            // corrigir pedido recebido sem rua completa, sem criar clone.
            assertSiteRouteAllocation({
              ...remoteDelivery,
              address_string: target.operational?.address_string?.trim() || remoteDelivery.address_string,
            }, route, now.getTime());
            // Uma única transação conserva o ID, status e autoridade comercial.
            // Alterações operacionais explícitas não criam outro pedido.
            const draft = target.operational;
            const patch: Record<string, unknown> = {};
            if (draft) {
              if (typeof draft.address_string === 'string') {
                if (!draft.address_string.trim()) throw new Error('Informe o endereço antes da alocação.');
                patch.address_string = draft.address_string.trim();
              }
              if (typeof draft.phone === 'string') patch.phone = draft.phone.trim();
              if (typeof draft.observation === 'string') patch.observation = draft.observation.trim();
              if (draft.payment_method !== undefined) {
                if (!['dinheiro','pix','cartao','cartao_credito','cartao_debito'].includes(draft.payment_method)) throw new Error('Pagamento operacional inválido.');
                patch.payment_method = draft.payment_method;
                patch.payment_state = paymentStateForInput(draft.payment_method, Boolean(remoteDelivery.is_paid));
                patch.site_operational_payment_override = true;
              }
            }
            transaction.update(deliveryRef, { route_id: routeId, ...patch, updated_at: nowIso });
            if ('newRoute' in target) transaction.set(routeRef, sanitizeForFirebase(route));
            return { remoteDelivery, route, operational: patch };
          });
          set(state => ({
            routes: 'newRoute' in target && !state.routes.some(item => item.id === routeId)
              ? [saved.route, ...state.routes] : state.routes,
            deliveries: state.deliveries.map(item => item.id === deliveryId
              ? { ...item, ...saved.operational, route_id: routeId, updated_at: nowIso } as Delivery : item),
          }));
          return routeId;
        } finally {
          deliveryMutationLocks.delete(`site-allocate:${deliveryId}`);
        }
      },

      updateDelivery: async (id, updatedData) => {
        const state = get();
        const deliveryToUpdate = state.deliveries.find((d) => d.id === id);
        if (!deliveryToUpdate) throw new Error('Entrega não encontrada.');

        if (isCancelledSiteDelivery(deliveryToUpdate)) {
          throw new Error(
            'Pedido cancelado: alterações operacionais bloqueadas. O histórico comercial deve ser preservado.',
          );
        }

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
        const urgencyChanged =
          updatedData.is_urgent !== undefined &&
          updatedData.is_urgent !== deliveryToUpdate.is_urgent;
        const targetRoutePending = routeChanged && nextRouteId
          ? state.deliveries.filter((item) => item.id !== id && item.route_id === nextRouteId && !item.completed)
          : [];
        const targetIndexes = targetRoutePending
          .map((item) => item.order_index)
          .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        const movedOrderIndex = routeChanged && nextRouteId
          ? updatedData.is_urgent
            ? (targetIndexes.length ? Math.min(...targetIndexes) : 0) - 1
            : (targetIndexes.length ? Math.max(...targetIndexes) : -1) + 1
          : undefined;

        if (isCompleting && isDeliveryFulfillment(deliveryToUpdate)) {
          const operationalRouteId = nextRouteId?.trim();

          if (!operationalRouteId || isSyntheticOperationalRoute(operationalRouteId)) {
            throw new Error(
              'Vincule esta entrega a uma rota real antes de dar baixa.',
            );
          }

          const operationalRoute = state.routes.find(
            (route) => route.id === operationalRouteId,
          );

          if (!operationalRoute) {
            throw new Error(
              'A rota desta entrega não existe mais. Corrija o vínculo antes de dar baixa.',
            );
          }

          if (operationalRoute.status !== 'aberta') {
            throw new Error(
              'A baixa só pode ser feita enquanto a rota operacional estiver aberta.',
            );
          }

          if (!routeStartedAt(operationalRoute)) {
            throw new Error(
              'Inicie a rota antes de dar baixa nesta entrega.',
            );
          }
        }

        const urgentPlacementNeeded = Boolean(
          nextRouteId && !deliveryToUpdate.completed &&
          (routeChanged || urgencyChanged) &&
          (updatedData.is_urgent ?? deliveryToUpdate.is_urgent),
        );
        const urgentIndices = urgentPlacementNeeded
          ? state.deliveries
              .filter((item) => item.id !== id && item.route_id === nextRouteId && !item.completed)
              .map((item) => item.order_index)
              .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
          : [];
        const urgentTopIndex = urgentIndices.length ? Math.min(...urgentIndices) - 1 : -1;
        const dataWithTimestamp: Partial<Delivery> = {
          ...updatedData,
          ...(routeChanged && nextRouteId
            ? {
                order_index: movedOrderIndex,
                order_locked: false,
                order_source: 'smart' as const,
                order_updated_at: now,
              }
            : {}),
          ...(urgentPlacementNeeded
            ? {
                order_index: urgentTopIndex,
                order_locked: true,
                order_source: 'manual' as const,
                order_updated_at: now,
              }
            : {}),
          ...(isCompleting ? { completed_at: now } : {}),
          ...(isCompleting && !isDeliveryFulfillment(deliveryToUpdate) && deliveryToUpdate.source_system !== 'dfl_site'
            ? { analytics_sync_pending: true, analytics_sync_requested_at: now }
            : {}),
          updated_at: now,
        };
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
            totalSpent: completedForCustomer.reduce(
              (total, item) => total + deliveryCustomerCharge(item),
              0,
            ),
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

        const optimisticCustomer: Customer | undefined = updatedCustomerData && customer
          ? { ...customer, ...updatedCustomerData }
          : undefined;
        set((current) => ({
          deliveries: current.deliveries.map((d) => d.id === id ? nextDelivery : d),
          customers: optimisticCustomer
            ? current.customers.map((item) => item.id === optimisticCustomer.id ? optimisticCustomer : item)
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
          if (isCompleting || isReopening || routeChanged) {
            // R95: validação REMOTA somente para transições críticas. Edições
            // comuns continuam com batch e SEM leitura Firestore adicional.
            const commitCritical = () => runTransaction(db, async (transaction) => {
              const deliveryRef = doc(db, 'deliveries', id);
              const currentSnap = await transaction.get(deliveryRef);
              const needsRoute = Boolean(nextRouteId && (routeChanged || isDeliveryFulfillment(deliveryToUpdate)));
              const routeSnap = needsRoute ? await transaction.get(doc(db, 'routes', nextRouteId)) : null;
              const remoteDelivery = currentSnap.exists() ? { ...currentSnap.data(), id: currentSnap.id } as Delivery : null;
              const remoteRoute = routeSnap?.exists() ? { ...routeSnap.data(), id: nextRouteId } as Route : null;
              assertRemoteDeliveryTransition(deliveryToUpdate, remoteDelivery, dataWithTimestamp, remoteRoute, needsRoute);
              transaction.update(deliveryRef, safeData);
              if (updatedCustomerData && customer) {
                transaction.update(doc(db, 'customers', customer.id), sanitizeForFirebase(updatedCustomerData));
              }
            });
            await queueDeliveryDocuments(queueEntityWrite, [id], () =>
              updatedCustomerData && customer
                ? queueEntityWrite('customers', customer.id, commitCritical)
                : commitCritical()
            );
          } else {
            await queueDeliveryDocuments(queueEntityWrite, [id], () => batch.commit());
          }
          deliveryCommitCompleted = true;

          // Urgência pertence à parada física. Todos os pedidos do mesmo
          // endereço recebem o mesmo estado e, ao ativar, a parada inteira vai
          // para o topo por meio da mesma autoridade usada por setas e drag.
          if (urgencyChanged && nextDelivery.route_id && !nextDelivery.completed) {
            const currentState = get();
            const routeItems = currentState.deliveries.filter(
              (item) => item.route_id === nextDelivery.route_id && !item.completed,
            );
            const groupedIds = stopDeliveryIds(routeItems, nextDelivery.id);
            const siblingIds = groupedIds.filter((groupedId) => groupedId !== nextDelivery.id);
            if (siblingIds.length) {
              const urgencyBatch = writeBatch(db);
              siblingIds.forEach((groupedId) => urgencyBatch.update(
                doc(db, 'deliveries', groupedId),
                { is_urgent: updatedData.is_urgent === true, updated_at: now },
              ));
              set((current) => ({
                deliveries: current.deliveries.map((item) =>
                  siblingIds.includes(item.id)
                    ? { ...item, is_urgent: updatedData.is_urgent === true, updated_at: now }
                    : item
                ),
              }));
              await urgencyBatch.commit();
            }
            if (updatedData.is_urgent === true) {
              await get().setDeliveryOrder(
                nextDelivery.route_id,
                moveStopToIndex(get().deliveries.filter(
                  (item) => item.route_id === nextDelivery.route_id && !item.completed,
                ), nextDelivery.id, 0),
                { metadata: { order_source: 'manual', order_updated_at: now } },
              );
            }
          }

          /*
           * Mudança logística real:
           * após persistir a conclusão, acordamos SOMENTE a rota dessa
           * delivery. O mesmo kick materializa delivery.completed e a nova
           * posição/next_stop das demais paradas.
           *
           * O retry é curto e dirigido; não existe listener nem polling.
           * Se ainda falhar, a baixa permanece válida e o operador recebe
           * feedback em vez de um erro silencioso de console.
           */
          if (
            isCompleting &&
            isDeliveryFulfillment(nextDelivery) &&
            nextDelivery.route_id
          ) {
            /*
             * A baixa já está persistida neste ponto. A ponte com o Site é
             * pós-processamento resiliente e não pode manter o botão/modal
             * esperando até três tentativas de rede.
             */
            void kickSiteRoute(nextDelivery.route_id, {
                reason: 'delivery_completed',
                maxAttempts: 3,
              })
              .then((result) => console.info(
                '[route-kick:delivery] fast lane concluída',
                result,
              ))
              .catch((kickError) => {
                console.warn(
                '[route-kick:delivery] falhou; fallback periódico preservado',
                kickError,
                );
                toast.warning(
                  'Entrega concluída; Site aguardando sincronização.',
                  {
                    description:
                      'A baixa foi salva. Use Sincronizar Site na rota se a atualização não aparecer.',
                    duration: 5000,
                  },
                );
              });
          }

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
              currentState.storeSettings.autoCloseCompletedRoutes !== false &&
              canAutoCloseRoute(previousRoute, remainingPreviousRouteDeliveries);

            if (previousRouteReadyToClose && previousRoute) {
              void currentState.closeRoute(previousRoute.id).catch((closeError) => {
                console.warn('Baixa salva; fechamento da rota anterior ficou pendente:', closeError);
                toast.warning('Entrega movida; fechamento da rota anterior ficou pendente.');
              });
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
            const route = currentState.routes.find((item) => item.id === nextDelivery.route_id);
            const allDone =
              currentState.storeSettings.autoCloseCompletedRoutes !== false &&
              canAutoCloseRoute(route, routeDeliveries);

            if (allDone) {
              if (route) {
                // O fechamento começa otimista, mas fila iFood/notificações e
                // integrações posteriores continuam fora do caminho crítico.
                void currentState.closeRoute(route.id).catch((closeError) => {
                  console.warn('Baixa salva; fechamento automático ficou pendente:', closeError);
                  toast.warning('Entregas concluídas; finalize a rota novamente.', {
                    description: 'A baixa foi preservada e nenhuma confirmação do iFood foi perdida.',
                  });
                });
              }
            }
          }
        } catch (error) {
          if (deliveryCommitCompleted) {
            set({ syncError: true });
            console.error('Entrega salva, mas não foi possível fechar a rota automaticamente:', error);
            return;
          }
          set((current) => ({
            deliveries: rollbackUpdatedEntity(current.deliveries, deliveryToUpdate, nextDelivery),
            customers: customer && optimisticCustomer
              ? rollbackUpdatedEntity(current.customers, customer, optimisticCustomer)
              : current.customers,
            syncError: true,
          }));
          console.error(error);
          throw error;
        }
      },

      deleteDelivery: async (id) => {
        const state = get();
        const deliveryToDelete = state.deliveries.find((delivery) => delivery.id === id);
        if (!deliveryToDelete) throw new Error('Entrega não encontrada.');

        if (isCancelledSiteDelivery(deliveryToDelete)) {
          throw new Error(
            'Pedido cancelado: exclusão bloqueada para preservar o histórico.',
          );
        }

        if (deliveryToDelete.completed === true) {
          throw new Error(
            'Desfaça a baixa antes de excluir uma entrega concluída.',
          );
        }

        const previousIndex = state.deliveries.findIndex((delivery) => delivery.id === id);
        const linkedRouteId = deliveryToDelete.route_id;

        set((current) => ({
          deliveries: current.deliveries.filter((delivery) => delivery.id !== id),
        }));

        let deletionCommitted = false;
        try {
          await queueEntityWrite('deliveries', id, () => deleteDoc(doc(db, 'deliveries', id)));
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
              currentState.storeSettings.autoCloseCompletedRoutes !== false &&
              canAutoCloseRoute(linkedRoute, remainingDeliveries);

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

          set((state) => ({ deliveries: rollbackDeletedEntity(state.deliveries, deliveryToDelete, previousIndex), syncError: true }));
          console.error(error);
          throw error;
        }
      },

      closeRoute: async (routeId, options) => {
        if (isSyntheticOperationalRoute(routeId)) {
          throw new Error(
            'Este agrupador operacional não pode ser finalizado como rota.',
          );
        }
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

        if (activeRouteDeliveries(routeDeliveries).some((delivery) => !delivery.completed)) {
          throw new Error('Conclua todas as entregas ativas antes de finalizar a rota.');
        }

        // Estado transitório imediato, sem anunciar fechamento antes da confirmação do servidor.
        if (get().closingRouteIds.includes(routeId)) return;
        set((state) => ({ closingRouteIds: [...state.closingRouteIds, routeId] }));
        try {
        // Autoridade remota: não fechar uma rota com lista de entregas desatualizada.
        // Esta consulta acontece SOMENTE na ação explícita de fechamento.
        const remoteRouteDeliveries = await getDocs(query(
          collection(db, 'deliveries'),
          where('route_id', '==', routeId),
        ));
        const localById = new Map(routeDeliveries.map((delivery) => [delivery.id, delivery] as const));
        const localIds = new Set(localById.keys());
        const remoteIds = new Set(remoteRouteDeliveries.docs.map((snapshot) => snapshot.id));
        if (localIds.size !== remoteIds.size || [...remoteIds].some((id) => !localIds.has(id))) {
          throw new Error('As entregas desta rota mudaram em outro aparelho. Atualize antes de fechar.');
        }

        if (routeDeliveries.length > 400) {
          throw new Error('Rota grande demais para finalizar com segurança de uma vez. Solicite conferência.');
        }

        const now = new Date().toISOString();
        const endTime = options?.effectiveEndTime || now;
        const routeRef = doc(db, 'routes', routeId);
        const deliveryRefs = routeDeliveries.map((delivery) => doc(db, 'deliveries', delivery.id));
        const finalEndTime = await runTransaction(db, async (transaction) => {
          // Todas as leituras vêm ANTES das atualizações, conforme contrato do Firestore.
          const persistedRoute = await transaction.get(routeRef);
          if (!persistedRoute.exists()) throw new Error('Rota não encontrada no servidor. Atualize a tela.');
          const remoteRoute = persistedRoute.data() as Route;
          if (remoteRoute.status === 'fechada') return remoteRoute.end_time || endTime;
          if (!routeStartedAt({ ...remoteRoute, id: routeId })) {
            throw new Error('Esta rota ainda não foi iniciada no servidor. Atualize antes de fechar.');
          }
          const remoteDeliveries = await Promise.all(deliveryRefs.map((ref) => transaction.get(ref)));
          for (const snapshot of remoteDeliveries) {
            if (!snapshot.exists()) throw new Error('Uma entrega foi excluída em outro aparelho. Atualize a rota.');
            const remote = snapshot.data() as Delivery;
            const local = localById.get(snapshot.id);
            if (
              remote.route_id !== routeId ||
              isCancelledSiteDelivery(remote) !== (local ? isCancelledSiteDelivery(local) : false) ||
              (!isCancelledSiteDelivery(remote) && remote.completed !== true)
            ) {
              throw new Error('Uma entrega foi alterada, cancelada ou ainda está pendente em outro aparelho. Atualize a rota.');
            }
          }
          // R95: conferir novamente a fotografia operacional antes das gravações.
          assertRouteClosureStable(routeId, routeBeforeClose, routeDeliveries, get().routes, get().deliveries);
          const closedAt = remoteRoute.end_time || endTime;
          transaction.update(routeRef, {
            status: 'fechada',
            end_time: closedAt,
            updated_at: now,
            ...(options?.autoClosedAt ? { auto_closed_at: options.autoClosedAt } : {}),
          });
          routeDeliveries.forEach((delivery, index) => {
            if (delivery.source_system !== 'dfl_site') {
              transaction.update(deliveryRefs[index], {
                analytics_sync_pending: true,
                // Registro de fila corresponde à gravação real, não ao horário histórico da rota.
                analytics_sync_requested_at: now,
              });
            }
          });
          return closedAt;
        });

        // UI só anuncia conclusão depois da transação confirmada.
        set((state) => ({
          routes: state.routes.map((route) => route.id === routeId
            ? { ...route, status: 'fechada', end_time: finalEndTime, updated_at: now,
                ...(options?.autoClosedAt ? { auto_closed_at: options.autoClosedAt } : {}) }
            : route),
        }));
        void cancelRouteDurationReminder(routeId);

        // Encerrar a rota não significa que os pedidos já foram confirmados
        // no portal do iFood. Criamos uma fila externa, idempotente.
        try {
          const current = get();
          const now = new Date().toISOString();

          const motoboyConfirmsIfood = current.motoboys.some((item) =>
            item.id === routeBeforeClose.motoboy_id && item.ifood_confirmation_mode === 'motoboy');
          const confirmationItems: IfoodPendingConfirmation[] = routeDeliveries
            .filter((delivery) => delivery.origin === 'ifood' && !isCancelledSiteDelivery(delivery) && !motoboyConfirmsIfood)
            .map((delivery) => {
              const customer = current.customers.find(
                (item) => item.id === delivery.customer_id,
              );

              // A memória do cliente não pertence a esta entrega.
              const code = orderConfirmationCode(delivery.confirmation_code);

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
                value: deliveryCustomerCharge(delivery),
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

          if (routePendingCount > 0 && !motoboyConfirmsIfood) {
            void notifyIfoodRoutePending(
              routeId,
              routeBeforeClose.name || 'a rota',
              routePendingCount,
              get().storeSettings.notificationPreferences,
            );
          } else if (pendingAfter.length >= pendingBefore) {
            void notifyRouteFinished(
              routeId,
              routeBeforeClose.name || 'Rota',
              get().storeSettings.notificationPreferences,
              {
                startedAt: routeStartedAt(routeBeforeClose) || undefined,
                endedAt: finalEndTime,
                motoboyName: routeBeforeClose.motoboy_name,
                stops: groupDeliveriesByStop(routeDeliveries).length,
                orders: routeDeliveries.length,
              },
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
        } finally {
          set((state) => ({ closingRouteIds: state.closingRouteIds.filter((id) => id !== routeId) }));
        }
      },

      reopenRoute: async (routeId) => {
        if (isSyntheticOperationalRoute(routeId)) {
          throw new Error('Agrupador operacional não é rota real.');
        }
        const current = get().routes.find((route) => route.id === routeId);
        if (!current) throw new Error('Rota não encontrada.');
        if (current.status !== 'fechada') return;

        const now = new Date().toISOString();
        const ref = doc(db, 'routes', routeId);
        const remote = await queueEntityWrite('routes', routeId, () => runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) throw new Error('Rota excluída no servidor. Atualize a tela.');
          const saved = snapshot.data() as Route;
          if (saved.status !== 'fechada') {
            throw new Error('Esta rota foi alterada em outro aparelho. Atualize a tela.');
          }
          transaction.update(ref, {
            status: 'aberta',
            reopened_at: now,
            updated_at: now,
          });
          return saved;
        }));
        // Não apagar o encerramento histórico nem afirmar sucesso antes do servidor.
        set((state) => ({
          routes: state.routes.map((route) => route.id === routeId
            ? { ...route, status: 'aberta', end_time: remote.end_time, reopened_at: now, updated_at: now }
            : route),
        }));
      },

      reorderDelivery: async (routeId, deliveryId, direction) => {
        const pending = get().deliveries
          .filter((delivery) => delivery.route_id === routeId && !delivery.completed && !isCancelledSiteDelivery(delivery))
          .map((delivery) => ({ ...delivery }));
        const selected = pending.find((delivery) => delivery.id === deliveryId);
        if (!selected) return;
        const groups = groupDeliveriesByStop(pending);
        const currentIndex = groups.findIndex((group) => group.key === deliveryStopKey(selected));
        if (currentIndex < 0) return;
        const targetIndex = currentIndex + (direction === 'up' ? -1 : 1);
        if (targetIndex < 0 || targetIndex >= groups.length) return;
        const orderedIds = moveStopToIndex(pending, deliveryId, targetIndex);

        await get().setDeliveryOrder(
          routeId,
          orderedIds,
          { metadata: { order_source: 'manual', order_updated_at: new Date().toISOString() } },
        );
      },

      moveDeliveryToIndex: async (routeId, deliveryId, targetIndex) => {
        const pending = get().deliveries
          .filter((delivery) => delivery.route_id === routeId && !delivery.completed && !isCancelledSiteDelivery(delivery))
          .map((delivery) => ({ ...delivery }));
        const selected = pending.find((delivery) => delivery.id === deliveryId);
        if (!selected || pending.length < 2) return;
        const groups = groupDeliveriesByStop(pending);
        const currentIndex = groups.findIndex((group) => group.key === deliveryStopKey(selected));
        if (currentIndex < 0) return;
        const rawTarget = Math.max(0, Math.min(targetIndex, groups.length - 1));
        if (rawTarget === currentIndex) return;
        const orderedIds = moveStopToIndex(pending, deliveryId, rawTarget);

        await get().setDeliveryOrder(
          routeId,
          orderedIds,
          { metadata: { order_source: 'manual', order_updated_at: new Date().toISOString() } },
        );
      },

      setDeliveryOrder: async (routeId, orderedPendingIds, options) => withRouteOrderWriteLock(routeId, async () => {
        const state = get();
        const routeDeliveries = state.deliveries
          .filter((delivery) => delivery.route_id === routeId)
          .map((delivery) => ({ ...delivery }));

        const pending = routeDeliveries.filter((delivery) => !delivery.completed && !isCancelledSiteDelivery(delivery));
        const completed = routeDeliveries.filter((delivery) => delivery.completed || isCancelledSiteDelivery(delivery));
        const pendingById = new Map(pending.map((delivery) => [delivery.id, delivery]));

        const uniqueIds = Array.from(new Set(orderedPendingIds));
        const validIds = uniqueIds.filter((id) => pendingById.has(id));
        const selectedIds = new Set(validIds);
        const missingIds = pending
          .map((delivery) => delivery.id)
          .filter((id) => !selectedIds.has(id));

        const finalPendingIds = expandStopOrder(
          [...validIds, ...missingIds],
          pending,
        );

        if (finalPendingIds.length !== pending.length) {
          throw new Error('A ordem recebida não corresponde às entregas pendentes da rota.');
        }

        // Fixações são aplicadas na autoridade de escrita, para que arraste,
        // setas e otimizador não movam a primeira parada travada.
        const protectedIds = keepPinnedStopPositions(pending, finalPendingIds);
        const orderedPending = protectedIds.map((id) => pendingById.get(id)!);
        if (new Set(protectedIds).size !== pending.length) {
          throw new Error('A sequência contém IDs repetidos ou pedidos ausentes.');
        }
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

        // Firestore permite até 500 escritas por lote; falhar antes do estado otimista.
        if (normalized.length > 500) {
          throw new Error('Esta rota excede o limite de 500 registros por reorganização. Divida a operação.');
        }

        const now = new Date().toISOString();
        const metadata = options?.metadata;
        const orderUpdatedAt =
          metadata?.order_updated_at || now;

        const indexById = new Map(
          normalized.map(
            (delivery) =>
              [delivery.id, delivery.order_index] as const,
          ),
        );

        set((prev) => ({
          deliveries: prev.deliveries.map((delivery) => {
            const nextIndex = indexById.get(delivery.id);
            return nextIndex === undefined
              ? delivery
              : {
                  ...delivery,
                  order_index: nextIndex,
                  ...(metadata
                    ? {
                        ...(metadata.order_locked !== undefined
                          ? { order_locked: metadata.order_locked }
                          : {}),
                        ...(metadata.order_source !== undefined
                          ? { order_source: metadata.order_source }
                          : {}),
                        order_updated_at: orderUpdatedAt,
                      }
                    : {}),
                  updated_at: now,
                };
          }),
        }));

        try {
          const batch = writeBatch(db);
          normalized.forEach((delivery) => {
            batch.update(doc(db, 'deliveries', delivery.id), {
              order_index: delivery.order_index,
              ...(metadata
                ? {
                    ...(metadata.order_locked !== undefined
                      ? { order_locked: metadata.order_locked }
                      : {}),
                    ...(metadata.order_source !== undefined
                      ? { order_source: metadata.order_source }
                      : {}),
                    order_updated_at: orderUpdatedAt,
                  }
                : {}),
              updated_at: now,
            });
          });
          await queueDeliveryDocuments(queueEntityWrite, normalized.map((delivery) => delivery.id), () => batch.commit());
        } catch (error) {
          const touched = new Set(normalized.map((delivery) => delivery.id));
          set((current) => ({
            deliveries: rollbackRouteOrderFields(
              current.deliveries, state.deliveries, touched, now,
            ),
          }));
          console.error('Erro ao aplicar ordem da rota:', error);
          throw error;
        }
      }),


      toggleDeliveryExpansion: (id, isExpanded) => {
        set((state) => ({
          deliveries: state.deliveries.map(d => d.id === id ? { ...d, is_expanded: isExpanded } : d)
        }));
      },

      addMotoboyAdjustment: async (adjustment) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(adjustment.operational_date)) {
          throw new Error('Data operacional do ajuste inválida.');
        }
        if (!Number.isFinite(adjustment.amount) || adjustment.amount <= 0) {
          throw new Error('Informe um valor válido para o ajuste.');
        }
        const adjustmentRef = doc(db, 'motoboy_adjustments', adjustment.id);
        const dailySettlementRef = doc(db, 'operational_expenses', settlementDocumentId(
          `motoboy:${adjustment.motoboy_id}:${adjustment.operational_date}`,
        ));
        await runTransaction(db, async (transaction) => {
          const closed = await transaction.get(dailySettlementRef);
          const existing = await transaction.get(adjustmentRef);
          if (closed.exists()) throw new Error('O acerto deste dia já foi fechado. Não é possível lançar ajustes.');
          if (existing.exists()) throw new Error('Este ajuste já foi registrado.');
          transaction.set(adjustmentRef, sanitizeForFirebase(adjustment));
        });
        set((state) => ({
          motoboyAdjustments: [
            adjustment,
            ...state.motoboyAdjustments.filter((item) => item.id !== adjustment.id),
          ],
        }));
      },

      cancelMotoboyAdjustment: async (id) => {
        const current = get().motoboyAdjustments.find((item) => item.id === id);
        if (!current) throw new Error('Ajuste não encontrado.');
        const now = new Date().toISOString();
        const actor = get().user;
        const adjustmentRef = doc(db, 'motoboy_adjustments', id);
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(adjustmentRef);
          if (!snapshot.exists()) throw new Error('Ajuste não encontrado no servidor.');
          const remote = snapshot.data() as MotoboyAdjustment;
          if (remote.status !== 'pending') {
            throw new Error(remote.status === 'incorporated' ? 'Ajuste já incorporado a um acerto.' : 'Ajuste já cancelado.');
          }
          transaction.update(adjustmentRef, sanitizeForFirebase({
            status: 'cancelled',
            cancelled_at: now,
            cancelled_by_uid: actor?.uid || undefined,
            updated_at: now,
          }));
        });
        set((state) => ({
          motoboyAdjustments: state.motoboyAdjustments.map((item) => item.id === id ? {
            ...item,
            status: 'cancelled',
            cancelled_at: now,
            cancelled_by_uid: actor?.uid,
            updated_at: now,
          } : item),
        }));
      },

      closeMotoboySettlement: async (expense, adjustmentIds) => {
        if (expense.source_kind !== 'motoboy_settlement' || !expense.source_id) {
          throw new Error('Contrato de fechamento inválido.');
        }
        if (!/^motoboy:[^:]+:\d{4}-\d{2}-\d{2}$/.test(expense.source_id)) {
          throw new Error('Identidade do acerto inválida.');
        }
        const historical = await getDocs(query(
          collection(db, 'operational_expenses'),
          where('source_id', '==', expense.source_id),
        ));
        if (!historical.empty) throw new Error('Já existe um acerto para este motoboy e dia.');
        const settlementRef = doc(db, 'operational_expenses', settlementDocumentId(expense.source_id));
        const adjustmentRefs = [...new Set(adjustmentIds)].map((id) => doc(db, 'motoboy_adjustments', id));
        const includedIds = new Set(adjustmentIds);
        const localAdjustmentsAtStart = new Map(get().motoboyAdjustments
          .filter((item) => includedIds.has(item.id))
          .map((item) => [item.id, { ...item }] as const));
        if (localAdjustmentsAtStart.size !== adjustmentRefs.length) {
          throw new Error('Existem ajustes não carregados no acerto. Sincronize antes de fechar.');
        }
        const now = new Date().toISOString();
        await runTransaction(db, async (transaction) => {
          const settlementSnapshot = await transaction.get(settlementRef);
          if (settlementSnapshot.exists()) throw new Error('Acerto já confirmado em outro aparelho. Atualize a tela.');
          const adjustmentSnapshots = [];
          for (const adjustmentRef of adjustmentRefs) adjustmentSnapshots.push(await transaction.get(adjustmentRef));
          for (const snapshot of adjustmentSnapshots) {
            if (!snapshot.exists()) throw new Error('Um ajuste pendente não existe mais. Atualize a tela.');
            const adjustment = { ...snapshot.data(), id: snapshot.id } as MotoboyAdjustment;
            assertRemoteSettlementAdjustment(adjustment, localAdjustmentsAtStart.get(snapshot.id));
            if (adjustment.status !== 'pending' || adjustment.motoboy_id !== expense.motoboy_id || adjustment.operational_date !== expense.operational_date) {
              throw new Error('Um ajuste foi alterado em outro aparelho. Atualize antes de fechar.');
            }
          }
          transaction.set(settlementRef, sanitizeForFirebase({ ...expense, id: settlementRef.id }));
          adjustmentRefs.forEach((adjustmentRef) => transaction.update(adjustmentRef, sanitizeForFirebase({
            status: 'incorporated',
            settlement_source_id: expense.source_id,
            incorporated_at: now,
            updated_at: now,
          })));
        });
        const saved = { ...expense, id: settlementRef.id };
        set((state) => ({
          operationalExpenses: [saved, ...state.operationalExpenses.filter((item) => item.source_id !== expense.source_id)],
          motoboyAdjustments: state.motoboyAdjustments.map((item) => adjustmentIds.includes(item.id) ? {
            ...item,
            status: 'incorporated',
            settlement_source_id: expense.source_id,
            incorporated_at: now,
            updated_at: now,
          } : item),
        }));
      },

      addOperationalExpense: async (expense) => {
        const previous = get().operationalExpenses;
        if (expense.source_id && previous.some((item) => item.source_id === expense.source_id)) {
          throw new Error('Esta despesa já foi lançada.');
        }
        // Acertos usam o mesmo documento por motoboy/competência em todos os aparelhos.
        // Nenhuma coleção nova e nenhum efeito financeiro antes da confirmação remota.
        if (expense.source_kind === 'motoboy_settlement') {
          if (!expense.source_id || !/^motoboy:[^:]+:\d{4}-\d{2}-\d{2}$/.test(expense.source_id)) {
            throw new Error('Identidade do acerto inválida.');
          }
          const historical = await getDocs(query(
            collection(db, 'operational_expenses'),
            where('source_id', '==', expense.source_id),
          ));
          if (!historical.empty) throw new Error('Já existe um acerto para este motoboy e dia.');
          const settlementRef = doc(db, 'operational_expenses', `settlement-${expense.source_id}`);
          await runTransaction(db, async (transaction) => {
            const existing = await transaction.get(settlementRef);
            if (existing.exists()) throw new Error('Acerto já confirmado em outro aparelho. Atualize a tela.');
            transaction.set(settlementRef, sanitizeForFirebase({ ...expense, id: settlementRef.id }));
          });
          set((state) => ({ operationalExpenses: [
            { ...expense, id: settlementRef.id },
            ...state.operationalExpenses.filter((item) => item.source_id !== expense.source_id),
          ] }));
          return;
        }
        set((state) => ({ operationalExpenses: [expense, ...state.operationalExpenses] }));
        try {
          await setDoc(doc(db, 'operational_expenses', expense.id), sanitizeForFirebase(expense));
        } catch (error) {
          set((state) => ({ operationalExpenses: rollbackAddedEntity(state.operationalExpenses, expense) }));
          console.error(error);
          throw error;
        }
      },

      updateOperationalExpense: async (id, data) => {
        const current = get().operationalExpenses.find((item) => item.id === id);
        if (!current) throw new Error('Despesa não encontrada.');
        if (isClosedSettlement(current) || data.source_kind === 'motoboy_settlement') {
          throw new Error('Acerto fechado é imutável. Use uma correção auditável.');
        }
        const ref = doc(db, 'operational_expenses', id);
        const next = { ...data, updated_at: new Date().toISOString() };
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) throw new Error('Despesa excluída em outro aparelho. Atualize a tela.');
          const remote = snapshot.data() as OperationalExpense;
          if (isClosedSettlement(remote)) throw new Error('Acerto fechado em outro aparelho não pode ser editado.');
          transaction.update(ref, sanitizeForFirebase(next));
        });
        set((state) => ({ operationalExpenses: state.operationalExpenses.map((item) =>
          item.id === id ? { ...item, ...next } : item),
        }));
      },

      deleteOperationalExpense: async (id) => {
        const current = get().operationalExpenses.find((item) => item.id === id);
        if (isClosedSettlement(current)) throw new Error('Acerto fechado não pode ser excluído.');
        const ref = doc(db, 'operational_expenses', id);
        await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) throw new Error('Despesa já excluída em outro aparelho. Atualize a tela.');
          const remote = snapshot.data() as OperationalExpense;
          if (isClosedSettlement(remote)) throw new Error('Acerto fechado em outro aparelho não pode ser excluído.');
          transaction.delete(ref);
        });
        set((state) => ({ operationalExpenses: state.operationalExpenses.filter((item) => item.id !== id) }));
      },

      addIfoodPendingConfirmations: async (items) => {
        if (!items.length) return;

        const previous = get().ifoodPendingConfirmations;
        const normalizeDigits = (value?: string) =>
          (value || '').replace(/\D/g, '');

        const samePendingIdentity = (
          left: IfoodPendingConfirmation,
          right: IfoodPendingConfirmation,
        ) => {
          const leftDelivery = left.delivery_id?.trim();
          const rightDelivery = right.delivery_id?.trim();

          if (
            leftDelivery &&
            rightDelivery &&
            leftDelivery === rightDelivery
          ) {
            return true;
          }

          const leftIfood = normalizeDigits(left.ifood_id);
          const rightIfood = normalizeDigits(right.ifood_id);

          if (
            leftIfood &&
            rightIfood &&
            leftIfood === rightIfood
          ) {
            return true;
          }

          const leftOrder = normalizeDigits(left.order_id);
          const rightOrder = normalizeDigits(right.order_id);

          if (
            !leftIfood &&
            !rightIfood &&
            leftOrder &&
            rightOrder &&
            leftOrder === rightOrder
          ) {
            if (
              left.route_id &&
              right.route_id &&
              left.route_id !== right.route_id
            ) {
              return false;
            }

            return true;
          }

          return false;
        };

        const working = [...previous];
        const changed = new Map<
          string,
          IfoodPendingConfirmation
        >();

        for (const incoming of items) {
          const duplicateInsideBatch = [
            ...changed.values(),
          ].find((item) =>
            samePendingIdentity(item, incoming),
          );

          if (duplicateInsideBatch) {
            continue;
          }

          const existingIndex = working.findIndex(
            (item) =>
              samePendingIdentity(item, incoming),
          );

          if (existingIndex >= 0) {
            const existing = working[existingIndex];
            const resolved =
              existing.status === 'resolved';

            const merged: IfoodPendingConfirmation = {
              ...existing,

              order_id:
                incoming.order_id ||
                existing.order_id,

              ifood_id:
                incoming.ifood_id ||
                existing.ifood_id,

              confirmation_code:
                incoming.confirmation_code ||
                existing.confirmation_code,

              customer_name:
                incoming.customer_name ||
                existing.customer_name,

              value:
                incoming.value ??
                existing.value,

              note:
                incoming.note ||
                existing.note,

              delivery_id:
                incoming.delivery_id ||
                existing.delivery_id,

              route_id:
                incoming.route_id ||
                existing.route_id,

              route_name:
                incoming.route_name ||
                existing.route_name,

              source_kind:
                incoming.source_kind === 'route'
                  ? 'route'
                  : existing.source_kind ||
                    incoming.source_kind,

              status: resolved
                ? 'resolved'
                : existing.status ||
                  incoming.status ||
                  'pending',

              resolved_at: resolved
                ? existing.resolved_at
                : existing.resolved_at,

              created_at:
                existing.created_at ||
                incoming.created_at,

              updated_at: new Date().toISOString(),
            };

            working[existingIndex] = merged;
            changed.set(merged.id, merged);
            continue;
          }

          const created: IfoodPendingConfirmation = {
            ...incoming,
            status: incoming.status || 'pending',
            updated_at:
              incoming.updated_at ||
              new Date().toISOString(),
          };

          working.unshift(created);
          changed.set(created.id, created);
        }

        if (!changed.size) return;
        if (changed.size > 150) {
          throw new Error('Muitas confirmações em um único lote. Divida em grupos menores.');
        }

        const candidates = [...changed.values()];
        const saved = await runTransaction(db, async (transaction) => {
          // Verificar o status no SERVIDOR impede ressuscitar uma confirmação
          // resolvida em outro aparelho por causa de uma store desatualizada.
          const refs = candidates.map((item) => doc(db, 'ifood_pending_confirmations', item.id));
          const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
          const reconciled = candidates.map((item, index) => reconcileIfoodConfirmation(
            snapshots[index].exists() ? snapshots[index].data() as IfoodPendingConfirmation : undefined,
            item,
          ));
          reconciled.forEach((item, index) => {
            const current = snapshots[index];
            if (current.exists() && current.data().status === 'resolved') {
              // Não tocar em confirmação já resolvida evita até atualizar seu timestamp.
              return;
            }
            transaction.set(refs[index], sanitizeForFirebase(item), { merge: true });
          });
          return reconciled;
        });
        // Atualizar apenas os itens persistidos, sem restaurar um snapshot antigo
        // da store que possa apagar alterações concorrentes da sessão.
        set((state) => {
          const authoritative = new Map(saved.map((item) => [item.id, item]));
          const retained = state.ifoodPendingConfirmations.filter((item) => !authoritative.has(item.id));
          return { ifoodPendingConfirmations: [...saved, ...retained] };
        });

      },

      updateIfoodPendingConfirmation: async (id, data) => {
        const now = new Date().toISOString();
        const ref = doc(db, 'ifood_pending_confirmations', id);
        const saved = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(ref);
          if (!snapshot.exists()) throw new Error('Confirmação excluída em outro aparelho. Atualize a lista.');
          const remote = snapshot.data() as IfoodPendingConfirmation;
          const next: IfoodPendingConfirmation = {
            ...remote,
            ...data,
            id,
            updated_at: now,
          };
          // Restauração é uma ação manual explícita da Central, nunca da geração da rota.
          const patch = sanitizeForFirebase({ ...data, updated_at: now });
          if (data.status === 'pending' && Object.prototype.hasOwnProperty.call(data, 'resolved_at') && data.resolved_at === undefined) {
            patch.resolved_at = deleteField();
          }
          transaction.update(ref, patch);
          return next;
        });
        set((state) => ({
          ifoodPendingConfirmations: state.ifoodPendingConfirmations.map((item) => item.id === id ? saved : item),
        }));

      },

      deleteIfoodPendingConfirmation: async (id) => {
        const previous = get().ifoodPendingConfirmations;
        const removed = previous.find((item) => item.id === id);
        const previousIndex = previous.findIndex((item) => item.id === id);
        set((state) => ({
          ifoodPendingConfirmations: state.ifoodPendingConfirmations.filter(
            (item) => item.id !== id,
          ),
        }));

        try {
          await deleteDoc(doc(db, 'ifood_pending_confirmations', id));
        } catch (error) {
          set((state) => ({ ifoodPendingConfirmations: rollbackDeletedEntity(state.ifoodPendingConfirmations, removed, previousIndex) }));
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
          set((state) => ({ customers: rollbackAddedEntity(state.customers, customerWithTimestamp) }));
          console.error(error);
          throw error;
        }
      },

      updateCustomer: async (id, updatedData) => {
        const previousCustomer = get().customers.find((item) => item.id === id);
        if (!previousCustomer) throw new Error('Cliente não encontrado.');
        const dataWithTimestamp: Partial<Customer> = { ...updatedData, updated_at: new Date().toISOString() };
        const optimisticCustomer: Customer = { ...previousCustomer, ...dataWithTimestamp };
        set((state) => ({
          customers: state.customers.map((c) => c.id === id ? optimisticCustomer : c)
        }));
        try {
          const safeData = sanitizeForFirebase(dataWithTimestamp);
          await queueEntityWrite('customers', id, () => updateDoc(doc(db, 'customers', id), safeData));
        } catch (error) {
          set((state) => ({ customers: rollbackUpdatedEntity(state.customers, previousCustomer, optimisticCustomer) }));
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

        // Mesclar colecoes sem apagar endereco principal nem telefones antigos.
        // A normalizacao remove contatos/endereco duplicados mantendo a ordem.
        const mergedContacts = customerContactPayload(
          [...customerPhones(target), ...customerPhones(source).map(p => ({ ...p, primary: false }))],
          [...customerAddresses(target), ...customerAddresses(source).map(a => ({ ...a, primary: false }))],
        );
        const mergedTarget: Customer = {
          ...target,
          ...mergedContacts,
          phone: mergedContacts.phone || prefer(target.phone, source.phone) || '',
          address: mergedContacts.address || prefer(target.address, source.address) || '',
          neighborhood: mergedContacts.neighborhood || prefer(target.neighborhood, source.neighborhood) || '',
          maps_link: mergedContacts.maps_link || prefer(target.maps_link, source.maps_link) || '',

          observation: prefer(target.observation, source.observation),
          last_confirmation_code: prefer(
            target.last_confirmation_code,
            source.last_confirmation_code,
          ),
          orderCount: completed.length,
          totalSpent: completed.reduce(
            (sum, delivery) => sum + deliveryCustomerCharge(delivery),
            0,
          ),
          updated_at: now,
        };

        const sourceIndex = state.customers.findIndex((customer) => customer.id === sourceId);
        const linkedDeliveryIds = new Set(linkedDeliveries.map((delivery) => delivery.id));
        const optimisticLinkedDeliveries = allAfterMerge.filter((delivery) =>
          linkedDeliveryIds.has(delivery.id),
        );
        // Somente as entidades deste lote podem ser revertidas se o batch falhar.
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
          set((current) => ({
            customers: rollbackDeletedEntity(
              rollbackUpdatedEntity(current.customers, target, mergedTarget), source, sourceIndex,
            ),
            deliveries: rollbackUpdatedEntities(current.deliveries, linkedDeliveries, optimisticLinkedDeliveries),
            syncError: true,
          }));
          console.error('Erro ao consolidar clientes:', error);
          throw error;
        }
      },

      findOrCreateCustomer: (name, details) => {
        const rawName = name.trim();
        if (!rawName) return Promise.resolve('');
        // A fila de concorrencia acompanha a identidade completa, nao o telefone isolado.
        // Pessoas com o mesmo telefone mas endereco/nome diferentes nao disputam um cadastro.
        const normalizedPhone = normalizeCustomerPhone(details?.phone);
        const normalizedAddress = normalizeCustomerAddress(details?.address);
        const normalizedName = normalizeCustomerName(rawName);
        const flightKey = normalizedAddress
          ? `identity:${normalizedName}|${normalizedAddress}`
          : `identity:${normalizedName}|sem-endereco|${normalizedPhone}`;
        const pending = customerCreationFlights.get(flightKey);
        if (pending) {
          return pending.catch(() => '').then(() =>
            get().findOrCreateCustomer(name, details));
        }
        const operation = (async (): Promise<string> => {

        const previousCustomers = get().customers;
        const now = new Date().toISOString();

        const preferredCandidate =
          details?.preferredCustomerId
            ? previousCustomers.find(
                (customer) =>
                  customer.id ===
                  details.preferredCustomerId,
              )
            : undefined;

        // Um item escolhido anteriormente no autocomplete não é autoridade.
        // Se nome, telefone ou endereço mudaram, a identidade deve ser
        // revalidada antes de reutilizar e enriquecer o cadastro antigo.
        const preferredCustomer =
          preferredCandidate &&
          customerIdentityEvidence(
            preferredCandidate,
            rawName,
            {
              address: details?.address,
              phone: details?.phone,
            },
          ).reusable
            ? preferredCandidate
            : undefined;

        const existing =
          preferredCustomer ||
          findExistingCustomer(
            previousCustomers,
            rawName,
            {
              address: details?.address,
              phone: details?.phone,
            },
          );

        const derivedNeighborhood =
          extractCustomerNeighborhood(
            details?.address,
          );

        const enrichExisting = async (
          customer: Customer,
        ) => {
          const before = { ...customer };

          const updatedFields: Partial<Customer> = {
            updated_at: now,
          };

          /*
           * Cadastro selecionado/reutilizado é enriquecido.
           * Campo vazio nunca apaga dado bom já existente.
           */
          if (!customer.address && details?.address?.trim()) {
            updatedFields.address = details.address.trim();
          }

          if (!customer.maps_link && details?.mapsLink?.trim() &&
              (!customer.address || customer.address === details?.address)) {
            updatedFields.maps_link = details.mapsLink.trim();
          }

          if (details?.confirmationCode?.trim()) {
            updatedFields.last_confirmation_code =
              details.confirmationCode.trim();
          }

          if (details?.observation?.trim()) {
            updatedFields.observation =
              details.observation.trim();
          }

          if (derivedNeighborhood && !customer.neighborhood) {
            updatedFields.neighborhood = derivedNeighborhood;
          }

          if (details?.origin) {
            updatedFields.origin = details.origin;
          }

          if (!customer.phone && details?.phone?.trim()) {
            updatedFields.phone = details.phone.trim();
          }

          set((state) => ({
            customers: state.customers.map(
              (current) =>
                current.id === customer.id
                  ? {
                      ...current,
                      ...updatedFields,
                    }
                  : current,
            ),
          }));

          try {
            await updateDoc(
              doc(db, 'customers', customer.id),
              sanitizeForFirebase(updatedFields),
            );
          } catch (error) {
            set((state) => ({
              customers: state.customers.map(
                (current) =>
                  current.id === customer.id
                    ? before
                    : current,
              ),
            }));

            console.error(
              'Erro ao atualizar cliente existente:',
              error,
            );

            throw error;
          }

          return customer.id;
        };

        if (existing) {
          return enrichExisting(existing);
        }

        /*
         * Segunda leitura do estado é importante:
         * outra criação pode ter inserido o cliente enquanto
         * esta operação ainda preparava os dados.
         */
        const rechecked = findExistingCustomer(
          get().customers,
          rawName,
          {
            address: details?.address,
            phone: details?.phone,
          },
        );

        if (rechecked) {
          return enrichExisting(rechecked);
        }

        const currentCustomers = get().customers;

        const customerName = nextCustomerName(
          currentCustomers,
          rawName,
        );

        const newCustomer: Customer = {
          id: `customer-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,

          name: customerName,
          origin: details?.origin || 'loja',
          neighborhood: derivedNeighborhood,

          address:
            details?.address?.trim() ||
            undefined,

          maps_link:
            details?.mapsLink?.trim() ||
            undefined,

          last_confirmation_code:
            details?.confirmationCode?.trim() ||
            undefined,

          observation:
            details?.observation?.trim() ||
            undefined,

          phone:
            details?.phone?.trim() ||
            undefined,

          createdAt: now,
          updated_at: now,
        };

        set((state) => ({
          customers: [
            newCustomer,
            ...state.customers,
          ],
        }));

        try {
          await setDoc(
            doc(
              db,
              'customers',
              newCustomer.id,
            ),
            sanitizeForFirebase(newCustomer),
          );

          return newCustomer.id;
        } catch (error) {
          set((state) => ({
            customers: state.customers.filter(
              (customer) =>
                customer.id !== newCustomer.id,
            ),
          }));

          console.error(
            'Erro ao criar cliente:',
            error,
          );

          throw error;
        }
        })();
        customerCreationFlights.set(flightKey, operation);
        void operation.finally(() => {
          if (customerCreationFlights.get(flightKey) === operation) {
            customerCreationFlights.delete(flightKey);
          }
        }).catch(() => {});
        return operation;
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
        operationalExpenses: state.operationalExpenses,
        motoboyAdjustments: state.motoboyAdjustments,
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
