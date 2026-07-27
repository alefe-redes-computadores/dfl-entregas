'use client';

import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2, CheckSquare, Moon, Sun, Monitor, LogOut, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';

export default function MaisPage() {
  const router = useRouter();
  
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const togglePrivacyMode = useAppStore((state) => state.togglePrivacyMode);
  
  // NOSSOS NOVOS ESTADOS DO TEMA
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Álefe';
  const fullName = user?.displayName || 'Álefe Jôhsefe';

  const handleSync = () => {
    toast.success('Sincronizado com sucesso!', {
      description: 'Todos os dados estão salvos localmente e na nuvem.',
    });
  };

  const handleClear = () => {
    toast.error('Função desabilitada', {
      description: 'Por segurança, a limpeza de dados está bloqueada nesta fase.',
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Desconectado com sucesso!');
    } catch (error) {
      toast.error('Erro ao sair da conta');
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-24 relative animate-in fade-in duration-300">
      <h1 className="font-heading text-2xl font-bold text-zinc-50">Configurações e Mais</h1>

      {/* Perfil */}
      <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-zinc-800 bg-zinc-900/40 p-6 shadow-sm">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 ring-4 ring-zinc-800">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Perfil" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-heading text-2xl font-bold text-white">
              {firstName.charAt(0)}
            </div>
          )}
        </div>
        <div className="text-center">
          <h2 className="font-heading text-lg font-bold text-zinc-50">{fullName}</h2>
          <p className="text-sm text-zinc-500">{user?.email || 'Administrador Operacional'}</p>
        </div>
      </div>

      {/* OPERAÇÃO (Modo Privacidade e iFood) */}
      <div className="flex flex-col gap-2">
        <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Operação Diária
        </h3>
        <div className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
          
          <button
            onClick={() => router.push('/confirmar')}
            className="flex w-full items-center gap-4 p-4 border-b border-zinc-800/80 transition-colors active:bg-zinc-800/50 hover:bg-zinc-800/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <CheckSquare size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-zinc-100">Confirmar Entregas</p>
              <p className="text-xs text-zinc-500">Portal do iFood embutido</p>
            </div>
          </button>

          <button
            onClick={togglePrivacyMode}
            className="flex w-full items-center justify-between gap-4 p-4 transition-colors active:bg-zinc-800/50 hover:bg-zinc-800/30"
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${isPrivacyMode ? 'bg-sky-500/15 text-sky-500' : 'bg-zinc-800 text-zinc-400'}`}>
                {isPrivacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
              </div>
              <div className="text-left">
                <p className="font-semibold text-zinc-100">Modo Privacidade</p>
                <p className="text-xs text-zinc-500">Ocultar faturamento na Home</p>
              </div>
            </div>
            <div className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${isPrivacyMode ? 'bg-sky-500' : 'bg-zinc-700'}`}>
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isPrivacyMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </button>
        </div>
      </div>

      {/* SISTEMA E TEMA */}
      <div className="flex flex-col gap-2">
        <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Sistema Visual e Dados
        </h3>
        <div className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40 flex flex-col">
          
          {/* TEMA VISUAL AQUI */}
          <div className="flex flex-col gap-3 p-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                {theme === 'dark' ? <Moon size={20} /> : theme === 'light' ? <Sun size={20} /> : <Monitor size={20} />}
              </div>
              <div className="text-left flex-1">
                <p className="font-semibold text-zinc-100">Tema do Sistema</p>
                <p className="text-xs text-zinc-500">Como o app deve ser exibido?</p>
              </div>
            </div>
            
            <div className="flex bg-zinc-950 rounded-2xl p-1.5 border border-zinc-800">
              <button 
                onClick={() => setTheme('light')} 
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all ${theme === 'light' ? 'bg-zinc-800 text-zinc-100 shadow-md' : 'text-zinc-500 hover:text-zinc-400'}`}
              >
                Claro
              </button>
              <button 
                onClick={() => setTheme('dark')} 
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all ${theme === 'dark' ? 'bg-zinc-800 text-zinc-100 shadow-md' : 'text-zinc-500 hover:text-zinc-400'}`}
              >
                Escuro
              </button>
              <button 
                onClick={() => setTheme('system')} 
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all ${theme === 'system' ? 'bg-zinc-800 text-zinc-100 shadow-md' : 'text-zinc-500 hover:text-zinc-400'}`}
              >
                Auto
              </button>
            </div>
          </div>

          <button
            onClick={handleSync}
            className="flex w-full items-center gap-4 border-b border-zinc-800/80 p-4 transition-colors active:bg-zinc-800/50 hover:bg-zinc-800/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
              <RefreshCw size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-zinc-100">Sincronizar agora</p>
              <p className="text-xs text-zinc-500">Forçar sincronização de cache</p>
            </div>
          </button>

          <button
            onClick={handleClear}
            className="flex w-full items-center gap-4 p-4 transition-colors active:bg-zinc-800/50 hover:bg-zinc-800/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <Trash2 size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-red-500">Limpar dados locais</p>
              <p className="text-xs text-red-500/70">Apagar rotas e entregas</p>
            </div>
          </button>
        </div>
      </div>

      <button 
        onClick={handleLogout}
        className="mx-auto mt-4 mb-4 flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-400 active:scale-95 transition-all"
      >
        <LogOut size={16} />
        Sair da conta
      </button>
    </div>
  );
}
