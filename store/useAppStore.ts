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
  hasHydrated: boolean;
  routes: Route[];
  deliveries: Delivery[];
  customers: Customer[];
  selectedDate: Date;
  isSyncing: boolean;
  setHasHydrated: (value: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  initData: () => Promise<void>;
  goToPreviousDay: () => void;
  goToNextDay: () => void;
  getDeliveriesByRoute: (routeId: string) => Delivery[];
  getCustomerById: (customerId?: string) => Customer | undefined;
  addRoute: (route: Route) => Promise<void>;
  addDelivery: (delivery: Delivery) => Promise<void>;
  updateDelivery: (id: string, updatedData: Partial<Delivery>) => Promise<void>;
  closeRoute: (routeId: string) => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  findOrCreateCustomer: (
    name: string,
    details?: {
      address?: string;
      mapsLink?: string;
      confirmationCode?: string;
      observation?: string;
    }
  ) => Promise<string>;
}

// Compara local x nuvem registro a registro usando `updated_at`.
// - Se só existe local -> mantém e marca pra reenviar pra nuvem.
// - Se existe nos dois e o local é mais novo -> local vence e marca pra reenviar.
// - Se existe nos dois e a nuvem é igual ou mais nova -> mantém a versão da nuvem.
function mergeByTimestamp<T extends { id: string; updated_at?: string }>(
  cloudItems: T[],
  localItems: T[]
): { merged: T[]; toPush: T[] } {
  const merged: T[] = [...cloudItems];
  const toPush: T[] = [];

  localItems.forEach((localItem) => {
    const idx = merged.findIndex((m) => m.id === localItem.id);

    if (idx === -1) {
      // Só existe localmente -> mantém e reenvia pra nuvem
      merged.push(localItem);
      toPush.push(localItem);
      return;
    }

    const cloudItem = merged[idx];
    const localTime = localItem.updated_at ? new Date(localItem.updated_at).getTime() : 0;
    const cloudTime = cloudItem.updated_at ? new Date(cloudItem.updated_at).getTime() : 0;

    if (localTime > cloudTime) {
      // Edição local mais recente que a nuvem (ex: update feito offline) -> local vence
      merged[idx] = localItem;
      toPush.push(localItem);
    }
    // Se a nuvem for mais recente ou igual, mantém o que já está em merged (versão da nuvem)
  });

  return { merged, toPush };
}

function pushSafely(collectionName: string, id: string, data: object) {
  const safe = Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(([_, v]) => v !== undefined)
  );
  setDoc(doc(db, collectionName, id), safe).catch(console.error);
}

