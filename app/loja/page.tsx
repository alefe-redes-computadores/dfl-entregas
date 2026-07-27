'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Store, Power, Users, MapPin, Clock, 
  BellRing, Bike, Settings, TrendingUp, 
  Package, Calendar, CheckCircle2, Bell, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function LojaPage() {
  const router = useRouter();
  
  // ------------------------------------------------------------------
  // ESTADOS GLOBAIS (Lendo a operação em tempo real)
  // ------------------------------------------------------------------
  const deliveries = useAppStore((state) => state.deliveries);
  const motoboys = useAppStore((state) => state.motoboys);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);

  // ------------------------------------------------------------------
  // ESTADOS LOCAIS (Configurações da Loja)
  // ------------------------------------------------------------------
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [openTime, setOpenTime] = useState('18:00');
  const [closeTime, setCloseTime] = useState('23:59');
  const [activeDays, setActiveDays] = useState<number[]>([4, 5, 6, 0]); // Qui, Sex, Sáb, Dom
  
  // Alertas
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [routeAlerts, setRouteAlerts] = useState(true);

  // ------------------------------------------------------------------
  // INTELIGÊNCIA: RESUMO DO DIA
  // ------------------------------------------------------------------
  const todayStr = new Date().toDateString();
  const todaysDeliveries = deliveries.filter(d => {
    const dDateStr = new Date(d.updated_at || d.createdAt || Date.now()).toDateString();
    return dDateStr === todayStr;
  });

  const totalEntregas = todaysDeliveries.length;
  const faturamentoTotal = todaysDeliveries.reduce((acc, d) => acc + (d.value || 0), 0);
  
  // Pega apenas os motoboys marcados como "Fixo" e que estão Ativos
  const motoboysFixos = motoboys.filter(m => m.active && (m as any).type === 'fixo');

  // ------------------------------------------------------------------
  // AÇÕES
  // ------------------------------------------------------------------
  const toggleStore = () => {
    const newState = !isStoreOpen;
    setIsStoreOpen(newState);
    toast.success(newState ? 'Operação Aberta! Bom trabalho, Capitão!' : 'Operação Fechada! Bom descanso!', {
      style: { background: newState ? '#10b981' : '#ef4444', color: '#fff', border: 'none' }
    });
  };

  const toggleDay = (index: number) => {
    setActiveDays(prev => 
      prev.includes(index) ? prev.filter(d => d !== index) : [...prev, index]
    );
  };

  const handleToggleAlerts = () => {
    const newState = !alertsEnabled;
    setAlertsEnabled(newState);
    if (newState) {
      toast('Permissão de Notificação Solicitada', {
        description: 'O sistema nativo do celular pedirá permissão em breve.',
        icon: <Bell className="text-sky-500" />
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-24 animate-in fade-in duration-300 relative">
      
      {/* HEADER DA LOJA */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-black text-zinc-50 flex items-center gap-2">
          <Store className="text-emerald-500" /> Minha Loja
        </h1>
        <p className="text-sm text-zinc-500">Centro de comando da Da Família Lanches.</p>
      </div>

      {/* BOTÃO MESTRE - STATUS DA LOJA */}
      <button 
        onClick={toggleStore}
        className={`relative overflow-hidden flex items-center justify-between p-5 rounded-[28px] border transition-all duration-500 ${
          isStoreOpen 
            ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' 
            : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800/80'
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
              {isStoreOpen ? 'Recebendo pedidos e lançando rotas' : 'Sistema em modo de repouso'}
            </span>
          </div>
        </div>
      </button>

      {/* =========================================
          RESUMO DA OPERAÇÃO (TEMPO REAL)
      ========================================= */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2 flex items-center gap-2">
          <TrendingUp size={14} /> Desempenho de Hoje
        </h2>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-[24px] flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase">
              <Package size={14} className="text-sky-500" /> Entregas
            </span>
            <span className="font-heading text-2xl font-black text-zinc-100">{totalEntregas}</span>
          </div>
          
          <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-[24px] flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase">
              <TrendingUp size={14} className="text-emerald-500" /> Faturamento
            </span>
            <span className="font-heading text-xl font-black text-emerald-400">
              {isPrivacyMode ? 'R$ •••••' : `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`}
            </span>
          </div>
        </div>

        {/* MOTOBOYS ESCALADOS */}
        <div className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-[24px] flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
              <Bike size={14} className="text-amber-500" /> Motoboys Fixos Hoje
            </span>
            <div className="flex items-center gap-2 mt-1">
              {motoboysFixos.length > 0 ? (
                motoboysFixos.map(m => (
                  <span key={m.id} className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">
                    {m.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-600 font-semibold">Nenhum fixo ativo hoje</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          ATALHOS DE GESTÃO
      ========================================= */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2">Gestão Rápida</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/motoboys')} className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/80 active:scale-95 transition-all text-left">
            <Bike className="text-sky-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Equipe</p>
              <p className="text-[10px] text-zinc-500">Motoboys e Acertos</p>
            </div>
          </button>
          
          <button onClick={() => router.push('/clientes')} className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/80 active:scale-95 transition-all text-left">
            <Users className="text-amber-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Clientes</p>
              <p className="text-[10px] text-zinc-500">Endereços e Códigos</p>
            </div>
          </button>

          <button className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/80 active:scale-95 transition-all text-left opacity-60">
            <MapPin className="text-purple-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Zonas</p>
              <p className="text-[10px] text-zinc-500">Taxas (Em breve)</p>
            </div>
          </button>

          <button className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/80 active:scale-95 transition-all text-left opacity-60">
            <Settings className="text-zinc-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Cardápio</p>
              <p className="text-[10px] text-zinc-500">Lanches (Em breve)</p>
            </div>
          </button>
        </div>
      </div>

      {/* =========================================
          AUTOMAÇÃO & HORÁRIOS
      ========================================= */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2">Automação & Horários</h2>
        
        <div className="flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-[28px] overflow-hidden p-4 gap-5">
          
          {/* DIAS DE FUNCIONAMENTO */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-zinc-300">
              <Calendar size={16} className="text-indigo-400" />
              <span className="text-sm font-bold">Dias de Funcionamento</span>
            </div>
            <div className="flex justify-between items-center gap-1">
              {DAYS_OF_WEEK.map((day, index) => {
                const isActive = activeDays.includes(index);
                return (
                  <button 
                    key={day}
                    onClick={() => toggleDay(index)}
                    className={`h-10 w-10 rounded-full text-xs font-bold transition-all ${
                      isActive 
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* HORÁRIOS */}
          <div className="grid grid-cols-2 gap-3 border-t border-zinc-800/80 pt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Abre às</label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="time" 
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 text-sm font-bold text-zinc-200 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase">Fecha às</label>
              <div className="relative">
                <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="time" 
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 text-sm font-bold text-zinc-200 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

        </div>

        {/* ALERTAS PUSH */}
        <div className="flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-[28px] overflow-hidden mt-1">
          
          <div className="flex items-center justify-between p-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center">
                <BellRing size={18} />
              </div>
              <div className="text-left">
                <p className="font-bold text-zinc-100 text-sm">Lembrete de Abertura</p>
                <p className="text-xs text-zinc-500">Notificar 30 min antes de abrir</p>
              </div>
            </div>
            <button 
              onClick={handleToggleAlerts} 
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${alertsEnabled ? 'bg-sky-500' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${alertsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                <AlertTriangle size={18} />
              </div>
              <div className="text-left">
                <p className="font-bold text-zinc-100 text-sm">Alerta de Rota Fechada</p>
                <p className="text-xs text-zinc-500">Avisar quando motoboy voltar</p>
              </div>
            </div>
            <button 
              onClick={() => setRouteAlerts(!routeAlerts)} 
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${routeAlerts ? 'bg-amber-500' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${routeAlerts ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
