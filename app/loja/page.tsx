'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Power, Users, BellRing, Bike, TrendingUp, 
  Package, Calendar, AlertTriangle, Check, ChevronUp, ChevronDown, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete'; // 🔥 IMPORTAÇÃO DO AUTOCOMPLETE

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function LojaPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  // ------------------------------------------------------------------
  // ESTADOS GLOBAIS (ZUSTAND)
  // ------------------------------------------------------------------
  const deliveries = useAppStore((state) => state.deliveries);
  const motoboys = useAppStore((state) => state.motoboys);
  const updateMotoboy = useAppStore((state) => state.updateMotoboy);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);

  // A TRAVA DE HIDRATAÇÃO: Só carrega depois que o banco local acordou
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const storeSettings = useAppStore((state) => state.storeSettings) || {};
  const updateStoreSettings = useAppStore((state) => state.updateStoreSettings);

  const routeAlertsEnabled = useAppStore((state) => state.routeAlertsEnabled);
  const setRouteAlertsEnabled = useAppStore((state) => state.setRouteAlertsEnabled);

  // ------------------------------------------------------------------
  // ESTADOS LOCAIS (SINCRONIZADOS COM A MEMÓRIA)
  // ------------------------------------------------------------------
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [activeDays, setActiveDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]); 
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  
  // Endereço base integrado com o Autocomplete
  const [storeAddress, setStoreAddress] = useState('Patos de Minas, MG');

  // Estados dos Spinners Customizados
  const [openHour, setOpenHour] = useState(18);
  const [openMin, setOpenMin] = useState(0);
  const [closeHour, setCloseHour] = useState(23);
  const [closeMin, setCloseMin] = useState(59);

  // Sincroniza a memória global com a tela assim que a hidratação terminar
  useEffect(() => {
    setIsMounted(true);
    if (hasHydrated && storeSettings) {
      setIsStoreOpen(storeSettings.isOpen ?? false);
      setActiveDays(storeSettings.activeDays || [1, 2, 3, 4, 5, 6, 0]);
      setAlertsEnabled(storeSettings.alertsEnabled ?? false);
      setStoreAddress(storeSettings.storeAddress || 'Patos de Minas, MG');
      
      if (storeSettings.openingTime) {
        const [h, m] = storeSettings.openingTime.split(':').map(Number);
        setOpenHour(h || 18);
        setOpenMin(m || 0);
      }
      if (storeSettings.closingTime) {
        const [h, m] = storeSettings.closingTime.split(':').map(Number);
        setCloseHour(h || 23);
        setCloseMin(m || 59);
      }
    }
  }, [storeSettings, hasHydrated]);

  // ------------------------------------------------------------------
  // INTELIGÊNCIA: RESUMO DO DIA & ESCALA
  // ------------------------------------------------------------------
  const todayStr = new Date().toDateString();
  const todaysDeliveries = deliveries.filter(d => {
    const dDateStr = new Date(d.updated_at || Date.now()).toDateString();
    return dDateStr === todayStr;
  });

  const totalEntregas = todaysDeliveries.length;
  const faturamentoTotal = todaysDeliveries.reduce((acc, d) => acc + (d.value || 0), 0);

  // ------------------------------------------------------------------
  // AÇÕES E SALVAMENTO
  // ------------------------------------------------------------------
  const toggleStore = async () => {
    const newState = !isStoreOpen;
    setIsStoreOpen(newState);
    await updateStoreSettings({ isOpen: newState });
    
    toast.success(newState ? 'Operação Aberta! Bom trabalho, Capitão!' : 'Operação Fechada! Bom descanso!', {
      style: { background: newState ? '#10b981' : '#ef4444', color: '#fff', border: 'none' }
    });
  };

  const toggleDay = (index: number) => {
    setActiveDays(prev => 
      prev.includes(index) ? prev.filter(d => d !== index) : [...prev, index]
    );
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!storeAddress.trim()) {
      toast.error('O endereço da lanchonete é obrigatório!');
      return;
    }

    const openingTime = `${String(openHour).padStart(2, '0')}:${String(openMin).padStart(2, '0')}`;
    const closingTime = `${String(closeHour).padStart(2, '0')}:${String(closeMin).padStart(2, '0')}`;
    
    await updateStoreSettings({
      ...storeSettings,
      openingTime,
      closingTime,
      activeDays,
      alertsEnabled,
      isOpen: isStoreOpen,
      storeAddress: storeAddress.trim()
    });

    toast.success('Configurações Salvas com Sucesso!', {
      description: 'Expediente e Endereço de Base atualizados.'
    });

    if (alertsEnabled && Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.requestPermissions();
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Prepara a chapa! 🍔',
              body: 'Faltam 30 minutos para abrir a lanchonete!',
              id: 1,
              schedule: { at: new Date(Date.now() + 1000 * 5) },
            }
          ]
        });
      } catch (error) {
        console.error("Erro na notificação", error);
      }
    }
  };

  const handleToggleMotoboyScale = async (motoboyId: string, currentActiveStatus: boolean) => {
    await updateMotoboy(motoboyId, { active: !currentActiveStatus } as any);
    toast.success(!currentActiveStatus ? 'Motoboy escalado para hoje!' : 'Motoboy removido da escala.');
  };

  const handleMinUp = (current: number, setFn: (val: number) => void) => {
    const next = current + 5;
    const rounded = next - (next % 5);
    setFn(rounded >= 60 ? 0 : rounded);
  };

  const handleMinDown = (current: number, setFn: (val: number) => void) => {
    if (current === 0) {
      setFn(55);
      return;
    }
    const rounded = current - (current % 5);
    setFn(current % 5 !== 0 ? rounded : rounded - 5);
  };

  if (!isMounted || !hasHydrated) return null; // Aguarda a tela brilhar com dados reais

  return (
    <div className="flex flex-col gap-6 pb-24 animate-in fade-in duration-300 relative">
      
      <PageHeader 
        title="Minha Loja" 
        subtitle="Centro de comando da Da Família Lanches" 
        to="/"
      />

      {/* BOTÃO MESTRE - STATUS DA LOJA */}
      <button 
        onClick={toggleStore}
        className={`relative overflow-hidden flex items-center justify-between p-5 rounded-[28px] border transition-all duration-500 cursor-pointer ${
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

      {/* RESUMO DA OPERAÇÃO & ESCALA */}
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

        <div className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-[24px] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5">
              <Bike size={14} className="text-amber-500" /> Escala de Motoboys (Hoje)
            </span>
            <button 
              onClick={() => router.push('/motoboys')} 
              className="text-[11px] font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
            >
              Gerenciar ➔
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {motoboys.length > 0 ? (
              motoboys.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleToggleMotoboyScale(m.id, m.active)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    m.active 
                      ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm' 
                      : 'bg-zinc-950 border border-zinc-800 text-zinc-600 opacity-60'
                  }`}
                >
                  <span>{m.name}</span>
                  {m.active && <Check size={12} className="text-amber-400" />}
                </button>
              ))
            ) : (
              <span className="text-xs text-zinc-600 font-semibold">Nenhum motoboy cadastrado.</span>
            )}
          </div>
        </div>
      </div>

      {/* ATALHOS DE GESTÃO RÁPIDA */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2">Gestão Rápida</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/motoboys')} className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/80 active:scale-95 transition-all text-left cursor-pointer">
            <Bike className="text-sky-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Equipe</p>
              <p className="text-[10px] text-zinc-500">Motoboys e Acertos</p>
            </div>
          </button>
          
          <button onClick={() => router.push('/clientes')} className="flex flex-col gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-[24px] hover:bg-zinc-800/80 active:scale-95 transition-all text-left cursor-pointer">
            <Users className="text-amber-400" size={24} />
            <div>
              <p className="font-bold text-zinc-100">Clientes</p>
              <p className="text-[10px] text-zinc-500">Endereços e Códigos</p>
            </div>
          </button>
        </div>
      </div>

      {/* AUTOMAÇÃO & HORÁRIOS */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2">Automação & Expediente</h2>
        
        <form onSubmit={handleSaveSchedule} className="flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-[28px] overflow-hidden p-4 gap-5">
          
          {/* ENDEREÇO DA LANCHONETE INTEGRADO COM GOOGLE MAPS AUTOCOMPLETE & VOZ */}
          <div className="flex flex-col gap-2">
            <AddressAutocomplete 
              value={storeAddress}
              onChange={setStoreAddress}
              placeholder="Rua, Número, Bairro, Cidade - MG"
              label="Endereço Base (Origem)"
            />
            <p className="text-[10px] text-zinc-500 leading-tight">Este endereço será usado como ponto de partida para organizar a rota inteligente dos motoboys no mapa.</p>
          </div>

          <div className="h-px w-full bg-zinc-800/80" />

          {/* DIAS DA SEMANA */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-zinc-300">
              <Calendar size={16} className="text-indigo-400" />
              <span className="text-sm font-bold">Dias de Funcionamento</span>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-between">
              {DAYS_OF_WEEK.map((day, index) => {
                const isActive = activeDays.includes(index);
                return (
                  <button 
                    key={day}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={`flex-1 h-11 min-w-[40px] rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center ${
                      isActive 
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' 
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SPINNERS DE HORA CUSTOMIZADOS (AGORA COM TRAVA DE MÚLTIPLOS DE 5) */}
          <div className="grid grid-cols-2 gap-3 border-t border-zinc-800/80 pt-5">
            
            {/* SPINNER: ABERTURA */}
            <div className="flex flex-col bg-zinc-950 border border-zinc-800 p-3 rounded-2xl gap-2">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider text-center">Abertura</span>
              <div className="flex items-center justify-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <button type="button" onClick={() => setOpenHour(h => h >= 23 ? 0 : h + 1)} className="p-1.5 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 cursor-pointer active:scale-95"><ChevronUp size={18}/></button>
                  <span className="text-xl font-black text-zinc-100 w-8 text-center">{String(openHour).padStart(2, '0')}</span>
                  <button type="button" onClick={() => setOpenHour(h => h <= 0 ? 23 : h - 1)} className="p-1.5 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 cursor-pointer active:scale-95"><ChevronDown size={18}/></button>
                </div>
                <span className="text-xl font-black text-zinc-600 mb-1">:</span>
                <div className="flex flex-col items-center gap-1">
                  <button type="button" onClick={() => handleMinUp(openMin, setOpenMin)} className="p-1.5 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 cursor-pointer active:scale-95"><ChevronUp size={18}/></button>
                  <span className="text-xl font-black text-zinc-100 w-8 text-center">{String(openMin).padStart(2, '0')}</span>
                  <button type="button" onClick={() => handleMinDown(openMin, setOpenMin)} className="p-1.5 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 cursor-pointer active:scale-95"><ChevronDown size={18}/></button>
                </div>
              </div>
            </div>

            {/* SPINNER: FECHAMENTO */}
            <div className="flex flex-col bg-zinc-950 border border-zinc-800 p-3 rounded-2xl gap-2">
              <span className="text-[10px] font-black uppercase text-red-400 tracking-wider text-center">Fechamento</span>
              <div className="flex items-center justify-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <button type="button" onClick={() => setCloseHour(h => h >= 23 ? 0 : h + 1)} className="p-1.5 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 cursor-pointer active:scale-95"><ChevronUp size={18}/></button>
                  <span className="text-xl font-black text-zinc-100 w-8 text-center">{String(closeHour).padStart(2, '0')}</span>
                  <button type="button" onClick={() => setCloseHour(h => h <= 0 ? 23 : h - 1)} className="p-1.5 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 cursor-pointer active:scale-95"><ChevronDown size={18}/></button>
                </div>
                <span className="text-xl font-black text-zinc-600 mb-1">:</span>
                <div className="flex flex-col items-center gap-1">
                  <button type="button" onClick={() => handleMinUp(closeMin, setCloseMin)} className="p-1.5 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 cursor-pointer active:scale-95"><ChevronUp size={18}/></button>
                  <span className="text-xl font-black text-zinc-100 w-8 text-center">{String(closeMin).padStart(2, '0')}</span>
                  <button type="button" onClick={() => handleMinDown(closeMin, setCloseMin)} className="p-1.5 bg-zinc-900 rounded-lg hover:bg-zinc-800 text-zinc-400 cursor-pointer active:scale-95"><ChevronDown size={18}/></button>
                </div>
              </div>
            </div>

          </div>

          {/* TOGGLES DE NOTIFICAÇÃO */}
          <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden mt-2">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center shrink-0">
                  <BellRing size={16} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-zinc-100 text-xs">Lembrete de Abertura</p>
                  <p className="text-[10px] text-zinc-500">Notifica 30 min antes</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setAlertsEnabled(!alertsEnabled)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 cursor-pointer ${alertsEnabled ? 'bg-sky-500' : 'bg-zinc-800 border border-zinc-700'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${alertsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div className="text-left">
                  <p className="font-bold text-zinc-100 text-xs">Alerta de Rota Fechada</p>
                  <p className="text-[10px] text-zinc-500">Quando motoboy voltar</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setRouteAlertsEnabled(!routeAlertsEnabled)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 cursor-pointer ${routeAlertsEnabled ? 'bg-amber-500' : 'bg-zinc-800 border border-zinc-700'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${routeAlertsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-sm transition-all shadow-lg cursor-pointer active:scale-[0.98] mt-2 uppercase tracking-wide"
          >
            Salvar Todas as Configurações
          </button>
        </form>

      </div>
    </div>
  );
}
