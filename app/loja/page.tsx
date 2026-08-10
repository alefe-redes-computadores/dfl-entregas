'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Power, Users, BellRing, Bike, TrendingUp, Package, Wallet,
  AlertTriangle, Check, ChevronRight, X, Calendar, Clock, Trash2, Plus, Info, ChevronDown, ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete';
import { useStoreDashboard } from '@/hooks/useStoreDashboard';
import { PerformanceModals } from '@/components/store/PerformanceModals';
import type { DaySchedule, StorePause, Shift, HolidayOverride } from '@/types';

const DAYS_OF_WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default function LojaPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  const motoboys = useAppStore((state) => state.motoboys);
  const updateMotoboy = useAppStore((state) => state.updateMotoboy);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const togglePrivacyMode = useAppStore((state) => state.togglePrivacyMode); // ADDED

  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const storeSettings = useAppStore((state) => state.storeSettings) || {};
  const updateStoreSettings = useAppStore((state) => state.updateStoreSettings);
  const routeAlertsEnabled = useAppStore((state) => state.routeAlertsEnabled);
  const setRouteAlertsEnabled = useAppStore((state) => state.setRouteAlertsEnabled);

  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [storeAddress, setStoreAddress] = useState('Patos de Minas, MG');

  // Dashboard Hook
  const dashboardData = useStoreDashboard();
  const [isLogisticsModalOpen, setIsLogisticsModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);

  // Expediente Avançado
  const [activeTab, setActiveTab] = useState<'horarios' | 'pausas' | 'feriados'>('horarios');
  const [schedule, setSchedule] = useState<Record<number, DaySchedule>>({});
  const [pauses, setPauses] = useState<StorePause[]>([]);
  const [holidaysOverrides, setHolidaysOverrides] = useState<Record<string, HolidayOverride>>({});
  const [apiHolidays, setApiHolidays] = useState<any[]>([]);

  // Editores
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [tempDaySchedule, setTempDaySchedule] = useState<DaySchedule>({ active: false, shifts: [] });
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [tempPause, setTempPause] = useState<StorePause>({ id: '', start_date: '', end_date: '', reason: '' });

  const hourScrollRef = useRef<HTMLDivElement>(null);
  const minScrollRef = useRef<HTMLDivElement>(null);
  const [timePicker, setTimePicker] = useState<{ isOpen: boolean; shiftIndex: number; field: 'start' | 'end'; hour: string; minute: string; } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    if (hasHydrated && storeSettings) {
      setIsStoreOpen(storeSettings.isOpen ?? false);
      setAlertsEnabled(storeSettings.alertsEnabled ?? false);
      setStoreAddress(storeSettings.storeAddress || 'Patos de Minas, MG');
      setSchedule(storeSettings.schedule || {});
      setPauses(storeSettings.pauses || []);
      setHolidaysOverrides(storeSettings.holidaysOverrides || {});
      
      fetch(`https://brasilapi.com.br/api/feriados/v1/${new Date().getFullYear()}`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setApiHolidays(data.filter((h: any) => new Date(h.date).getTime() >= new Date().getTime() - 86400000)); })
        .catch(() => {});
    }
  }, [storeSettings, hasHydrated]);

  useEffect(() => {
    if (timePicker?.isOpen) {
      setTimeout(() => {
        if (hourScrollRef.current) { const hEl = hourScrollRef.current.querySelector(`[data-val="${timePicker.hour}"]`); if (hEl) hEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        if (minScrollRef.current) { const mEl = minScrollRef.current.querySelector(`[data-val="${timePicker.minute}"]`); if (mEl) mEl.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      }, 50);
    }
  }, [timePicker?.isOpen]);

  const toggleStore = async () => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
    const newState = !isStoreOpen;
    setIsStoreOpen(newState);
    await updateStoreSettings({ isOpen: newState });
    toast.success(newState ? 'Operação Aberta!' : 'Operação Fechada!');
  };

  const handleSaveAllSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    await updateStoreSettings({ ...storeSettings, isOpen: isStoreOpen, storeAddress: storeAddress.trim(), alertsEnabled, schedule, pauses, holidaysOverrides });
    toast.success('Expediente salvo com sucesso!');
  };

  const handleToggleMotoboyScale = async (id: string, active: boolean) => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    await updateMotoboy(id, { active: !active } as any);
  };

  const openDayEditor = (dayIndex: number) => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
    setEditingDay(dayIndex);
    setTempDaySchedule(schedule[dayIndex] || { active: true, shifts: [{ start: '18:00', end: '23:00' }] });
  };

  const saveDayEditor = () => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium });
    if (editingDay !== null) { setSchedule(prev => ({ ...prev, [editingDay]: tempDaySchedule })); setEditingDay(null); }
  };

  const applyQuickAdjustment = (type: '24h' | 'almoco' | 'janta' | 'ambos') => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
    let s: Shift[] = [];
    if (type === '24h') s = [{ start: '00:00', end: '23:59' }];
    if (type === 'almoco') s = [{ start: '11:00', end: '15:00' }];
    if (type === 'janta') s = [{ start: '18:00', end: '23:00' }];
    if (type === 'ambos') s = [{ start: '11:00', end: '15:00' }, { start: '18:00', end: '23:00' }];
    setTempDaySchedule(p => ({ ...p, active: true, shifts: s }));
  };

  const confirmTimePicker = () => {
    if (!timePicker) return;
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium });
    if (editingDay !== null) {
      setTempDaySchedule(prev => {
        const ns = [...prev.shifts];
        const t = `${timePicker.hour}:${timePicker.minute}`;
        if (timePicker.field === 'start') ns[timePicker.shiftIndex].start = t; else ns[timePicker.shiftIndex].end = t;
        return { ...prev, shifts: ns };
      });
    }
    setTimePicker(null);
  };

  if (!isMounted || !hasHydrated) return null;

  return (
    <div className="flex flex-col gap-6 pb-32 animate-in fade-in duration-300 relative">
      <PageHeader title="Minha Loja" subtitle="Centro de comando da Da Família Lanches" to="/" />

      <button onClick={toggleStore} className={`relative overflow-hidden flex items-center justify-between p-5 rounded-[28px] border transition-all duration-500 cursor-pointer active:scale-[0.98] ${isStoreOpen ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800/80'}`}>
        <div className="flex items-center gap-4 relative z-10">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-500 ${isStoreOpen ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 'bg-zinc-800 text-zinc-500'}`}><Power size={24} strokeWidth={2.5} /></div>
          <div className="text-left flex flex-col"><span className={`text-lg font-black tracking-wide uppercase transition-colors ${isStoreOpen ? 'text-emerald-400' : 'text-zinc-400'}`}>{isStoreOpen ? 'Operação Aberta' : 'Operação Fechada'}</span><span className="text-xs font-semibold text-zinc-500">{isStoreOpen ? 'Recebendo pedidos e rotas' : 'Sistema em modo de repouso'}</span></div>
        </div>
      </button>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2 flex items-center gap-2"><Users size={14} /> Gestão & Cadastros</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push('/motoboys')} className="bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/50 p-4 rounded-[24px] flex flex-col gap-2 text-left transition-all cursor-pointer active:scale-95 group">
            <div className="flex items-center justify-between"><div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform"><Bike size={18} /></div><span className="text-[10px] font-bold text-zinc-500 uppercase">Equipe</span></div>
            <div><p className="font-heading font-bold text-zinc-100 text-sm">Motoboys</p><p className="text-[11px] text-zinc-500">Gerenciar e cadastrar</p></div>
          </button>
          <button onClick={() => router.push('/clientes')} className="bg-zinc-900/60 border border-zinc-800 hover:border-sky-500/50 p-4 rounded-[24px] flex flex-col gap-2 text-left transition-all cursor-pointer active:scale-95 group">
            <div className="flex items-center justify-between"><div className="h-10 w-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform"><Users size={18} /></div><span className="text-[10px] font-bold text-zinc-500 uppercase">Base</span></div>
            <div><p className="font-heading font-bold text-zinc-100 text-sm">Clientes</p><p className="text-[11px] text-zinc-500">Endereços e histórico</p></div>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2"><TrendingUp size={14} /> Desempenho</h2>
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">{dashboardData.formattedDateLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setIsLogisticsModalOpen(true)} className="bg-zinc-900/60 border border-zinc-800 hover:border-sky-500/40 p-4 rounded-[24px] flex flex-col gap-1.5 text-left transition-all active:scale-95 cursor-pointer">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase"><Package size={14} className="text-sky-500" /> Resumo de Rotas</span>
            <span className="font-heading text-2xl font-black text-zinc-100">{dashboardData.totalEntregas}</span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">Ver logística completa <ChevronRight size={10}/></span>
          </button>
          <button onClick={() => setIsRevenueModalOpen(true)} className="bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/40 p-4 rounded-[24px] flex flex-col gap-1.5 text-left transition-all active:scale-95 cursor-pointer">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase"><TrendingUp size={14} className="text-emerald-500" /> Faturamento</span>
            <span className="font-heading text-xl font-black text-emerald-400 truncate w-full">{isPrivacyMode ? 'R$ •••••' : `R$ ${dashboardData.faturamentoTotal.toFixed(2).replace('.', ',')}`}</span>
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">Ver extrato financeiro <ChevronRight size={10}/></span>
          </button>
        </div>
        <div className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-[24px] flex flex-col gap-3">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5"><Bike size={14} className="text-amber-500" /> Escala Rápida de Motoboys</span><button onClick={() => router.push('/motoboys')} className="text-[11px] font-bold text-sky-400 hover:text-sky-300">Gerenciar ➔</button></div>
          <div className="flex flex-wrap items-center gap-2">
            {motoboys.length > 0 ? motoboys.map(m => (<button key={m.id} onClick={() => handleToggleMotoboyScale(m.id, m.active)} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-90 ${m.active ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-sm' : 'bg-zinc-950 border border-zinc-800 text-zinc-600 opacity-60'}`}><span>{m.name}</span>{m.active && <Check size={12} className="text-amber-400" />}</button>)) : (<span className="text-xs text-zinc-600 font-semibold">Nenhum motoboy cadastrado.</span>)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-2 flex items-center gap-2"><Clock size={14} /> Expediente Automático</h2>
        <div className="flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-[28px] overflow-hidden pt-2">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4">
            <button onClick={() => setActiveTab('horarios')} className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-wide text-center border-b-2 transition-colors ${activeTab === 'horarios' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500'}`}>Horários</button>
            <button onClick={() => setActiveTab('pausas')} className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-wide text-center border-b-2 transition-colors ${activeTab === 'pausas' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500'}`}>Pausas</button>
            <button onClick={() => setActiveTab('feriados')} className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-wide text-center border-b-2 transition-colors ${activeTab === 'feriados' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500'}`}>Feriados</button>
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
                        {dayData.active && dayData.shifts.length > 0 ? <span className="text-[11px] text-zinc-500 font-medium">{dayData.shifts.map(s => `${s.start} às ${s.end}`).join(' e ')}</span> : <span className="text-[11px] text-zinc-500 font-medium">Loja fechada</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${dayData.active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-zinc-500 bg-zinc-800 border-zinc-700'}`}>{dayData.active ? 'Aberta' : 'Fechada'}</span>
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
                  <div className="py-10 flex flex-col items-center gap-2"><AlertTriangle size={32} className="text-zinc-700" /><span className="font-bold text-zinc-400">Você não tem nenhuma pausa</span><span className="text-xs text-zinc-600 text-center px-6">Crie pausas para recesso ou férias.</span></div>
                ) : (
                  pauses.map((p) => (
                    <div key={p.id} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                       <div className="flex flex-col gap-1"><span className="font-bold text-sm text-zinc-200">{p.reason || 'Pausa Programada'}</span><span className="text-[11px] text-zinc-500">{p.start_date.split('T')[0]} até {p.end_date.split('T')[0]}</span></div>
                       <button onClick={() => setPauses(pauses.filter(x => x.id !== p.id))} className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"><Trash2 size={16}/></button>
                    </div>
                  ))
                )}
                <button onClick={() => setIsPauseModalOpen(true)} className="w-full h-12 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl text-sm active:scale-95 flex items-center justify-center gap-2 mt-4 transition-colors"><Plus size={16} /> Criar Pausa</button>
              </div>
            )}
            {activeTab === 'feriados' && (
              <div className="flex flex-col gap-1">
                <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-xl flex items-start gap-3 mb-4"><Info size={18} className="text-sky-500 shrink-0 mt-0.5" /><p className="text-[11px] text-sky-400/90 leading-relaxed">Feriados nacionais costumam aumentar o volume de pedidos. Prepare o estoque!</p></div>
                {apiHolidays.length === 0 ? (
                  <p className="text-center text-zinc-500 py-6 text-sm font-medium">Nenhum feriado próximo encontrado.</p>
                ) : (
                  apiHolidays.map((holiday, idx) => {
                    const override = holidaysOverrides[holiday.date];
                    return (
                      <button key={idx} onClick={() => toast.info('Em breve: Edição de Feriado', { description: holiday.name })} className="flex items-center justify-between bg-zinc-950/50 hover:bg-zinc-800 border border-zinc-800/50 mb-2 rounded-xl p-4 transition-colors active:scale-[0.98]">
                        <div className="flex flex-col items-start gap-1"><span className="font-bold text-sm text-zinc-200">{holiday.name}</span><span className="text-[11px] text-zinc-500 font-medium">{holiday.date.split('-').reverse().join('/')} • {override ? 'Horário Especial' : 'Segue horário normal'}</span></div>
                        <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-amber-500 border border-amber-500/30 px-3 py-1 rounded-full uppercase">Editar</span></div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 mt-4 p-2">
           <div className="flex flex-col gap-2"><AddressAutocomplete value={storeAddress} onChange={setStoreAddress} placeholder="Rua, Número, Bairro, Cidade - MG" label="Endereço Base (Origem)" /><p className="text-[10px] text-zinc-500 px-1 font-medium">Usado como ponto de partida para rotas no mapa.</p></div>
           <div className="flex flex-col gap-3">
             <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center shrink-0"><AlertTriangle size={18} /></div><div className="text-left"><p className="font-bold text-zinc-100 text-sm">Alerta de Retorno</p><p className="text-[11px] text-zinc-500 font-medium">Avisa quando motoboy volta</p></div></div>
                <button type="button" onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setRouteAlertsEnabled(!routeAlertsEnabled); }} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 cursor-pointer ${routeAlertsEnabled ? 'bg-amber-500' : 'bg-zinc-800 border border-zinc-700'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${routeAlertsEnabled ? 'translate-x-7' : 'translate-x-1'}`} /></button>
             </div>
             <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="h-10 w-10 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center shrink-0"><BellRing size={18} /></div><div className="text-left"><p className="font-bold text-zinc-100 text-sm">Automação de Loja</p><p className="text-[11px] text-zinc-500 font-medium">Abre e fecha sozinho</p></div></div>
                <button type="button" onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setAlertsEnabled(!alertsEnabled); }} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 cursor-pointer ${alertsEnabled ? 'bg-sky-500' : 'bg-zinc-800 border border-zinc-700'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${alertsEnabled ? 'translate-x-7' : 'translate-x-1'}`} /></button>
             </div>
           </div>
           <button onClick={handleSaveAllSettings} className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-sm transition-all shadow-xl active:scale-95 mt-4 uppercase tracking-widest flex items-center justify-center gap-2"><Check size={18} /> Salvar Tudo</button>
        </div>
      </div>

      {editingDay !== null && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-zinc-950 animate-in slide-in-from-bottom duration-300">
           <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-zinc-950 shrink-0"><button onClick={() => setEditingDay(null)} className="p-2 text-zinc-400 active:scale-90 bg-zinc-900 rounded-full"><ChevronLeft size={24}/></button><span className="font-bold text-zinc-50">Editar horários</span><div className="w-10"></div></div>
           <div className="flex-1 overflow-y-auto pb-32">
             <div className="p-6 flex items-center justify-between"><span className="text-2xl font-bold text-zinc-100">{DAYS_OF_WEEK[editingDay]}</span><button type="button" onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTempDaySchedule(prev => ({ ...prev, active: !prev.active })); }} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${tempDaySchedule.active ? 'bg-indigo-500' : 'bg-zinc-800 border border-zinc-700'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${tempDaySchedule.active ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>
             {tempDaySchedule.active && (
               <div className="px-6 flex flex-col gap-4">
                 {tempDaySchedule.shifts.map((shift, sIdx) => (
                   <div key={sIdx} className="flex items-center gap-3">
                     <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker({ isOpen: true, shiftIndex: sIdx, field: 'start', hour: shift.start.split(':')[0], minute: shift.start.split(':')[1] }); }} className="flex-1 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 flex items-center justify-between text-zinc-200 font-bold active:bg-zinc-800 transition-colors shadow-sm">{shift.start}<ChevronDown size={18} className="text-zinc-500" /></button>
                     <span className="text-zinc-600 font-black">-</span>
                     <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker({ isOpen: true, shiftIndex: sIdx, field: 'end', hour: shift.end.split(':')[0], minute: shift.end.split(':')[1] }); }} className="flex-1 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 flex items-center justify-between text-zinc-200 font-bold active:bg-zinc-800 transition-colors shadow-sm">{shift.end}<ChevronDown size={18} className="text-zinc-500" /></button>
                     {tempDaySchedule.shifts.length > 1 && <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium }); setTempDaySchedule(p => ({...p, shifts: p.shifts.filter((_, idx) => idx !== sIdx)})); }} className="p-4 text-zinc-500 hover:text-red-500 bg-zinc-900 border border-zinc-800 rounded-2xl transition-colors"><Trash2 size={20}/></button>}
                   </div>
                 ))}
                 <button onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTempDaySchedule(p => ({...p, shifts: [...p.shifts, { start: '00:00', end: '00:00' }]})); }} className="self-end p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 active:scale-90 transition-all mt-2 shadow-sm"><Plus size={20}/></button>
               </div>
             )}
             <div className="flex flex-col px-6 mt-10">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Ajustes Rápidos</span>
                <button onClick={() => applyQuickAdjustment('24h')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Aberto 24 horas | 00:00 às 23:59h</button>
                <button onClick={() => applyQuickAdjustment('almoco')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Almoço | 11:00 às 15:00h</button>
                <button onClick={() => applyQuickAdjustment('janta')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Janta | 18:00 às 23:00h</button>
             </div>
           </div>
           <div className="fixed bottom-0 w-full p-4 bg-zinc-950 border-t border-zinc-800 pb-8 shrink-0"><button onClick={saveDayEditor} className="w-full h-14 bg-zinc-100 hover:bg-white text-zinc-950 font-black rounded-xl text-lg active:scale-95 transition-all shadow-xl">Confirmar</button></div>
        </div>
      )}

      {timePicker && (
        <div className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/80 animate-in fade-in">
          <div className="bg-[#1a1a1a] rounded-t-[32px] p-6 pb-10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 relative">
             <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-zinc-700" />
             <div className="flex items-center justify-between mb-8"><h3 className="font-bold text-xl text-zinc-50">Horário de {timePicker.field === 'start' ? 'início' : 'término'}</h3><button onClick={() => setTimePicker(null)} className="p-2.5 bg-zinc-800 rounded-full text-zinc-400 active:scale-90"><X size={20}/></button></div>
             <div className="flex justify-center gap-4 h-56 relative mb-8">
               <div className="absolute top-1/2 left-4 right-4 h-14 -translate-y-1/2 bg-[#2d2d2d] rounded-2xl pointer-events-none z-0" />
               <div className="absolute top-0 w-full h-16 bg-gradient-to-b from-[#1a1a1a] to-transparent pointer-events-none z-10"/>
               <div className="absolute bottom-0 w-full h-16 bg-gradient-to-t from-[#1a1a1a] to-transparent pointer-events-none z-10"/>
               <div ref={hourScrollRef} className="flex-1 flex flex-col overflow-y-auto items-center z-20 pb-[96px] pt-[96px] hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {Array.from({length: 24}).map((_, i) => {
                    const h = String(i).padStart(2, '0');
                    return (<div key={h} data-val={h} onClick={() => { if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker(p => ({...p!, hour: h})); }} className="shrink-0 h-14 w-20 flex items-center justify-center cursor-pointer"><span className={`text-2xl transition-all ${timePicker.hour === h ? 'font-black text-zinc-50 scale-110' : 'font-semibold text-zinc-500'}`}>{h}</span></div>)
                  })}
               </div>
               <div className="flex items-center justify-center text-3xl font-black text-zinc-600 z-20 pb-2">:</div>
               <div ref={minScrollRef} className="flex-1 flex flex-col overflow-y-auto items-center z-20 pb-[96px] pt-[96px] hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {Array.from({length: 60}).map((_, i) => {
                    const m = String(i).padStart(2, '0');
                    return (<div key={m} data-val={m} onClick={() => { if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker(p => ({...p!, minute: m})); }} className="shrink-0 h-14 w-20 flex items-center justify-center cursor-pointer"><span className={`text-2xl transition-all ${timePicker.minute === m ? 'font-black text-zinc-50 scale-110' : 'font-semibold text-zinc-500'}`}>{m}</span></div>)
                  })}
               </div>
             </div>
             <button onClick={confirmTimePicker} className="w-full h-14 bg-zinc-100 hover:bg-white text-zinc-950 font-black rounded-xl text-lg active:scale-95 transition-all shadow-lg">Confirmar</button>
          </div>
        </div>
      )}

      {isPauseModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 px-4 animate-in fade-in">
           <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col gap-5 shadow-2xl">
             <div className="flex items-center justify-between"><h3 className="font-bold text-zinc-50 text-lg">Criar Nova Pausa</h3><button onClick={() => setIsPauseModalOpen(false)} className="text-zinc-500 bg-zinc-800 p-2 rounded-full active:scale-90"><X size={18}/></button></div>
             <div className="flex flex-col gap-4">
                <input type="text" placeholder="Motivo (Ex: Férias, Reforma...)" onChange={e => setTempPause({...tempPause, reason: e.target.value})} className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-sm text-zinc-200 outline-none focus:border-amber-500 transition-colors" />
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1.5 flex-1"><span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider px-1">Início</span><input type="date" onChange={e => setTempPause({...tempPause, start_date: e.target.value})} className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 focus:border-amber-500 outline-none transition-colors" /></div>
                  <div className="flex flex-col gap-1.5 flex-1"><span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider px-1">Fim</span><input type="date" onChange={e => setTempPause({...tempPause, end_date: e.target.value})} className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-zinc-200 focus:border-amber-500 outline-none transition-colors" /></div>
                </div>
             </div>
             <button onClick={() => { if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium }); setPauses(prev => [...prev, { ...tempPause, id: Date.now().toString() }]); setIsPauseModalOpen(false); }} className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl mt-2 active:scale-95 transition-all text-lg shadow-lg shadow-amber-500/20">Salvar Pausa</button>
           </div>
        </div>
      )}

      {/* Renderiza os Modais de Desempenho Isolados */}
      <PerformanceModals 
        isLogisticsOpen={isLogisticsModalOpen} closeLogistics={() => setIsLogisticsModalOpen(false)}
        isRevenueOpen={isRevenueModalOpen} closeRevenue={() => setIsRevenueModalOpen(false)}
        isPrivacyMode={isPrivacyMode} 
        togglePrivacyMode={togglePrivacyMode}
        dashboardData={dashboardData}
      />
    </div>
  );
}
