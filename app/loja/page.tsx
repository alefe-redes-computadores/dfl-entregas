'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Power, Users, BellRing, Bike, TrendingUp, Package, Wallet, PackagePlus, Boxes,
  AlertTriangle, Check, ChevronRight, X, Calendar, Clock, Trash2, Plus, Info, ChevronDown, ChevronLeft, Crosshair,
  ReceiptText, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PageHeader } from '@/components/layout/PageHeader';
import { AddressAutocomplete } from '@/components/deliveries/AddressAutocomplete';
import { useStoreDashboard } from '@/hooks/useStoreDashboard';
import { PerformanceModals } from '@/components/store/PerformanceModals';
import { OperationalCalendar } from '@/components/store/OperationalCalendar';
import { StoreTimePicker } from '@/components/store/StoreTimePicker';
import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';
import { validateSchedule } from '@/lib/operational-time';
import type { DaySchedule, StorePause, Shift, HolidayOverride } from '@/types';
import { requestDeviceLocation } from '@/lib/device-location';
import { extractLatLngFromMapsUrl, parseCoordinateString } from '@/lib/maps';

const DAYS_OF_WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const formatMoney = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LojaPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  const motoboys = useAppStore((state) => state.motoboys);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const togglePrivacyMode = useAppStore((state) => state.togglePrivacyMode);

  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const storeSettings = useAppStore((state) => state.storeSettings) || {};
  const updateStoreSettings = useAppStore((state) => state.updateStoreSettings);
  const routeAlertsEnabled = useAppStore((state) => state.routeAlertsEnabled);
  const setRouteAlertsEnabled = useAppStore((state) => state.setRouteAlertsEnabled);
  const settingsProtectionOff = storeSettings.routeReminderEnabled === false && storeSettings.autoCloseCompletedRoutes === false;

  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [storeAddress, setStoreAddress] = useState('Patos de Minas, MG');
  const [storePoint, setStorePoint] = useState<{lat:number;lng:number}|null>(null);
  const [storeLocationReference,setStoreLocationReference]=useState('');

  // Dashboard Hook
  const dashboardData = useStoreDashboard();
  const intelligence = useDeliveryIntelligence({
    lookbackDays: 30,
    minimumSample: 3,
    highlightLimit: 3,
  });
  const [isLogisticsModalOpen, setIsLogisticsModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Expediente Avançado
  const [activeTab, setActiveTab] = useState<'horarios' | 'pausas' | 'feriados'>('horarios');
  const [schedule, setSchedule] = useState<Record<number, DaySchedule>>({});
  const activeMotoboys = motoboys.filter((motoboy) => motoboy.active);
  const activeScheduleDays = DAYS_OF_WEEK.map((name, index) => ({ name, index, data: schedule[index] || { active: false, shifts: [] } })).filter((item) => item.data.active && item.data.shifts.length > 0);
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
      setStorePoint(Number.isFinite(storeSettings.storeLatitude)&&Number.isFinite(storeSettings.storeLongitude)?{lat:Number(storeSettings.storeLatitude),lng:Number(storeSettings.storeLongitude)}:null);
      setStoreLocationReference(storeSettings.storeMapsLink||'');
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
    await updateStoreSettings({ ...storeSettings, isOpen: isStoreOpen, storeAddress: storeAddress.trim(), storeLatitude:storePoint?.lat, storeLongitude:storePoint?.lng, storeMapsLink:storeLocationReference.trim()||undefined, alertsEnabled, schedule, pauses, holidaysOverrides });
    toast.success('Expediente salvo com sucesso!');
  };

  const captureStoreLocation=async()=>{try{setStorePoint(await requestDeviceLocation());toast.success('Localização da loja capturada. Salve as configurações.')}catch(error){toast.error('Não foi possível capturar a localização.',{description:error instanceof Error?error.message:'Confira a permissão do navegador.'})}};
  const applyStoreReference=()=>{const point=parseCoordinateString(storeLocationReference)||extractLatLngFromMapsUrl(storeLocationReference);if(!point)return toast.error('Cole coordenadas ou um link completo do Maps com latitude e longitude.');setStorePoint(point);toast.success('Origem da loja reconhecida. Salve as configurações.')};

  const openDayEditor = (dayIndex: number) => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light });
    setEditingDay(dayIndex);
    setTempDaySchedule(schedule[dayIndex] || { active: true, shifts: [{ start: '18:00', end: '23:00' }] });
  };

  const saveDayEditor = () => {
    if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Medium });
    const error = validateSchedule(tempDaySchedule);
    if (error) { toast.error('Confira os horários', { description: error }); return; }
    if (editingDay !== null) { setSchedule(prev => ({ ...prev, [editingDay]: { ...tempDaySchedule, shifts: tempDaySchedule.shifts.map(shift => ({...shift})) } })); setEditingDay(null); }
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
        const ns = prev.shifts.map(shift => ({ ...shift }));
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
      <PageHeader title="Minha Loja" subtitle="Central de operação da Da Família Lanches" to="/" />

      <section className={`rounded-[22px] border ${isStoreOpen ? 'border-emerald-500/25 bg-emerald-500/[.055]' : 'border-zinc-800 bg-zinc-900/55'}`}>
        <button
          onClick={toggleStore}
          className="flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[0.99]"
        >
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isStoreOpen ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-500'}`}>
            <Power size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={`truncate text-sm font-black ${isStoreOpen ? 'text-emerald-300' : 'text-zinc-200'}`}>
                {isStoreOpen ? 'Loja aberta' : 'Loja fechada'}
              </p>
              <span className={`h-2 w-2 shrink-0 rounded-full ${isStoreOpen ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
            </div>
            <p className="mt-0.5 truncate text-[10px] text-zinc-600">
              {isStoreOpen
                ? `${activeMotoboys.length} entregador${activeMotoboys.length === 1 ? '' : 'es'} ativo${activeMotoboys.length === 1 ? '' : 's'} agora`
                : 'Toque para iniciar a operação manualmente'}
            </p>
          </div>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-wide text-zinc-600">
            {isStoreOpen ? 'Encerrar' : 'Abrir'}
          </span>
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Agora</p>
            <h2 className="font-heading text-base font-black text-zinc-100">Central de operação</h2>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-zinc-500">
            {dashboardData.formattedDateLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => router.push(`/entregas?date=${encodeURIComponent(dashboardData.selectedDateKey)}`)} className="group relative overflow-hidden rounded-[22px] border border-amber-500/25 bg-gradient-to-br from-amber-500/[.09] to-zinc-900/40 p-3 text-left active:scale-[0.97]">
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><Package size={18} /></div>
              <ChevronRight size={16} className="text-zinc-700 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-2.5 font-heading text-sm font-black text-zinc-100">Entregas</p>
            <p className="mt-1 truncate text-[9px] leading-relaxed text-zinc-500">{dashboardData.totalEntregas} registradas no período</p>
          </button>

          <button onClick={() => router.push(`/rotas?date=${encodeURIComponent(dashboardData.selectedDateKey)}`)} className="group relative overflow-hidden rounded-[22px] border border-sky-500/25 bg-gradient-to-br from-sky-500/[.09] to-zinc-900/40 p-3 text-left active:scale-[0.97]">
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400"><Bike size={18} /></div>
              <ChevronRight size={16} className="text-zinc-700 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-2.5 font-heading text-sm font-black text-zinc-100">Rotas</p>
            <p className="mt-1 truncate text-[9px] leading-relaxed text-zinc-500">{dashboardData.selectedDateRoutes.length} rota{dashboardData.selectedDateRoutes.length === 1 ? '' : 's'} no período</p>
          </button>

          <button onClick={() => router.push('/equipe')} className="group rounded-[22px] border border-violet-500/15 bg-violet-500/[.035] p-3 text-left active:scale-[0.97]">
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400"><Users size={18} /></div>
              <ChevronRight size={16} className="text-zinc-700" />
            </div>
            <p className="mt-2.5 font-heading text-sm font-black text-zinc-100">Equipe</p>
            <p className="mt-1 truncate text-[9px] leading-relaxed text-zinc-500">Equipe interna e entregadores</p>
          </button>

          <button onClick={() => router.push('/clientes')} className="group rounded-[22px] border border-zinc-800 bg-zinc-900/55 p-3 text-left active:scale-[0.97]">
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400"><Users size={18} /></div>
              <ChevronRight size={16} className="text-zinc-700" />
            </div>
            <p className="mt-2.5 font-heading text-sm font-black text-zinc-100">Clientes</p>
            <p className="mt-1 truncate text-[9px] leading-relaxed text-zinc-500">Base, endereços e histórico</p>
          </button>

          <button onClick={() => router.push('/abastecimentos')} className="group rounded-[22px] border border-amber-500/20 bg-amber-500/[.045] p-3 text-left active:scale-[0.97]">
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><PackagePlus size={18} /></div>
              <ChevronRight size={16} className="text-zinc-700" />
            </div>
            <p className="mt-2.5 font-heading text-sm font-black text-zinc-100">Compras e reposições</p>
            <p className="mt-1 truncate text-[9px] leading-relaxed text-zinc-500">Compras, reposições, transporte e conferência</p>
          </button>
          <button onClick={() => router.push('/estoque')} className="group rounded-[22px] border border-emerald-500/20 bg-emerald-500/[.045] p-3 text-left active:scale-[0.97]">
            <div className="flex items-center justify-between"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><Boxes size={18}/></div><ChevronRight size={16} className="text-zinc-700"/></div>
            <p className="mt-2.5 font-heading text-sm font-black text-zinc-100">Estoque atual</p><p className="mt-1 truncate text-[9px] leading-relaxed text-zinc-500">Saldos, contagens, perdas e lista de compra</p>
          </button>

          <button onClick={() => router.push('/despesas')} className="group rounded-[22px] border border-amber-500/15 bg-amber-500/[.03] p-3 text-left active:scale-[0.97]">
            <div className="flex items-center justify-between"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><ReceiptText size={18}/></div><ChevronRight size={16} className="text-zinc-700"/></div>
            <p className="mt-2.5 font-heading text-sm font-black text-zinc-100">Despesas</p><p className="mt-1 truncate text-[9px] leading-relaxed text-zinc-500">Taxas, manutenção, fretes e diárias</p>
          </button>

          <button onClick={() => router.push('/confirmacoes')} className="group rounded-[22px] border border-red-500/15 bg-red-500/[.03] p-3 text-left active:scale-[0.97]">
            <div className="flex items-center justify-between"><div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-500/10 text-red-400"><ShieldCheck size={18}/></div><ChevronRight size={16} className="text-zinc-700"/></div>
            <p className="mt-2.5 font-heading text-sm font-black text-zinc-100">Confirmações iFood</p><p className="mt-1 truncate text-[9px] leading-relaxed text-zinc-500">Pendências externas e portal</p>
          </button>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Leitura do período</p>
            <h2 className="font-heading text-base font-black text-zinc-100">Resumo operacional</h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); dashboardData.goToPreviousDay(); }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500 active:scale-95"
              aria-label="Dia anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setIsCalendarOpen(true)}
              className="min-w-[82px] rounded-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-[10px] font-black text-zinc-300 active:scale-95"
            >
              {dashboardData.formattedDateLabel}
            </button>
            <button
              onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); dashboardData.goToNextDay(); }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500 active:scale-95"
              aria-label="Próximo dia"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-900/45">
          <button
            onClick={() => setIsLogisticsModalOpen(true)}
            className="flex w-full items-center justify-between gap-4 border-b border-zinc-800/80 p-4 text-left active:bg-zinc-900"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-sky-500">Operação</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-heading text-2xl font-black text-zinc-50">{dashboardData.totalEntregas}</span>
                <span className="text-[11px] font-bold text-zinc-500">entregas</span>
              </div>
              <p className="mt-1 text-[10px] text-zinc-600">
                {dashboardData.completedDeliveries} concluída{dashboardData.completedDeliveries === 1 ? '' : 's'} · {dashboardData.selectedDateRoutes.length} rota{dashboardData.selectedDateRoutes.length === 1 ? '' : 's'}
              </p>
            </div>
            <ChevronRight size={18} className="text-zinc-700" />
          </button>

          <button
            onClick={() => setIsRevenueModalOpen(true)}
            className="flex w-full items-center justify-between gap-4 p-4 text-left active:bg-zinc-900"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-500">Financeiro</p>
              <p className="mt-1 font-heading text-xl font-black text-emerald-400">
                {isPrivacyMode ? 'R$ •••••' : `R$ ${formatMoney(dashboardData.faturamentoTotal)}`}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Conferência do movimento registrado</p>
            </div>
            <ChevronRight size={18} className="text-zinc-700" />
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400">
              Inteligência operacional
            </p>
            <h2 className="mt-0.5 font-heading text-base font-black text-zinc-100">
              Leitura dos últimos 30 dias
            </h2>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[9px] font-black text-zinc-500">
            {intelligence.summary.total} sinal{intelligence.summary.total === 1 ? '' : 'is'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => router.push('/relatorios')}
          className="w-full rounded-[22px] border border-indigo-500/15 bg-indigo-500/[.035] p-4 text-left active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400">
              <TrendingUp size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-[9px] font-black">
                {intelligence.summary.warning > 0 && (
                  <span className="text-red-400">{intelligence.summary.warning} alerta{intelligence.summary.warning === 1 ? '' : 's'}</span>
                )}
                {intelligence.summary.attention > 0 && (
                  <span className="text-amber-400">{intelligence.summary.attention} atenção</span>
                )}
                {intelligence.summary.positive > 0 && (
                  <span className="text-emerald-400">{intelligence.summary.positive} positivo{intelligence.summary.positive === 1 ? '' : 's'}</span>
                )}
                {intelligence.summary.info > 0 && (
                  <span className="text-sky-400">{intelligence.summary.info} leitura{intelligence.summary.info === 1 ? '' : 's'}</span>
                )}
                {intelligence.summary.total === 0 && (
                  <span className="text-zinc-500">Ainda sem sinais suficientes</span>
                )}
              </div>
              <p className="mt-1.5 truncate text-xs font-black text-zinc-200">
                {intelligence.highlights[0]?.title || 'O cérebro ainda está formando uma base confiável'}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">
                Abra Relatórios para ver sinais, evidências e contexto completos.
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-zinc-700" />
          </div>
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Automação</p>
            <h2 className="font-heading text-base font-black text-zinc-100">Expediente</h2>
          </div>
          <button
            onClick={() => { setActiveTab('horarios'); setIsScheduleEditorOpen((value) => !value); }}
            className="text-[10px] font-black text-indigo-400"
          >
            {isScheduleEditorOpen ? 'Fechar editor' : 'Editar semana'}
          </button>
        </div>

        {!isScheduleEditorOpen && (
          <div className="rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-zinc-200">{activeScheduleDays.length} dia{activeScheduleDays.length === 1 ? '' : 's'} programado{activeScheduleDays.length === 1 ? '' : 's'}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
                  Horários aparecem resumidos aqui. Abra o editor somente quando precisar alterar.
                </p>
              </div>
              <Clock size={18} className="shrink-0 text-indigo-400" />
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {DAYS_OF_WEEK.map((dayName, index) => {
                const dayData = schedule[index] || { active: false, shifts: [] };
                const active = dayData.active && dayData.shifts.length > 0;
                const shortNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

                return (
                  <button
                    key={dayName}
                    onClick={() => openDayEditor(index)}
                    className={`rounded-xl border px-1 py-2 text-center active:scale-95 ${active ? 'border-emerald-500/20 bg-emerald-500/[.07]' : 'border-zinc-800 bg-zinc-950/50'}`}
                  >
                    <span className={`block text-[8px] font-black uppercase ${active ? 'text-emerald-400' : 'text-zinc-600'}`}>{shortNames[index]}</span>
                    <span className="mt-1 block truncate text-[8px] font-bold text-zinc-500">{active ? dayData.shifts[0].start : '—'}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2 text-[9px] font-bold text-zinc-600">
              <span>{pauses.length} pausa{pauses.length === 1 ? '' : 's'}</span>
              <span>•</span>
              <span>{Object.keys(holidaysOverrides).length} feriado especial</span>
            </div>
          </div>
        )}

        {isScheduleEditorOpen && (
          <div className="flex flex-col overflow-hidden rounded-[28px] border border-zinc-800 bg-zinc-900/45">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4">
              <button onClick={() => setActiveTab('horarios')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-wide text-center border-b-2 ${activeTab === 'horarios' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-zinc-500'}`}>Horários</button>
              <button onClick={() => setActiveTab('pausas')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-wide text-center border-b-2 ${activeTab === 'pausas' ? 'border-amber-500 text-amber-400' : 'border-transparent text-zinc-500'}`}>Pausas</button>
              <button onClick={() => setActiveTab('feriados')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-wide text-center border-b-2 ${activeTab === 'feriados' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-500'}`}>Feriados</button>
            </div>

            <div className="flex flex-col gap-4 p-4">
              {activeTab === 'horarios' && (
                <div className="flex flex-col gap-2">
                  {DAYS_OF_WEEK.map((dayName, index) => {
                    const dayData = schedule[index] || { active: false, shifts: [] };
                    return (
                      <button key={index} onClick={() => openDayEditor(index)} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4 text-left active:scale-[0.99]">
                        <div>
                          <p className="text-sm font-black text-zinc-200">{dayName}</p>
                          <p className="mt-1 text-[10px] font-medium text-zinc-600">
                            {dayData.active && dayData.shifts.length > 0 ? dayData.shifts.map((shift) => `${shift.start} às ${shift.end}`).join(' · ') : 'Fechada'}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-zinc-700" />
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === 'pausas' && (
                <div className="flex flex-col gap-3">
                  {pauses.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 py-8 text-center">
                      <p className="text-xs font-bold text-zinc-500">Nenhuma pausa programada</p>
                    </div>
                  ) : (
                    pauses.map((pause) => (
                      <div key={pause.id} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4">
                        <div>
                          <p className="text-xs font-black text-zinc-300">{pause.reason || 'Pausa programada'}</p>
                          <p className="mt-1 text-[10px] text-zinc-600">{pause.start_date.split('T')[0]} até {pause.end_date.split('T')[0]}</p>
                        </div>
                        <button onClick={() => setPauses(pauses.filter((item) => item.id !== pause.id))} className="rounded-full p-2 text-red-500 active:bg-red-500/10"><Trash2 size={16} /></button>
                      </div>
                    ))
                  )}
                  <button onClick={() => setIsPauseModalOpen(true)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-zinc-800 text-xs font-black text-zinc-200 active:scale-95"><Plus size={15} /> Criar pausa</button>
                </div>
              )}

              {activeTab === 'feriados' && (
                <div className="flex flex-col gap-2">
                  <div className="rounded-2xl border border-sky-500/15 bg-sky-500/[.06] p-3 text-[10px] leading-relaxed text-sky-400">
                    Feriados podem alterar a operação. Os próximos feriados nacionais aparecem abaixo.
                  </div>
                  {apiHolidays.length === 0 ? (
                    <p className="py-6 text-center text-xs font-bold text-zinc-600">Nenhum feriado próximo encontrado.</p>
                  ) : (
                    apiHolidays.map((holiday, idx) => {
                      const override = holidaysOverrides[holiday.date];
                      return (
                        <button key={idx} onClick={() => toast.info('Em breve: Edição de Feriado', { description: holiday.name })} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/45 p-4 text-left active:scale-[0.99]">
                          <div>
                            <p className="text-xs font-black text-zinc-300">{holiday.name}</p>
                            <p className="mt-1 text-[10px] text-zinc-600">{holiday.date.split('-').reverse().join('/')} · {override ? 'Horário especial' : 'Horário normal'}</p>
                          </div>
                          <ChevronRight size={16} className="text-zinc-700" />
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <button
          onClick={() => setIsSettingsOpen((value) => !value)}
          className="flex items-center justify-between rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4 text-left active:scale-[0.99]"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Configurações</p>
            <p className="mt-1 text-sm font-black text-zinc-200">Origem, alertas e automação</p>
          </div>
          <ChevronDown size={18} className={`text-zinc-600 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`} />
        </button>

        {isSettingsOpen && (
          <div className="flex flex-col gap-4 rounded-[28px] border border-zinc-800 bg-zinc-900/45 p-4">
            <div className="flex flex-col gap-2">
              <AddressAutocomplete value={storeAddress} onChange={setStoreAddress} placeholder="Rua, Número, Bairro, Cidade - MG" label="Endereço Base (Origem)" />
              <p className="px-1 text-[10px] font-medium text-zinc-600">Usado como ponto de partida das rotas.</p>
              <button type="button" onClick={captureStoreLocation} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[.07] text-xs font-black text-sky-400"><Crosshair size={15}/>{storePoint?'Localização precisa salva':'Usar localização atual da loja'}</button>
              <div className="grid grid-cols-[1fr_auto] gap-2"><input value={storeLocationReference} onChange={e=>setStoreLocationReference(e.target.value)} placeholder="Coordenadas ou link completo do Maps" className="h-11 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none focus:border-sky-500"/><button type="button" onClick={applyStoreReference} className="rounded-xl border border-zinc-700 px-3 text-[10px] font-black text-zinc-300">Usar</button></div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500"><AlertTriangle size={18} /></div>
                <div>
                  <p className="text-sm font-black text-zinc-200">Alerta de retorno</p>
                  <p className="text-[10px] text-zinc-600">Avisa quando o motoboy volta</p>
                </div>
              </div>
              <button type="button" onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setRouteAlertsEnabled(!routeAlertsEnabled); }} className={`relative inline-flex h-8 w-14 items-center rounded-full ${routeAlertsEnabled ? 'bg-amber-500' : 'border border-zinc-700 bg-zinc-800'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${routeAlertsEnabled ? 'translate-x-7' : 'translate-x-1'}`} /></button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-400"><BellRing size={18} /></div>
                <div>
                  <p className="text-sm font-black text-zinc-200">Automação da loja</p>
                  <p className="text-[10px] text-zinc-600">Abre e fecha pelos horários</p>
                </div>
              </div>
              <button type="button" onClick={() => { if (Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setAlertsEnabled(!alertsEnabled); }} className={`relative inline-flex h-8 w-14 items-center rounded-full ${alertsEnabled ? 'bg-sky-500' : 'border border-zinc-700 bg-zinc-800'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${alertsEnabled ? 'translate-x-7' : 'translate-x-1'}`} /></button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 text-violet-400"><BellRing size={18}/></div><div><p className="text-sm font-black text-zinc-200">Proteção de rotas</p><p className="text-[10px] text-zinc-600">Lembra às 23:30 e fecha concluídas esquecidas</p></div></div>
              <button type="button" onClick={()=>updateStoreSettings({routeReminderEnabled:settingsProtectionOff,autoCloseCompletedRoutes:settingsProtectionOff})} className={`relative inline-flex h-8 w-14 items-center rounded-full ${!settingsProtectionOff?'bg-violet-500':'border border-zinc-700 bg-zinc-800'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${!settingsProtectionOff?'translate-x-7':'translate-x-1'}`}/></button>
            </div>

            <button onClick={handleSaveAllSettings} className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-4 text-xs font-black uppercase tracking-widest text-white active:scale-95"><Check size={16} /> Salvar configurações</button>
          </div>
        )}
      </section>

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

      {timePicker && <StoreTimePicker field={timePicker.field} hour={timePicker.hour} minute={timePicker.minute} onClose={() => setTimePicker(null)} onConfirm={confirmTimePicker} onChange={(value) => setTimePicker(current => current ? {...current,...value} : null)} />}
      {false && timePicker && (
        <div className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/80 animate-in fade-in">
          <div className="bg-[#1a1a1a] rounded-t-[32px] p-6 pb-10 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 relative">
             <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-zinc-700" />
             <div className="flex items-center justify-between mb-8"><h3 className="font-bold text-xl text-zinc-50">Horário de {timePicker?.field === 'start' ? 'início' : 'término'}</h3><button onClick={() => setTimePicker(null)} className="p-2.5 bg-zinc-800 rounded-full text-zinc-400 active:scale-90"><X size={20}/></button></div>
             <div className="flex justify-center gap-4 h-56 relative mb-8">
               <div className="absolute top-1/2 left-4 right-4 h-14 -translate-y-1/2 bg-[#2d2d2d] rounded-2xl pointer-events-none z-0" />
               <div className="absolute top-0 w-full h-16 bg-gradient-to-b from-[#1a1a1a] to-transparent pointer-events-none z-10"/>
               <div className="absolute bottom-0 w-full h-16 bg-gradient-to-t from-[#1a1a1a] to-transparent pointer-events-none z-10"/>
               <div ref={hourScrollRef} className="flex-1 flex flex-col overflow-y-auto items-center z-20 pb-[96px] pt-[96px] hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {Array.from({length: 24}).map((_, i) => {
                    const h = String(i).padStart(2, '0');
                    return (<div key={h} data-val={h} onClick={() => { if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker(p => ({...p!, hour: h})); }} className="shrink-0 h-14 w-20 flex items-center justify-center cursor-pointer"><span className={`text-2xl transition-all ${timePicker?.hour === h ? 'font-black text-zinc-50 scale-110' : 'font-semibold text-zinc-500'}`}>{h}</span></div>)
                  })}
               </div>
               <div className="flex items-center justify-center text-3xl font-black text-zinc-600 z-20 pb-2">:</div>
               <div ref={minScrollRef} className="flex-1 flex flex-col overflow-y-auto items-center z-20 pb-[96px] pt-[96px] hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {Array.from({length: 60}).map((_, i) => {
                    const m = String(i).padStart(2, '0');
                    return (<div key={m} data-val={m} onClick={() => { if(Capacitor.isNativePlatform()) Haptics.impact({ style: ImpactStyle.Light }); setTimePicker(p => ({...p!, minute: m})); }} className="shrink-0 h-14 w-20 flex items-center justify-center cursor-pointer"><span className={`text-2xl transition-all ${timePicker?.minute === m ? 'font-black text-zinc-50 scale-110' : 'font-semibold text-zinc-500'}`}>{m}</span></div>)
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

      <PerformanceModals
        isLogisticsOpen={isLogisticsModalOpen} closeLogistics={() => setIsLogisticsModalOpen(false)}
        isRevenueOpen={isRevenueModalOpen} closeRevenue={() => setIsRevenueModalOpen(false)}
        isPrivacyMode={isPrivacyMode}
        togglePrivacyMode={togglePrivacyMode}
        dashboardData={dashboardData}
      />
      {isCalendarOpen && <OperationalCalendar selected={dashboardData.selectedDateKey} markedDates={dashboardData.datesWithOperation} onClose={() => setIsCalendarOpen(false)} onSelect={(key) => { dashboardData.setSelectedDateKey(key); setIsCalendarOpen(false); }} />}
    </div>
  );
}
