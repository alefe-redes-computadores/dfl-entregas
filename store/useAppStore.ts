import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { signInWithPopup, signOut, signInWithCredential, GoogleAuthProvider, User as FirebaseUser } from 'firebase/auth';
import { db, auth, googleProvider } from '@/lib/firebase';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import type { Route, Delivery, Customer, OrderOrigin, Motoboy } from '@/types';

interface AppState {
  user: FirebaseUser | null;
  authLoaded: boolean;
  hasHydrated: boolean;
  routes: Route[];
  deliveries: Delivery[];
  customers: Customer[];
  motoboys: Motoboy[]; // NOVO
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
  deleteDelivery: (id: string) => Promise<void>;
  closeRoute: (routeId: string) => Promise<void>;
  addCustomer: (customer: Customer) => Promise<void>;
  updateCustomer: (id: string, updatedData: Partial<Customer>) => Promise<void>;
  addMotoboy: (motoboy: Motoboy) => Promise<void>; // NOVO
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

function mergeByTimestamp<T extends { id: string; updated_at?: string }>(
  cloudItems: T[],
  localItems: T[]
): { merged: T[]; toPush: T[] } {
  const merged: T[] = [...cloudItems];
  const toPush: T[] = [];

  localItems.forEach((localItem) => {
    const idx = merged.findIndex((m) => m.id === localItem.id);

    if (idx === -1) {
      merged.push(localItem);
      toPush.push(localItem);
      return;
    }

    const cloudItem = merged[idx];
    const localTime = localItem.updated_at ? new Date(localItem.updated_at).getTime() : 0;
    const cloudTime = cloudItem.updated_at ? new Date(cloudItem.updated_at).getTime() : 0;

    if (localTime > cloudTime) {
      merged[idx] = localItem;
      toPush.push(localItem);
    }
  });

  return { merged, toPush };
}

function pushSafely(collectionName: string, id: string, data: object) {
  const safe = Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(([_, v]) => v !== undefined)
  );
  setDoc(doc(db, collectionName, id), safe).catch(console.error);
}

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
          set({ routes: [], deliveries: [], customers: [], motoboys: [], user: null });
        } catch (error) {
          console.error('Erro no logout:', error);
        }
      },

      initData: async () => {
        if (!get().hasHydrated) return;
        set({ isSyncing: true });
        try {
          const [routesSnap, deliveriesSnap, customersSnap, motoboysSnap] = await Promise.all([
            getDocs(collection(db, 'routes')),
            getDocs(collection(db, 'deliveries')),
            getDocs(collection(db, 'customers')),
            getDocs(collection(db, 'motoboys'))
          ]);

          const fbRoutes = routesSnap.docs.map(d => d.data() as Route);
          const fbDeliveries = deliveriesSnap.docs.map(d => d.data() as Delivery);
          const fbCustomers = customersSnap.docs.map(d => d.data() as Customer);
          const fbMotoboys = motoboysSnap.docs.map(d => d.data() as Motoboy);

          const routesResult = mergeByTimestamp(fbRoutes, get().routes);
          const deliveriesResult = mergeByTimestamp(fbDeliveries, get().deliveries);
          const customersResult = mergeByTimestamp(fbCustomers, get().customers);
          const motoboysResult = mergeByTimestamp(fbMotoboys, get().motoboys);

          routesResult.toPush.forEach((r) => pushSafely('routes', r.id, r));
          deliveriesResult.toPush.forEach((d) => pushSafely('deliveries', d.id, d));
          customersResult.toPush.forEach((c) => pushSafely('customers', c.id, c));
          motoboysResult.toPush.forEach((m) => pushSafely('motoboys', m.id, m));

          set({
            routes: routesResult.merged,
            deliveries: deliveriesResult.merged,
            customers: customersResult.merged,
            motoboys: motoboysResult.merged,
            isSyncing: false
          });
        } catch (error) {
          console.error('Erro ao sincronizar:', error);
          set({ isSyncing: false });
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

      getDeliveriesByRoute: (routeId) => get().deliveries.filter((d) => d.route_id === routeId),

      getCustomerById: (customerId) => customerId ? get().customers.find((c) => c.id === customerId) : undefined,

      addRoute: async (route) => {
        const routeWithTimestamp: Route = { ...route, updated_at: new Date().toISOString() };
        set((state) => ({ routes: [routeWithTimestamp, ...state.routes] }));
        try {
          await setDoc(doc(db, 'routes', route.id), routeWithTimestamp);
        } catch (error) { console.error(error); }
      },

      addMotoboy: async (motoboy) => {
        const dataWithTimestamp: Motoboy = { ...motoboy, updated_at: new Date().toISOString() };
        set((state) => ({ motoboys: [...state.motoboys, dataWithTimestamp] }));
        try {
          await setDoc(doc(db, 'motoboys', motoboy.id), dataWithTimestamp);
        } catch (error) { console.error(error); }
      },

      addDelivery: async (delivery) => {
        const deliveryWithTimestamp: Delivery = { ...delivery, updated_at: new Date().toISOString() };
        set((state) => ({ deliveries: [deliveryWithTimestamp, ...state.deliveries] }));
        try {
          await setDoc(doc(db, 'deliveries', delivery.id), deliveryWithTimestamp);
        } catch (error) { console.error(error); }
      },

      updateDelivery: async (id, updatedData) => {
        const dataWithTimestamp: Partial<Delivery> = { ...updatedData, updated_at: new Date().toISOString() };
        set((state) => ({
          deliveries: state.deliveries.map((d) => d.id === id ? { ...d, ...dataWithTimestamp } as Delivery : d)
        }));
        try {
          const safeUpdate = Object.fromEntries(Object.entries(dataWithTimestamp).filter(([_, v]) => v !== undefined));
          await updateDoc(doc(db, 'deliveries', id), safeUpdate);
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

      addCustomer: async (customer) => {
        const customerWithTimestamp: Customer = { ...customer, updated_at: new Date().toISOString() };
        set((state) => ({ customers: [customerWithTimestamp, ...state.customers] }));
        try {
          await setDoc(doc(db, 'customers', customer.id), customerWithTimestamp);
        } catch (error) { console.error(error); }
      },

      updateCustomer: async (id, updatedData) => {
        const dataWithTimestamp: Partial<Customer> = { ...updatedData, updated_at: new Date().toISOString() };
        set((state) => ({
          customers: state.customers.map((c) => c.id === id ? { ...c, ...dataWithTimestamp } as Customer : c)
        }));
        try {
          const safeUpdate = Object.fromEntries(Object.entries(dataWithTimestamp).filter(([_, v]) => v !== undefined));
          await updateDoc(doc(db, 'customers', id), safeUpdate);
        } catch (error) { console.error(error); }
      },

      findOrCreateCustomer: async (name, details) => {
        const trimmed = name.trim();
        if (!trimmed) return '';

        const extractNeighborhood = (address?: string): string | undefined => {
          if (!address) return undefined;
          const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
          if (parts.length < 2) return undefined;
          return parts[parts.length - 1];
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
            const safeUpdate = Object.fromEntries(Object.entries(updatedFields).filter(([_, v]) => v !== undefined));
            await updateDoc(doc(db, 'customers', existing.id), safeUpdate);
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
          const safeCustomer = Object.fromEntries(Object.entries(newCustomer).filter(([_, v]) => v !== undefined));
          await setDoc(doc(db, 'customers', newCustomer.id), safeCustomer);
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
        motoboys: state.motoboys // Mantém salvo offline
      }),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true); },
    }
  )
);