// O (persist) envolve a loja toda para criar o "Cofre Físico" no celular
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      authLoaded: false,
      hasHydrated: false,
      routes: [],
      deliveries: [],
      customers: [],
      selectedDate: new Date(),
      isSyncing: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

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

      // IMPORTANTE: só chame initData() depois que `hasHydrated` for true.
      // Chamar antes disso faz o merge enxergar o estado local como vazio e
      // sobrescrever (e persistir) dados que ainda não subiram pra nuvem.
      initData: async () => {
        if (!get().hasHydrated) {
          console.warn('[initData] Chamado antes da hidratação local terminar — abortando pra não sobrescrever dados offline.');
          return;
        }

        set({ isSyncing: true });
        try {
          const [routesSnap, deliveriesSnap, customersSnap] = await Promise.all([
            getDocs(collection(db, 'routes')),
            getDocs(collection(db, 'deliveries')),
            getDocs(collection(db, 'customers'))
          ]);

          const fbRoutes = routesSnap.docs.map(d => d.data() as Route);
          const fbDeliveries = deliveriesSnap.docs.map(d => d.data() as Delivery);
          const fbCustomers = customersSnap.docs.map(d => d.data() as Customer);

          const localRoutes = get().routes;
          const localDeliveries = get().deliveries;
          const localCustomers = get().customers;

          const routesResult = mergeByTimestamp(fbRoutes, localRoutes);
          const deliveriesResult = mergeByTimestamp(fbDeliveries, localDeliveries);
          const customersResult = mergeByTimestamp(fbCustomers, localCustomers);

          // Reenvia pra nuvem só o que realmente precisa (novo local ou local mais recente)
          routesResult.toPush.forEach((r) => pushSafely('routes', r.id, r));
          deliveriesResult.toPush.forEach((d) => pushSafely('deliveries', d.id, d));
          customersResult.toPush.forEach((c) => pushSafely('customers', c.id, c));

          set({
            routes: routesResult.merged,
            deliveries: deliveriesResult.merged,
            customers: customersResult.merged,
            isSyncing: false
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
        customerId ? get().customers.find((c) => c.id === customerId) : undefined,

      addRoute: async (route) => {
        const routeWithTimestamp: Route = { ...route, updated_at: new Date().toISOString() };
        set((state) => ({ routes: [routeWithTimestamp, ...state.routes] }));
        try {
          const safeRoute = Object.fromEntries(
            Object.entries(routeWithTimestamp).filter(([_, v]) => v !== undefined)
          );
          await setDoc(doc(db, 'routes', route.id), safeRoute);
        } catch (error) {
          console.error('Erro ao salvar rota, mas tá seguro no celular:', error);
        }
      },

      addDelivery: async (delivery) => {
        const deliveryWithTimestamp: Delivery = { ...delivery, updated_at: new Date().toISOString() };
        set((state) => ({ deliveries: [deliveryWithTimestamp, ...state.deliveries] }));
        try {
          const safeDelivery = Object.fromEntries(
            Object.entries(deliveryWithTimestamp).filter(([_, v]) => v !== undefined)
          ) as Delivery;
          await setDoc(doc(db, 'deliveries', delivery.id), safeDelivery);
        } catch (error) {
          console.error('Falha no Firebase, mas a entrega está segura offline:', error);
        }
      },

      updateDelivery: async (id: string, updatedData: Partial<Delivery>) => {
        const dataWithTimestamp: Partial<Delivery> = { ...updatedData, updated_at: new Date().toISOString() };

        set((state) => ({
          deliveries: state.deliveries.map((d) =>
            d.id === id ? { ...d, ...dataWithTimestamp } : d
          )
        }));

        try {
          const safeUpdate = Object.fromEntries(
            Object.entries(dataWithTimestamp).filter(([_, v]) => v !== undefined)
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
            r.id === routeId ? { ...r, status: 'fechada', end_time: endTime, updated_at: endTime } : r
          ),
        }));
        try {
          await updateDoc(doc(db, 'routes', routeId), {
            status: 'fechada',
            end_time: endTime,
            updated_at: endTime
          });
        } catch (error) {
          console.error('Erro no Firebase, rota fechada apenas no celular:', error);
        }
      },

      addCustomer: async (customer) => {
        const customerWithTimestamp: Customer = { ...customer, updated_at: new Date().toISOString() };
        set((state) => ({ customers: [customerWithTimestamp, ...state.customers] }));
        try {
          const safeCustomer = Object.fromEntries(
            Object.entries(customerWithTimestamp).filter(([_, v]) => v !== undefined)
          );
          await setDoc(doc(db, 'customers', customer.id), safeCustomer);
        } catch (error) {
          console.error('Erro ao salvar cliente, mas está seguro offline:', error);
        }
      },

      // Busca cliente por nome (case-insensitive). Se não existir, cria automaticamente
      // (local + Firebase) já com bairro (extraído do endereço), endereço completo, maps link,
      // observação e código de confirmação preenchidos na entrega. Se já existir, atualiza esses
      // dados com o que veio de mais recente. Se o nome vier vazio, retorna string vazia.
      findOrCreateCustomer: async (name, details) => {
        const trimmed = name.trim();
        if (!trimmed) return '';

        // Extrai o bairro como o último trecho separado por vírgula do endereço
        // (ex: "Rua ABC, 123, Centro" -> "Centro")
        const extractNeighborhood = (address?: string): string | undefined => {
          if (!address) return undefined;
          const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
          if (parts.length < 2) return undefined;
          return parts[parts.length - 1];
        };

        const existing = get().customers.find(
          (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
        );

        const derivedNeighborhood = extractNeighborhood(details?.address);
        const now = new Date().toISOString();

        if (existing) {
          const updatedFields: Partial<Customer> = { updated_at: now };
          if (details?.address) updatedFields.address = details.address;
          if (details?.mapsLink) updatedFields.maps_link = details.mapsLink;
          if (details?.confirmationCode) updatedFields.last_confirmation_code = details.confirmationCode;
          if (details?.observation) updatedFields.observation = details.observation;
          if (derivedNeighborhood) updatedFields.neighborhood = derivedNeighborhood;

          set((state) => ({
            customers: state.customers.map((c) =>
              c.id === existing.id ? { ...c, ...updatedFields } : c
            ),
          }));

          try {
            const safeUpdate = Object.fromEntries(
              Object.entries(updatedFields).filter(([_, v]) => v !== undefined)
            );
            await updateDoc(doc(db, 'customers', existing.id), safeUpdate);
          } catch (error) {
            console.error('Erro ao atualizar cliente existente, mas salvo offline:', error);
          }

          return existing.id;
        }

        const newCustomer: Customer = {
          id: Date.now().toString(),
          name: trimmed,
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
          const safeCustomer = Object.fromEntries(
            Object.entries(newCustomer).filter(([_, v]) => v !== undefined)
          );
          await setDoc(doc(db, 'customers', newCustomer.id), safeCustomer);
        } catch (error) {
          console.error('Erro ao criar cliente, mas está seguro offline:', error);
        }

        return newCustomer.id;
      },
    }),
    {
      name: 'dfl-entregas-cofre-offline',
      partialize: (state) => ({
        routes: state.routes,
        deliveries: state.deliveries,
        customers: state.customers
      }),
      onRehydrateStorage: () => (state) => {
        // Dispara depois que o storage local terminou de carregar no state.
        // Só a partir daqui é seguro chamar initData() sem risco de sobrescrever dados offline.
        state?.setHasHydrated(true);
      },
    }
  )
);
