'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Trash2, CheckSquare, Moon, LogOut, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';

export default function MaisPage() {
  const router = useRouter();
  
  const user = useAppStore((state) => state.user);
  const logout = useAppStore((state) => state.logout);
  const initData = useAppStore((state) => state.initData); // 🔥 BUSCAMOS A FUNÇÃO REAL DO BANCO
  const isSyncing = useAppStore((state) => state.isSyncing); // 🔥 PEGAMOS O ESTADO DE LOADING
  const syncError = useAppStore((state) => state.syncError); // 🔥 PEGAMOS SE HOUVE ERRO
  
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Álefe';
  const fullName = user?.displayName || 'Álefe Jôhsefe';

  // 🔥 AGORA O BOTÃO FAZ A SINCRONIZAÇÃO DE VERDADE
  const handleSync = async () => {
    if (isSyncing) return; // Evita duplo clique se já estiver carregando
    
    toast.loading('Sincronizando com a nuvem...', { id: 'sync-toast' });
    
    try {
      await initData();
      
      // O Zustand atualiza o syncError logo após o initData terminar. 
      // Damos um leve delay de meio segundo só pra garantir que o React leu a variável atualizada
      setTimeout(() => {
          const currentState = useAppStore.getState();
          if (currentState.syncError) {
             toast.error('Erro na sincronização!', { 
                 id: 'sync-toast',
                 description: 'Não foi possível conectar. Você está offline ou o Firebase bloqueou o acesso.',
                 duration: 4000
             });
          } else {
             toast.success('Sincronizado com sucesso! ✅', { 
                 id: 'sync-toast',
                 description: 'Rotas, clientes e entregas estão atualizados com a nuvem.',
                 duration: 3000
             });
          }
      }, 500);

    } catch (error) {
      toast.error('Erro inesperado', { id: 'sync-toast', description: 'Algo deu muito errado ao tentar buscar os dados.' });
    }
  };

  const handleOpenClearModal = () => {
    setConfirmText(''); 
    setIsClearModalOpen(true);
  };

  const handleConfirmClear = () => {
    if (confirmText.trim().toLowerCase() !== 'excluir') {
      toast.error('Texto incorreto. Digite "excluir" para confirmar.');
      return;
    }
    
    toast.error('Função desabilitada', {
      description: 'Por segurança, a limpeza de dados está bloqueada nesta fase.',
    });
    setIsClearModalOpen(false);
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

      {/* OPERAÇÃO (Apenas iFood) */}
      <div className="flex flex-col gap-2">
        <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Operação Diária
        </h3>
        <div className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
          <button
            onClick={() => router.push('/confirmar')}
            className="flex w-full items-center gap-4 p-4 transition-colors active:bg-zinc-800/50 hover:bg-zinc-800/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <CheckSquare size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="font-semibold text-zinc-100">Confirmar Entregas</p>
              <p className="text-xs text-zinc-500">Portal do iFood embutido</p>
            </div>
          </button>
        </div>
      </div>

      {/* SISTEMA E DADOS */}
      <div className="flex flex-col gap-2">
        <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Sistema e Dados
        </h3>
        <div className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40 flex flex-col">
          
          <div className="flex items-center gap-4 p-4 border-b border-zinc-800/80">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
              <Moon size={20} />
            </div>
            <div className="text-left flex-1">
              <p className="font-semibold text-zinc-100">Modo Escuro Ativo</p>
              <p className="text-xs text-zinc-500">Padrão visual de alta performance</p>
            </div>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex w-full items-center gap-4 border-b border-zinc-800/80 p-4 transition-colors active:bg-zinc-800/50 hover:bg-zinc-800/30 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${syncError ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
              <RefreshCw size={20} className={isSyncing ? "animate-spin" : ""} />
            </div>
            <div className="flex-1 text-left">
              <p className={`font-semibold ${syncError ? 'text-red-400' : 'text-zinc-100'}`}>
                {isSyncing ? 'Buscando dados...' : (syncError ? 'Falha na Última Sincronização' : 'Sincronizar agora')}
              </p>
              <p className="text-xs text-zinc-500">
                {isSyncing ? 'Aguarde um momento' : 'Forçar sincronização com a nuvem'}
              </p>
            </div>
          </button>

          <button
            onClick={handleOpenClearModal}
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

      {/* ========================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (ESTILO FIREBASE)        */}
      {/* ========================================================= */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-950 border border-red-500/30 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            
            <div className="flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="font-heading text-lg font-black text-zinc-50">Apagar Dados Locais</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  Isso removerá todas as rotas e entregas do seu aparelho. Essa ação <strong className="text-red-400">não pode ser desfeita</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-wider text-center">
                Digite "excluir" para confirmar
              </label>
              <input
                type="text"
                placeholder="excluir"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="h-12 rounded-xl border border-zinc-800 bg-zinc-900 px-4 text-center text-zinc-100 font-bold tracking-widest placeholder:text-zinc-700 placeholder:font-normal focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="flex-1 h-12 rounded-xl bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClear}
                disabled={confirmText.trim().toLowerCase() !== 'excluir'}
                className="flex-1 h-12 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
              >
                Apagar Tudo
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
