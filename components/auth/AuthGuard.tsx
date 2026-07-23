'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LogIn, Bike } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAppStore((state) => state.user);
  const authLoaded = useAppStore((state) => state.authLoaded);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const login = useAppStore((state) => state.loginWithGoogle);

  const hasInitializedRef = useRef(false);

  // Só cuida do login/logout do Firebase. NÃO dispara initData aqui —
  // isso fica por conta do efeito abaixo, que espera a hidratação local terminar.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      useAppStore.setState({ user: currentUser, authLoaded: true });
      if (!currentUser) {
        hasInitializedRef.current = false; // permite reinicializar num próximo login
      }
    });
    return () => unsubscribe();
  }, []);

  // Só sincroniza com a nuvem quando: usuário logado + storage local já hidratado.
  // Isso evita o initData rodar em cima de um estado local ainda vazio (rehidratação
  // do zustand-persist ainda não terminou) e sobrescrever/apagar dados criados offline
  // que ainda não tinham subido pro Firebase.
  useEffect(() => {
    if (user && hasHydrated && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      useAppStore.getState().initData();
    }
  }, [user, hasHydrated]);

  if (!authLoaded || !hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6">
        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <Bike size={48} />
        </div>
        <h1 className="mb-2 font-heading text-3xl font-bold text-zinc-50">DFL Entregas</h1>
        <p className="mb-12 text-center text-zinc-400">
          Acesso restrito à logística da Da Família Lanches.
        </p>

        <button
          onClick={login}
          className="flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-zinc-100 py-4 font-bold text-zinc-900 transition-transform active:scale-95"
        >
          <LogIn size={20} />
          Entrar com o Google
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
