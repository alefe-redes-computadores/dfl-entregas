'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LogIn, LockKeyhole, LogOut } from 'lucide-react';
import { isSuperadminUid } from '@/lib/access/roles';
import { StaffPortal } from '@/components/access/StaffPortal';
import { isIsolatedStaffOrigin } from '@/lib/access/staffOrigin';
import { Capacitor } from '@capacitor/core';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAppStore((state) => state.user);
  const authLoaded = useAppStore((state) => state.authLoaded);
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const login = useAppStore((state) => state.loginWithGoogle);
  const logout = useAppStore((state) => state.logout);

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
    if (authLoaded && user && isSuperadminUid(user.uid) && hasHydrated && !hasInitializedRef.current && (typeof window === 'undefined' || !isIsolatedStaffOrigin(window.location.origin))) {
      hasInitializedRef.current = true;
      useAppStore.getState().initData();
    }
  }, [user, authLoaded, hasHydrated]);

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
        <div className="mb-7">
          <img
            src="/brand/dfl-entregas.png?v=2"
            alt="DFL Entregas"
            width={128}
            height={128}
            className="h-28 w-28 object-contain"
          />
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

  // R21: outros usuarios nao inicializam o store global ou rotinas operacionais.
  // Regras do Firebase continuam restritas ao UID do superadministrador.
  // Mesmo o owner nao pode abrir dados administrativos no dominio reservado
  // a funcionarios: reduz o risco de IndexedDB e cache cruzados.
  if (isSuperadminUid(user.uid) && typeof window !== 'undefined' && isIsolatedStaffOrigin(window.location.origin)) {
    return <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100"><h1 className="text-xl font-bold">Area exclusiva da equipe</h1><p className="mt-3 text-sm text-zinc-400">Para gerenciar o aplicativo, acesse o endereco administrativo.</p><button type="button" onClick={() => void logout()} className="mt-6 rounded-xl border border-zinc-700 px-6 py-3">Sair da conta</button></div>;
  }

  if (!isSuperadminUid(user.uid)) {
    // Trava dupla: o Portal so monta com flag EXPLICITA no build.
    // Sem rules homologadas, nenhuma conta le staff_accounts.
    if (process.env.NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED === 'true'
        && typeof window !== 'undefined'
        && isIsolatedStaffOrigin(window.location.origin)
        && !Capacitor.isNativePlatform()) {
      return <StaffPortal uid={user.uid} />;
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-7 text-center text-zinc-100">
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-3xl border border-amber-500/25 bg-amber-500/10 text-amber-400"><LockKeyhole size={29} /></div>
        <h1 className="font-heading text-2xl font-black">Acesso nao liberado</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-400">Esta conta ainda nao tem permissao para consultar dados do DFL Entregas. Solicite liberacao ao administrador.</p>
        <p className="mt-4 text-xs text-amber-300">Os acessos de funcionarios ainda estao em preparacao.</p>
        <button type="button" onClick={() => void logout()} className="mt-7 flex h-12 items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-6 text-sm font-bold text-zinc-100"><LogOut size={16}/> Sair da conta</button>
      </div>
    );
  }

  return <>{children}</>;
}
