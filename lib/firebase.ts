// lib/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { isIsolatedStaffOrigin } from '@/lib/access/staffOrigin';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

/**
 * No navegador/PWA, o Firestore mantém:
 * - documentos lidos;
 * - mutations pendentes;
 * - fila de escrita entre reloads;
 * - reconciliação automática quando a conexão retorna.
 *
 * O try/catch também protege HMR/reinicialização: se a instância já
 * tiver sido criada, reutilizamos getFirestore(app).
 */
const createFirestore = (): Firestore => {
  if (typeof window === 'undefined') {
    return getFirestore(app);
  }

  // Se a inicializacao de memoria falhar no dominio staff, NAO recuar ao cache padrao.
  if (isIsolatedStaffOrigin(window.location.origin)) {
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  }
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(app);
  }
};

const db = createFirestore();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export {
  app,
  db,
  auth,
  googleProvider,
};
