'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Power, Users, BellRing, Bike, TrendingUp, Wallet, Package, 
  AlertTriangle, Check, ChevronRight, X, Banknote, CreditCard, QrCode,
  Calendar, Clock, Trash2, Plus, Info, MapPin, ChevronDown, ChevronLeft, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete';
import type { DaySchedule, StorePause, Shift, HolidayOverride } from '@/types';

const DAYS_OF_WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

interface BrasilApiHoliday {
  date: string;
  name: string;
  type: string;
}

export default function LojaPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  const deliveries = useAppStore((state) => state.deliveries);
  const routes = useAppStore((state) => state.routes);
  const motoboys = useAppStore((state) => state.motoboys);
  const updateMotoboy = useAppStore((state) => state.updateMotoboy);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);

  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const storeSettings = useAppStore((state) => state.storeSettings) || {};
  const updateStoreSettings = useAppStore((state) => state.updateStoreSettings);

  const routeAlertsEnabled = useAppStore((state) => state.routeAlertsEnabled);
  const setRouteAlertsEnabled = useAppStore((state) => state.setRouteAlertsEnabled);

  // States Básicos
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [storeAddress, setStoreAddress] = useState('Patos de Minas, MG');

  // Modais de Performance
  const [isLogisticsModalOpen, setIsLogisticsModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);

  // Sistema de Expediente Avançado (iFood)
  const [activeTab, setActiveTab] = useState<'horarios' | 'pausas' | 'feriados'>('horarios');
  const [schedule, setSchedule] = useState<Record<number, DaySchedule>>({});
  const [pauses, setPauses] = useState<StorePause[]>([]);
  const [holidaysOverrides, setHolidaysOverrides] = useState<Record<string, HolidayOverride>>({});
  const [apiHolidays, setApiHolidays] = useState<BrasilApiHoliday[]>([]);

  // Modais de Edição de Horários
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [tempDaySchedule, setTempDaySchedule] = useState<DaySchedule>({ active: false, shifts: [] });
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [tempPause, setTempPause] = useState<StorePause>({ id: '', start_date: '', end_date: '', reason: '' });

  // Custom Time Picker (Bottom Sheet)
  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minScrollRef = useRef<HTMLDivElement>(null);
  const [timePicker, setTimePicker] = useState<{
    isOpen: boolean;
    shiftIndex: number;
    field: 'start' | 'end';
    hour: string;
    minute: string;
  } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    if (hasHydrated && storeSettings) {
      setIsStoreOpen(storeSettings.isOpen ?? false);
      setAlertsEnabled(storeSettings.alertsEnabled ?? false);
      setStoreAddress(storeSettings.storeAddress || 'Patos de Minas, MG');
      
      // O padrão que você pediu: Qui, Sex, Sab, Dom das 18h às 23h
      const defaultSchedule = Object.fromEntries(
        [0, 1, 2, 3, 4, 5, 6].map(day => [
          day, 
          { active: [0, 4, 5, 6].includes(day), shifts: [{ start: '18:00', end: '23:00' }] }
        ])
      );
      setSchedule(storeSettings.schedule || defaultSchedule);
      setPauses(storeSettings.pauses || []);
      setHolidaysOverrides(storeSettings.holidaysOverrides || {});
      
      // Busca Feriados Nacionais
      fetch(`https://brasilapi.com.br/api/feriados/v1/${new Date().getFullYear()}`)
        .then(res => res.json())
        .then(data => {
           if (Array.isArray(data)) {
             const now = new Date();
             const upcoming = data.filter((h: any) => new Date(h.date).getTime() >= now.getTime() - 86400000);
             setApiHolidays(upcoming);
           }
        }).catch(err => console.error("Erro ao buscar feriados:", err));
    }
  }, [storeSettings, hasHydrated]);

  // Scrolla pro horário selecionado quando abre o TimePicker
  useEffect(() => {
    if (timePicker?.isOpen) {
      setTimeout(() => {
        if (hourScrollRef.current) {
          const hEl = hourScrollRef.current.querySelector(`[data-val="${timePicker.hour}"]`);
          if (hEl) hEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        if (minScrollRef.current) {
          const mEl = minScrollRef.current.querySelector(`[data-val="${timePicker.minute}"]`);
          if (mEl) mEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }, 50);
    }
  }, [timePicker?.isOpen]);

  const todayDeliveries = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getTime() - 3 * 3600000).toISOString().split('T')[0];
    return deliveries.filter(d => {
      const dTime = new Date((d as any).createdAt || d.updated_at).getTime();
      const brtDate = new Date(dTime - 3 * 3600000).toISOString().split('T')[0];
      return brtDate === today;
    });
  }, [deliveries]);

  const totalEntregas = todayDeliveries.length;
  const faturamentoTotal = todayDeliveries.reduce((acc, d) => acc + (d.value || 0), 0);
  const ticketMedio = totalEntregas > 0 ? faturamentoTotal / totalEntregas : 0;

  const revenueByMethod = useMemo(() => {
    return todayDeliveries.reduce((acc, d) => {
      const m = d.payment_method || 'dinheiro';
      acc[m] = (acc[m] || 0) + (d.value || 0);
      return acc;
    }, {} as Record<string, number>);
  }, [todayDeliveries]);

  const routesSummary = useMemo(() => {
    const summary = new Map();
    todayDeliveries.forEach(d => {
      if (!d.route_id) return;
      const route = routes.find(r => r.id === d.route_id);
      if (!route) return;
      if (!summary.has(route.id)) summary.set(route.id, { name: route.name, motoboy: route.motoboy_name, status: route.status, deliveries: [] });
      summary.get(route.id).deliveries.push(d);
    });
    return Array.from(summary.values());
  }, [todayDeliveries, routes]);

  const toggleStore = async () => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
    const newState = !isStoreOpen;
    setIsStoreOpen(newState);
    await updateStoreSettings({ isOpen: newState });
    toast.success(newState ? 'Operação Aberta! Bom trabalho!' : 'Operação Fechada! Bom descanso!', {
      style: { background: newState ? '#10b981' : '#ef4444', color: '#fff', border: 'none' }
    });
  };

  const handleSaveAllSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    
    await updateStoreSettings({
      ...storeSettings,
      isOpen: isStoreOpen,
      storeAddress: storeAddress.trim(),
      alertsEnabled,
      schedule,
      pauses,
      holidaysOverrides
    });
    toast.success('Expediente salvo com sucesso!');
  };

  const handleToggleMotoboyScale = async (motoboyId: string, currentActiveStatus: boolean) => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    await updateMotoboy(motoboyId, { active: !currentActiveStatus } as any);
    toast.success(!currentActiveStatus ? 'Motoboy escalado!' : 'Motoboy removido da escala.');
  };

  // Funções do Modal de Edição de Dia
  const openDayEditor = (dayIndex: number) => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
    setEditingDay(dayIndex);
    setTempDaySchedule(schedule[dayIndex] || { active: true, shifts: [{ start: '18:00', end: '23:00' }] });
  };

  const saveDayEditor = () => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium });
    if (editingDay !== null) {
      setSchedule(prev => ({ ...prev, [editingDay]: tempDaySchedule }));
      setEditingDay(null);
    }
  };

  const applyQuickAdjustment = (type: '24h' | 'almoco' | 'janta' | 'ambos') => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
    let newShifts: Shift[] = [];
    if (type === '24h') newShifts = [{ start: '00:00', end: '23:59' }];
    if (type === 'almoco') newShifts = [{ start: '11:00', end: '15:00' }];
    if (type === 'janta') newShifts = [{ start: '18:00', end: '23:00' }];
    if (type === 'ambos') newShifts = [{ start: '11:00', end: '15:00' }, { start: '18:00', end: '23:00' }];
    setTempDaySchedule(prev => ({ ...prev, active: true, shifts: newShifts }));
  };

  const confirmTimePicker = () => {
    if (!timePicker) return;
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium });
    if (editingDay !== null) {
      setTempDaySchedule(prev => {
        const newShifts = [...prev.shifts];
        const formattedTime = `${timePicker.hour}:${timePicker.minute}`;
        if (timePicker.field === 'start') {
          newShifts[timePicker.shiftIndex].start = formattedTime;
        } else {
          newShifts[timePicker.shiftIndex].end = formattedTime;
        }
        return { ...prev, shifts: newShifts };
      });
    }
    setTimePicker(null);
  };

  if (!isMounted || !hasHydrated) return null;

  return (
    <div className="flex flex-col gap-6 pb-32 animate-in fade-in duration-300 relative">
      <PageHeader title="Minha Loja" subtitle="Centro de comando da Da Família Lanches" to="/" />

      {/* BOTÃO PRINCIPAL OPERAÇÃO */}
      <button onClick={toggleStore} className={`relative overflow-hidden flex items-center justify-between p-5 rounded-[28px] border transition-all duration-500 cursor-pointer active:scale-[0.98] ${
          isStoreOpen ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800/80'
        }`}>
        <div className="flex items-center gap-4 relative z-10">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-500 ${isStoreOpen ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-zinc-800 text-zinc-500'}`}>
            <Power size={24} strokeWidth={2.5} />
          </div>
          <div className="text-left flex flex-col">
            <span className={`text-lg font-black tracking-wide uppercase transition-colors ${isStoreOpen ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {isStoreOpen ? 'Operação Aberta' : 'Operação Fechada'}
            </span>
            <span className="text-xs font-semibold text-zinc-500">
              {isStoreOpen ? 'Recebendo pedidos e rotas' : 'Sistema em modo de repouso'}
            </span>
          </div>
        </div>
      </button>

      {/* GESTÃO & CADASTROS */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2 flex items-center gap-2">
          <Users size={14} /> Gestão & Cadastros
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/motoboys')} className="bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/50 p-4 rounded-[24px] flex flex-col gap-2 text-left transition-all cursor-pointer active:scale-95 group">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform"><Bike size={18} /></div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Equipe</span>
            </div>
            <div>
              <p className="font-heading font-bold text-zinc-100 text-sm">Motoboys</p>
              <p className="text-[11px] text-zinc-500">Gerenciar e cadastrar</p>
            </div>
          </button>

          <button onClick={() => router.push('/clientes')} className="bg-zinc-900/60 border border-zinc-800 hover:border-sky-500/50 p-4 rounded-[24px] flex flex-col gap-2 text-left transition-all cursor-pointer active:scale-95 group">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform"><Users size={18} /></div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Base</span>
            </div>
            <div>
              <p className="font-heading font-bold text-zinc-100 text-sm">Clientes</p>
              <p className="text-[11px] text-zinc-500">Endereços e histórico</p>
            </div>
          </button>
        </div>
      </div>

      {/* DESEMPENHO DE HOJE */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2 flex items-center gap-2"><TrendingUp size={14} /> Desempenho de Hoje</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setIsLogisticsModalOpen(true); }} className="bg-zinc-900/60 border border-zinc-800 hover:border-sky-500/40 p-4 rounded-[24px] flex flex-col gap-1.5 text-left transition-all active:scale-95 cursor-pointer">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase"><Package size={14} className="text-sky-500" /> Resumo de Rotas</span>
            <span className="font-heading text-2xl font-black text-zinc-100">{totalEntregas}</span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">Ver logística completa <ChevronRight size={10}/></span>
          </button>
          
          <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setIsRevenueModalOpen(true); }} className="bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/40 p-4 rounded-[24px] flex flex-col gap-1.5 text-left transition-all active:scale-95 cursor-pointer">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase"><TrendingUp size={14} className="text-emerald-500" /> Faturamento</span>
            <span className="font-heading text-xl font-black text-emerald-400 truncate w-full">{isPrivacyMode ? 'R$ •••••' : `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`}</span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">Ver extrato financeiro <ChevronRight size={10}/></span>
          </button>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-[24px] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5"><Bike size={14} className="text-amber-500" /> Escala Rápida de Motoboys</span>
            <button onClick={() => router.push('/motoboys')} className="text-[11px] font-bold text-sky-400 hover:text-sky-300">Gerenciar ➔</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {motoboys.length > 0 ? (
              motoboys.map(m => (
                <button key={m.id} onClick={() => handleToggleMotoboyScale(m.id, m.active)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-90 ${m.active ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm' : 'bg-zinc-950 border border-zinc-800 text-zinc-600 opacity-60'}`}>
                  <span>{m.name}</span>
                  {m.active && <Check size={12} className="text-amber-400" />}
                </button>
              ))
            ) : (<span className="text-xs text-zinc-600 font-semibold">Nenhum motoboy cadastrado.</span>)}
          </div>
        </div>
      </div>

      {/* SISTEMA DE EXPEDIENTE PADRÃO IFOOD */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2 flex items-center gap-2"><Clock size={14} /> Expediente Automático</h2>
        
        <div className="flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-[28px] overflow-hidden pt-2">
          
          <div className="flex items-center justify-between border-b border-zinc-800 px-4">
            <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setActiveTab('horarios'); }} className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-wide text-center border-b-2 transition-colors ${activeTab === 'horarios' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500'}`}>Horários</button>
            <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setActiveTab('pausas'); }} className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-wide text-center border-b-2 transition-colors ${activeTab === 'pausas' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500'}`}>Pausas</button>
            <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setActiveTab('feriados'); }} className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-wide text-center border-b-2 transition-colors ${activeTab === 'feriados' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500'}`}>Feriados</button>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {activeTab === 'horarios' && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-zinc-400 mb-2 px-1">Defina os dias e turnos em que a loja abrirá automaticamente.</p>
                {DAYS_OF_WEEK.map((dayName, index) => {
                  const dayData = schedule[index] || { active: false, shifts: [] };
                  return (
                    <button key={index} onClick={() => openDayEditor(index)} className="flex items-center justify-between bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800/50 mb-2 rounded-xl p-4 transition-colors active:scale-[0.98]">
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-bold text-sm text-zinc-200">{dayName}</span>
                        {dayData.active && dayData.shifts.length > 0 ? (
                           <span className="text-[11px] text-zinc-500 font-medium">{dayData.shifts.map(s => `${s.start} às ${s.end}`).join(' e ')}</span>
                        ) : (
                           <span className="text-[11px] text-zinc-500 font-medium">Loja fechada</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${dayData.active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-800 border-zinc-700'}`}>
                          {dayData.active ? 'Aberta' : 'Fechada'}
                        </span>
                        <ChevronRight size={16} className="text-zinc-600" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === 'pausas' && (
              <div className="flex flex-col gap-3 items-center pt-2">
                <p className="text-xs text-zinc-400 mb-2 px-1 w-full text-left">Pausas suspendem as notificações e a loja não abre no período programado.</p>
                
                {pauses.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-2">
                    <AlertTriangle size={32} className="text-zinc-700" />
                    <span className="font-bold text-zinc-400">Você não tem nenhuma pausa</span>
                    <span className="text-xs text-zinc-600 text-center px-6">Crie pausas para recesso, férias ou reformas.</span>
                  </div>
                ) : (
                  pauses.map((p) => (
                    <div key={p.id} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                       <div className="flex flex-col gap-1">
                          <span className="font-bold text-sm text-zinc-200">{p.reason || 'Pausa Programada'}</span>
                          <span className="text-[11px] text-zinc-500">{p.start_date.split('T')[0]} até {p.end_date.split('T')[0]}</span>
                       </div>
                       <button onClick={() => setPauses(pauses.filter(x => x.id !== p.id))} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"><Trash2 size={16}/></button>
                    </div>
                  ))
                )}
                
                <button onClick={() => setIsPauseModalOpen(true)} className="w-full h-12 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-sm active:scale-95 flex items-center justify-center gap-2 mt-4 transition-colors">
                  <Plus size={16} /> Criar Pausa
                </button>
              </div>
            )}

            {activeTab === 'feriados' && (
              <div className="flex flex-col gap-1">
                <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-xl flex items-start gap-3 mb-4">
                   <Info size={18} className="text-sky-500 shrink-0 mt-0.5" />
                   <p className="text-[11px] text-sky-400/90 leading-relaxed">
                     Feriados nacionais costumam aumentar o volume de pedidos. Ajuste o horário de funcionamento ou prepare o estoque da loja com antecedência!
                   </p>
                </div>
                
                {apiHolidays.length === 0 ? (
                  <p className="text-center text-zinc-500 py-6 text-sm font-medium">Nenhum feriado próximo encontrado.</p>
                ) : (
                  apiHolidays.map((holiday, idx) => {
                    const override = holidaysOverrides[holiday.date];
                    return (
                      <button key={idx} onClick={() => toast.info('Em breve: Edição de Feriado', { description: holiday.name })} className="flex items-center justify-between bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800/50 mb-2 rounded-xl p-4 transition-colors active:scale-[0.98]">
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-bold text-sm text-zinc-200">{holiday.name}</span>
                          <span className="text-[11px] text-zinc-500 font-medium">
                             {holiday.date.split('-').reverse().join('/')} • {override ? 'Horário Especial Configurado' : 'Segue horário normal'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-amber-500 border border-amber-500/30 px-3 py-1 rounded-full uppercase">Editar</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* CONTROLES INFERIORES MAIS ESPAÇOSOS */}
        <div className="flex flex-col gap-6 mt-4 p-2">
           <div className="flex flex-col gap-2">
             <AddressAutocomplete value={storeAddress} onChange={setStoreAddress} placeholder="Rua, Número, Bairro, Cidade - MG" label="Endereço Base (Origem)" />
             <p className="text-[10px] text-zinc-500 px-1 font-medium">Será usado como ponto de partida para calcular as rotas no mapa.</p>
           </div>
           
           <div className="flex flex-col gap-3">
             <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div>
                  <div className="text-left">
                    <p className="font-bold text-zinc-100 text-sm">Alerta de Retorno</p>
                    <p className="text-[11px] text-zinc-500 font-medium">Avisa quando motoboy volta</p>
                  </div>
                </div>
                <button type="button" onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setRouteAlertsEnabled(!routeAlertsEnabled); }} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 cursor-pointer ${routeAlertsEnabled ? 'bg-amber-500' : 'bg-zinc-800 border border-zinc-700'}`}>
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${routeAlertsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
             </div>
             
             <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center shrink-0"><BellRing size={18} /></div>
                  <div className="text-left">
                    <p className="font-bold text-zinc-100 text-sm">Automação de Loja</p>
                    <p className="text-[11px] text-zinc-500 font-medium">Abre e fecha sozinho</p>
                  </div>
                </div>
                <button type="button" onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setAlertsEnabled(!alertsEnabled); }} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 cursor-pointer ${alertsEnabled ? 'bg-sky-500' : 'bg-zinc-800 border border-zinc-700'}`}>
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${alertsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
             </div>
           </div>

           <button onClick={handleSaveAllSettings} className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-sm transition-all shadow-xl active:scale-95 mt-4 uppercase tracking-widest flex items-center justify-center gap-2">
             <Check size={18} /> Salvar Tudo
           </button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* MODAL IFOOD: EDIÇÃO DE HORÁRIOS DO DIA */}
      {/* ======================================================================= */}
      {editingDay !== null && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-zinc-950 animate-in slide-in-from-bottom duration-300">
           <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-zinc-950 shrink-0">
             <button onClick={() => setEditingDay(null)} className="p-2 text-zinc-400 active:scale-90 bg-zinc-900 rounded-full"><ChevronLeft size={24}/></button>
             <span className="font-bold text-zinc-50">Editar horários</span>
             <div className="w-10"></div>
           </div>

           <div className="flex-1 overflow-y-auto pb-32">
             <div className="p-6 flex items-center justify-between">
               <span className="text-2xl font-bold text-zinc-100">{DAYS_OF_WEEK[editingDay]}</span>
               <button type="button" onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTempDaySchedule(prev => ({ ...prev, active: !prev.active })); }} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${tempDaySchedule.active ? 'bg-indigo-500' : 'bg-zinc-800 border border-zinc-700'}`}>
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${tempDaySchedule.active ? 'translate-x-7' : 'translate-x-1'}`} />
               </button>
             </div>

             {tempDaySchedule.active && (
               <div className="px-6 flex flex-col gap-4">
                 {tempDaySchedule.shifts.map((shift, sIdx) => (
                   <div key={sIdx} className="flex items-center gap-3">
                     
                     <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker({ isOpen: true, shiftIndex: sIdx, field: 'start', hour: shift.start.split(':')[0], minute: shift.start.split(':')[1] }); }} className="flex-1 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 flex items-center justify-between text-zinc-200 font-bold active:bg-zinc-800 transition-colors shadow-sm">
                       {shift.start}
                       <ChevronDown size={18} className="text-zinc-500" />
                     </button>

                     <span className="text-zinc-600 font-black">-</span>
                     
                     <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker({ isOpen: true, shiftIndex: sIdx, field: 'end', hour: shift.end.split(':')[0], minute: shift.end.split(':')[1] }); }} className="flex-1 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 flex items-center justify-between text-zinc-200 font-bold active:bg-zinc-800 transition-colors shadow-sm">
                       {shift.end}
                       <ChevronDown size={18} className="text-zinc-500" />
                     </button>

                     {tempDaySchedule.shifts.length > 1 && (
                       <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium }); setTempDaySchedule(p => ({...p, shifts: p.shifts.filter((_, idx) => idx !== sIdx)})); }} className="p-4 text-zinc-500 hover:text-red-500 bg-zinc-900 border border-zinc-800 rounded-2xl transition-colors"><Trash2 size={20}/></button>
                     )}
                   </div>
                 ))}

                 <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTempDaySchedule(p => ({...p, shifts: [...p.shifts, { start: '00:00', end: '00:00' }]})); }} className="self-end p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 active:scale-90 transition-all mt-2 shadow-sm">
                   <Plus size={20}/>
                 </button>

                 <div className="bg-zinc-900 p-5 rounded-2xl flex items-start gap-4 mt-2 border border-zinc-800">
                    <Info size={20} className="text-zinc-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1.5">
                      <span className="font-bold text-sm text-zinc-200">Evite atrasos e cancelamentos</span>
                      <span className="text-xs text-zinc-400 leading-relaxed">O horário final define até quando os pedidos podem ser feitos. Mantenha a loja aberta tempo suficiente após esse horário para concluir todos os pedidos.</span>
                    </div>
                 </div>
               </div>
             )}

             <div className="flex flex-col px-6 mt-10">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Ajustes Rápidos</span>
                <button onClick={() => applyQuickAdjustment('24h')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Aberto 24 horas | 00:00 às 23:59h</button>
                <button onClick={() => applyQuickAdjustment('almoco')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Almoço | 11:00 às 15:00h</button>
                <button onClick={() => applyQuickAdjustment('janta')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Janta | 18:00 às 23:00h</button>
                <button onClick={() => applyQuickAdjustment('ambos')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Almoço e janta | Dois turnos</button>
             </div>
           </div>

           <div className="fixed bottom-0 w-full p-4 bg-zinc-950 border-t border-zinc-800 pb-8 shrink-0">
             <button onClick={saveDayEditor} className="w-full h-14 bg-zinc-100 hover:bg-white text-zinc-950 font-black rounded-xl text-lg active:scale-95 transition-all shadow-xl">Confirmar</button>
           </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TIME PICKER CUSTOMIZADO (BOTTOM SHEET iFood) */}
      {/* ======================================================================= */}
      {timePicker && (
        <div className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/80 animate-in fade-in">
          <div className="bg-[#1a1a1a] rounded-t-[32px] p-6 pb-10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 relative">
             <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-zinc-700" />
             
             <div className="flex items-center justify-between mb-8">
               <h3 className="font-bold text-xl text-zinc-50">Horário de {timePicker.field === 'start' ? 'início' : 'término'}</h3>
               <button onClick={() => setTimePicker(null)} className="p-2.5 bg-zinc-800 rounded-full text-zinc-400 active:scale-90"><X size={20}/></button>
             </div>

             <div className="flex justify-center gap-4 h-56 relative mb-8">
               <div className="absolute top-1/2 left-4 right-4 h-14 -translate-y-1/2 bg-[#2d2d2d] rounded-2xl pointer-events-none z-0" />
               <div className="absolute top-0 w-full h-16 bg-gradient-to-b from-[#1a1a1a] to-transparent pointer-events-none z-10"/>
               <div className="absolute bottom-0 w-full h-16 bg-gradient-to-t from-[#1a1a1a] to-transparent pointer-events-none z-10"/>

               {/* Coluna Horas */}
               <div ref={hourScrollRef} className="flex-1 flex flex-col overflow-y-auto items-center z-20 pb-[96px] pt-[96px] hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {Array.from({length: 24}).map((_, i) => {
                    const h = String(i).padStart(2, '0');
                    const isSelected = timePicker.hour === h;
                    return (
                      <div key={h} data-val={h} onClick={() => { if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker(p => ({...p!, hour: h})); }} className="shrink-0 h-14 w-20 flex items-center justify-center cursor-pointer">
                        <span className={`text-2xl transition-all ${isSelected ? 'font-black text-zinc-50 scale-110' : 'font-semibold text-zinc-500'}`}>{h}</span>
                      </div>
                    )
                  })}
               </div>

               <div className="flex items-center justify-center text-3xl font-black text-zinc-600 z-20 pb-2">:</div>

               {/* Coluna Minutos */}
               <div ref={minScrollRef} className="flex-1 flex flex-col overflow-y-auto items-center z-20 pb-[96px] pt-[96px] hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {Array.from({length: 60}).map((_, i) => {
                    const m = String(i).padStart(2, '0');
                    const isSelected = timePicker.minute === m;
                    return (
                      <div key={m} data-val={m} onClick={() => { if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker(p => ({...p!, minute: m})); }} className="shrink-0 h-14 w-20 flex items-center justify-center cursor-pointer">
                        <span className={`text-2xl transition-all ${isSelected ? 'font-black text-zinc-50 scale-110' : 'font-semibold text-zinc-500'}`}>{m}</span>
                      </div>
                    )
                  })}
               </div>
             </div>

             <button onClick={confirmTimePicker} className="w-full h-14 bg-zinc-100 hover:bg-white text-zinc-950 font-black rounded-xl text-lg active:scale-95 transition-all shadow-lg">
               Confirmar
             </button>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO DE PAUSA */}
      {isPauseModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 px-4 animate-in fade-in">
           <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col gap-5 shadow-2xl">
             <div className="flex items-center justify-between">
               <h3 className="font-bold text-zinc-50 text-lg">Criar Nova Pausa</h3>
               <button onClick={() => setIsPauseModalOpen(false)} className="text-zinc-500 bg-zinc-800 p-2 rounded-full active:scale-90"><X size={18}/></button>
             </div>
             <div className="flex flex-col gap-4">
                <input type="text" placeholder="Motivo (Ex: Férias, Reforma...)" onChange={e => setTempPause({...tempPause, reason: e.target.value})} className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-sm text-zinc-200 outline-none focus:border-amber-500 transition-colors" />
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider px-1">Início</span>
                    <input type="date" onChange={e => setTempPause({...tempPause, start_date: e.target.value})} className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 focus:border-amber-500 outline-none transition-colors" />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider px-1">Fim</span>
                    <input type="date" onChange={e => setTempPause({...tempPause, end_date: e.target.value})} className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 focus:border-amber-500 outline-none transition-colors" />
                  </div>
                </div>
             </div>
             <button onClick={() => {
                if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium });
                setPauses(prev => [...prev, { ...tempPause, id: Date.now().toString() }]);
                setIsPauseModalOpen(false);
             }} className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl mt-2 active:scale-95 transition-all text-lg shadow-lg shadow-amber-500/20">
               Salvar Pausa
             </button>
           </div>
        </div>
      )}

      {/* MODAL 1: RESUMO DE LOGÍSTICA (Cego Financeiro) */}
      {isLogisticsModalOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-zinc-950/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-6 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2">
                <Package size={20} className="text-sky-500" /> Resumo Logístico
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Hoje: {totalEntregas} entregas finalizadas e em rota</p>
            </div>
            <button onClick={() => setIsLogisticsModalOpen(false)} className="p-2 bg-zinc-800 text-zinc-400 rounded-full active:scale-90"><X size={20}/></button>
          </div>

          {/* Adicionado pb-40 para o scroll final não cortar as últimas entregas */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-40">
            {routesSummary.length === 0 ? (
              <p className="text-center text-zinc-500 text-sm mt-10">Nenhuma rota montada hoje.</p>
            ) : (
              routesSummary.map((r, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg">
                  <div className="bg-zinc-800/40 p-4 flex items-center justify-between border-b border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0"><Bike size={18}/></div>
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-200 text-sm">{r.name}</span>
                        <span className="text-[11px] text-zinc-400 font-semibold">{r.motoboy}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${r.status === 'fechada' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-500'}`}>
                        {r.status}
                      </span>
                      <span className="text-xs font-bold text-zinc-500">{r.deliveries.length} Paradas</span>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-2 bg-zinc-900/50">
                    {r.deliveries.map((d: any, idx: number) => (
                      <button 
                        key={d.id} 
                        onClick={() => router.push(`/entrega/${d.id}`)}
                        className="flex items-center justify-between w-full bg-zinc-950 p-3 rounded-xl border border-zinc-800/50 active:scale-[0.98] transition-transform text-left"
                      >
                        <div className="flex items-start gap-3 overflow-hidden">
                          <span className="text-sky-500 font-bold text-sm mt-0.5 w-4 shrink-0">{idx + 1}.</span>
                          <div className="flex flex-col truncate">
                            <span className="text-xs font-bold text-zinc-200 truncate">{d.address_string.split('-')[0]}</span>
                            <span className="text-[10px] text-zinc-500 truncate mt-0.5"><MapPin size={10} className="inline mr-1"/>{d.address_string}</span>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-zinc-600 shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: EXTRATO FINANCEIRO (Detalhado) */}
      {isRevenueModalOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-zinc-950/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between p-6 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-zinc-50 flex items-center gap-2">
                <Wallet size={20} className="text-emerald-500" /> Extrato do Dia
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Faturamento total da operação hoje</p>
            </div>
            <button onClick={() => setIsRevenueModalOpen(false)} className="p-2 bg-zinc-800 text-zinc-400 rounded-full active:scale-90"><X size={20}/></button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 pb-40">
            <div className="flex flex-col items-center justify-center bg-emerald-500/10 border border-emerald-500/20 rounded-[24px] py-8 gap-2 shadow-sm">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Total Arrecadado</span>
              <span className="text-5xl font-black text-emerald-400 tracking-tight">
                {isPrivacyMode ? '•••••' : `R$ ${faturamentoTotal.toFixed(2).replace('.', ',')}`}
              </span>
              <span className="text-xs text-emerald-500/70 font-semibold mt-1 bg-emerald-500/10 px-3 py-1 rounded-full">
                Ticket Médio: R$ {isPrivacyMode ? '••' : ticketMedio.toFixed(2).replace('.', ',')}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1 items-center shadow-sm">
                <QrCode size={20} className="text-emerald-400 mb-2" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pix</span>
                <span className="text-sm font-bold text-zinc-200 mt-1">R$ {isPrivacyMode ? '••' : (revenueByMethod['pix'] || 0).toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1 items-center shadow-sm">
                <Banknote size={20} className="text-amber-500 mb-2" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Dinheiro</span>
                <span className="text-sm font-bold text-zinc-200 mt-1">R$ {isPrivacyMode ? '••' : (revenueByMethod['dinheiro'] || 0).toFixed(2)}</span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-1 items-center shadow-sm">
                <CreditCard size={20} className="text-sky-400 mb-2" />
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Cartão</span>
                <span className="text-sm font-bold text-zinc-200 mt-1">R$ {isPrivacyMode ? '••' : ((revenueByMethod['cartao'] || 0) + (revenueByMethod['cartao_credito'] || 0) + (revenueByMethod['cartao_debito'] || 0)).toFixed(2)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <span className="text-xs font-bold text-zinc-500 uppercase px-1 tracking-wider flex items-center gap-2">
                <Receipt size={14}/> Lançamentos Recentes
              </span>
              {todayDeliveries.length === 0 ? (
                 <p className="text-center text-sm text-zinc-600 mt-4 font-semibold">Nenhuma venda registrada hoje.</p>
              ) : (
                todayDeliveries.slice().reverse().map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-900 border border-zinc-800/80 p-4 rounded-2xl shadow-sm">
                    <div className="flex flex-col truncate pr-3">
                      <span className="text-sm font-bold text-zinc-200 truncate mb-0.5">{d.address_string.split('-')[0]}</span>
                      <span className="text-[11px] text-zinc-500 capitalize flex items-center gap-1">
                         {d.payment_method === 'pix' ? <QrCode size={10}/> : d.payment_method === 'dinheiro' ? <Banknote size={10}/> : <CreditCard size={10}/>}
                         {d.payment_method?.replace('_', ' ') || 'Dinheiro'}
                      </span>
                    </div>
                    <span className="text-base font-black text-emerald-400 shrink-0">
                      + R$ {isPrivacyMode ? '••' : (d.value || 0).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
