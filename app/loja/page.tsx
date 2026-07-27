'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Store, Power, Users, MapPin, Clock, 
  BellRing, ChevronRight, Bike, Settings, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

export default function LojaPage() {
  const router = useRouter();
  
  // Estados simulados (depois ligamos no Zustand)
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);

  const toggleStore = () => {
    setIsStoreOpen(!isStoreOpen);
    toast.success(!isStoreOpen ? 'Loja Aberta! Bom trabalho!' : 'Loja Fechada! Bom descanso!', {
      style: { background: !isStoreOpen ? '#10b981' : '#ef4444', color: '#fff', border: 'none' }
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-24 animate-in fade-in duration-300">
      
      {/* HEADER DA LOJA */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-black text-zinc-50 flex items-center gap-2">
          <Store className="text-emerald-500" /> Minha Loja
        </h1>
        <p className="text-sm text-zinc-500">Gestão de operação, horários e alertas da lanchonete.</p>
      </div>

      {/* BOTÃO MESTRE - STATUS DA LOJA */}
      <button 
        onClick={toggleStore}
        className={`relative overflow-hidden flex items-center justify-between p-5 rounded-[28px] border transition-all duration-500 ${
          isStoreOpen 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <div className="flex items-center gap-4 relative z-10">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-500 ${
            isStoreOpen ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-zinc-800 text-zinc-500'
          }`}>
            <Power size={24} strokeWidth={2.5} />
          </div>
          <div className="text-left flex flex-col">
            <span className={`text-lg font-black tracking-wide uppercase transition-colors ${isStoreOpen ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {isStoreOpen ? 'Operação Aberta' : 'Operação Fechada'}
            </span>
            <span className="text-xs font-semibold text-zinc-500">
              {isStoreOpen ? 'Recebendo pedidos e lançando rotas' : 'Sistema em modo de espera'}
            </span>
          </div>
        </div>
      </button>

      {/* ATALHOS DE GESTÃO */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2">Gestão Rápida</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/motoboys')} className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/60 active:scale-95 transition-all text-left">
            <Bike className="text-sky-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Motoboys</p>
              <p className="text-[10px] text-zinc-500">Acertos e Regras</p>
            </div>
          </button>
          
          <button onClick={() => router.push('/clientes')} className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/60 active:scale-95 transition-all text-left">
            <Users className="text-amber-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Clientes</p>
              <p className="text-[10px] text-zinc-500">Endereços e Códigos</p>
            </div>
          </button>

          <button className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/60 active:scale-95 transition-all text-left">
            <MapPin className="text-purple-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Zonas & Taxas</p>
              <p className="text-[10px] text-zinc-500">Bairros (Em breve)</p>
            </div>
          </button>

          <button className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/60 active:scale-95 transition-all text-left">
            <Settings className="text-zinc-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Ajustes</p>
              <p className="text-[10px] text-zinc-500">Gerais da loja</p>
            </div>
          </button>
        </div>
      </div>

      {/* AUTOMAÇÃO E ALERTAS */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2">Automação</h2>
        
        <div className="flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-[28px] overflow-hidden">
          
          <button className="flex items-center justify-between p-4 border-b border-zinc-800/80 hover:bg-zinc-800/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center">
                <Clock size={20} />
              </div>
              <div className="text-left">
                <p className="font-bold text-zinc-100 text-sm">Horários de Abertura</p>
                <p className="text-xs text-zinc-500">Qui a Dom • 18:00 às 00:00</p>
              </div>
            </div>
            <ChevronRight className="text-zinc-600" size={20} />
          </button>

          <div className="flex items-center justify-between p-4 hover:bg-zinc-800/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-pink-500/10 text-pink-400 rounded-full flex items-center justify-center">
                <BellRing size={20} />
              </div>
              <div className="text-left">
                <p className="font-bold text-zinc-100 text-sm">Lembretes do Turno</p>
                <p className="text-xs text-zinc-500">Notificar fechamento e abertura</p>
              </div>
            </div>
            <button 
              onClick={() => setAlertsEnabled(!alertsEnabled)} 
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${alertsEnabled ? 'bg-emerald-500' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${alertsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
