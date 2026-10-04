// app/mais/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { BellRing,
  Activity,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { UserAvatar } from '@/components/UserAvatar';

const DIAGNOSTICS_ADMIN_EMAIL = 'alefejohsefe@gmail.com';

export default function MaisPage() {
  const router = useRouter();

  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const fullName = user?.displayName?.trim() || 'Usuário DFL';
  const isDiagnosticsAdmin = user?.email?.trim().toLowerCase() === DIAGNOSTICS_ADMIN_EMAIL;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Sessão encerrada.');
    } catch {
      toast.error('Não foi possível sair da conta.');
    }
  };

  return (
    <div className="dfl-page relative animate-in fade-in duration-300">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500">
          Sistema
        </p>
        <h1 className="mt-1 font-heading text-2xl font-black text-zinc-50">
          Configurações e Mais
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Conta, ferramentas operacionais e estado da sincronização.
        </p>
      </header>

      <section className="flex items-center gap-3 rounded-[22px] border border-emerald-500/15 bg-gradient-to-br from-emerald-500/[.055] via-zinc-900/45 to-zinc-950 p-4 shadow-[0_14px_32px_rgba(0,0,0,.14)]">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[18px] bg-gradient-to-br from-emerald-500 to-emerald-700 ring-2 ring-zinc-800">
          <UserAvatar photoURL={user?.photoURL} name={user?.displayName} fallbackClassName="text-xl" />
        </div>

        <div className="min-w-0 flex-1 text-left">
          <h2 className="font-heading text-lg font-bold text-zinc-50">
            {fullName}
          </h2>
          <p className="text-sm text-zinc-500">
            {user?.email || 'Administrador Operacional'}
          </p>
        </div>
      </section>
<section className="flex flex-col gap-2">
        <h2 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Sistema e dados
        </h2>

        <div className="flex flex-col overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
          <button
            type="button"
            onClick={() => router.push('/mais/notificacoes')}
            className="flex w-full items-center gap-4 border-b border-zinc-800/80 p-4 text-left transition-colors active:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <BellRing size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100">Notificações</p>
              <p className="text-xs text-zinc-500">
                Expediente, rotas, iFood, estoque e sistema
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-zinc-600" />
          </button>

          {isDiagnosticsAdmin && <button
            type="button"
            onClick={() => router.push('/mais/diagnostico')}
            className="flex w-full items-center gap-4 p-4 text-left transition-colors active:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
              <Activity size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-100">Diagnóstico local</p>
              <p className="text-xs text-zinc-500">
                Leituras retornadas, duração e notificações agendadas
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-zinc-600" />
          </button>}
        </div>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="mx-auto mb-4 mt-4 flex items-center gap-2 text-sm font-bold text-red-500 transition active:scale-95"
      >
        <LogOut size={16} />
        Sair da conta
      </button>
    </div>
  );
}
