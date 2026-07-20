'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LogIn, Bike } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAppStore((state) => state.user);
  const authLoaded = useAppStore((state) => state.authLoaded);
  const login = useAppStore((state) => state.loginWithGoogle);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      useAppStore.setState({ user: currentUser, authLoaded: true });
      if (currentUser) {
        useAppStore.getState().initData(); // Só puxa os dados se estiver logado
      }
    });
    return () => unsubscribe();
  }, []);

  if (!authLoaded) {
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
