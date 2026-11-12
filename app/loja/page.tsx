'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Power, Users, UsersRound, UserRound, Store, BellRing, Bike, TrendingUp, Package, Wallet, PackagePlus, Boxes,
  AlertTriangle, Check, ChevronRight, X, Calendar, Clock, Trash2, Plus, Info, ChevronDown, ChevronLeft, Crosshair,
  ReceiptText, ShieldCheck, Inbox, History, SlidersHorizontal
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
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
import { isWithinSchedule, validateSchedule } from '@/lib/operational-time';
import type { DaySchedule, StorePause, Shift, HolidayOverride } from '@/types';
import { requestDeviceLocation, LocationFailure, type LocationFailureCode } from '@/lib/device-location';
import { LocationPermissionGuide } from '@/components/location/LocationPermissionGuide';
import { storedOriginPoint, hasSpecificStoreAddress } from '@/lib/store-origin';
import { extractLatLngFromMapsUrl, parseCoordinateString } from '@/lib/maps';
import { SiteAdminHub } from '@/components/store/SiteAdminHub';
import { OperationalAttentionQueue } from '@/components/store/OperationalAttentionQueue';
import { loadHolidayCalendar } from '@/lib/store/holidayCache';
import { configuredMarketplaceMode, mergeMarketplacePreference } from '@/lib/operation/marketplace-modes';
import { ShiftBriefing } from '@/components/home/ShiftBriefing';

const DAYS_OF_WEEK = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

// Feedback tatil e estritamente nao bloqueante: falha do Android nunca impede persistencia.
const touchFeedback = (style: ImpactStyle): void => {
  if (!Capacitor.isNativePlatform()) return;
  try { void Haptics.impact({ style }).catch(() => undefined); } catch { /* plugin indisponivel */ }
};

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
  const routeOrderingMode = storeSettings.routeOrderingMode === 'smart' ? 'smart' : 'manual';
  const routeReminderActive = storeSettings.routeReminderEnabled !== false;
  const sitePrepLead = ([15,30,60] as const).find(v => v === storeSettings.sitePreparationLeadMinutes) || 30;
  const autoCloseActive = storeSettings.autoCloseCompletedRoutes !== false;
  // R197: preferências remotas têm gravação única e feedback somente após persistência.
  const quickPreferenceInFlight = useRef(false);
  const [quickPreferenceBusy, setQuickPreferenceBusy] = useState(false);
  const saveQuickPreference = async (patch: Parameters<typeof updateStoreSettings>[0]) => {
    if (quickPreferenceInFlight.current || storeSettingsBusy || storeToggleBusy) return;
    quickPreferenceInFlight.current = true;
    setQuickPreferenceBusy(true);
    try {
      await updateStoreSettings(patch);
      toast.success('Preferência operacional salva.');
      touchFeedback(ImpactStyle.Light);
    } catch {
      toast.error('Não foi possível salvar a preferência.', { description: 'A configuração anterior foi preservada.' });
    } finally {
      quickPreferenceInFlight.current = false;
      setQuickPreferenceBusy(false);
    }
  };

  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const toggleInFlight = useRef(false);
  const settingsInFlight = useRef(false);
  const [storeToggleBusy, setStoreToggleBusy] = useState(false);
  const [storeSettingsBusy, setStoreSettingsBusy] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [storeAddress, setStoreAddress] = useState('Patos de Minas, MG');
  const [storePoint, setStorePoint] = useState<{lat:number;lng:number}|null>(null);
  const [storeLocationReference,setStoreLocationReference]=useState('');

  // Dashboard Hook
  const dashboardData = useStoreDashboard();

  const intelligence = useDeliveryIntelligence({
    lookbackDays: 30,
    minimumSample: 5,
    highlightLimit: 2,
  });
  const [isLogisticsModalOpen, setIsLogisticsModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isScheduleEditorOpen, setIsScheduleEditorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showOpeningReview, setShowOpeningReview] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  useEffect(() => {
    try { setShowManagement(window.sessionStorage.getItem('dfl:loja:gestao') === 'open'); }
    catch { /* Private browsing must not block Loja. */ }
  }, []);
  // R54: links profundos vindos das Preferências abrem o editor canônico.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#dfl-loja-configuracoes') setIsSettingsOpen(true);
    if (hash === '#dfl-loja-expediente') setIsScheduleEditorOpen(true);
  }, []);
  const toggleManagement = () => setShowManagement(current => {
    const next = !current;
    try { window.sessionStorage.setItem('dfl:loja:gestao', next ? 'open' : 'closed'); }
    catch { /* Layout preference is optional. */ }
    return next;
  });

  // Expediente Avançado
  const [activeTab, setActiveTab] = useState<'horarios' | 'pausas' | 'feriados'>('horarios');
  const [schedule, setSchedule] = useState<Record<number, DaySchedule>>({});
  const activeMotoboys = useMemo(() => motoboys.filter((motoboy) => motoboy.active), [motoboys]);
  const activeScheduleDays = useMemo(() => DAYS_OF_WEEK.map((name, index) => ({ name, index, data: schedule[index] || { active: false, shifts: [] } })).filter((item) => item.data.active && item.data.shifts.length > 0), [schedule]);
  const [pauses, setPauses] = useState<StorePause[]>([]);
  const [holidaysOverrides, setHolidaysOverrides] = useState<Record<string, HolidayOverride>>({});
  const [apiHolidays, setApiHolidays] = useState<any[]>([]);

  // Editores
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [tempDaySchedule, setTempDaySchedule] = useState<DaySchedule>({ active: false, shifts: [] });
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [tempPause, setTempPause] = useState<StorePause>({ id: '', start_date: '', end_date: '', reason: '' });

  const [timePicker, setTimePicker] = useState<{ isOpen: boolean; shiftIndex: number; field: 'start' | 'end'; hour: string; minute: string; } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    setIsStoreOpen(storeSettings.isOpen ?? false);
    setAlertsEnabled(storeSettings.alertsEnabled ?? false);
    setStoreAddress(
      storeSettings.storeAddress ||
        'Patos de Minas, MG',
    );

    setStorePoint(
      Number.isFinite(storeSettings.storeLatitude) &&
        Number.isFinite(storeSettings.storeLongitude)
        ? {
            lat: Number(storeSettings.storeLatitude),
            lng: Number(storeSettings.storeLongitude),
          }
        : null,
    );

    setStoreLocationReference(
      storeSettings.storeMapsLink || '',
    );

    setSchedule(storeSettings.schedule || {});
    setPauses(storeSettings.pauses || []);
    setHolidaysOverrides(
      storeSettings.holidaysOverrides || {},
    );
  }, [hasHydrated, storeSettings]);

  useEffect(() => {
    if (!hasHydrated) return;
    let mounted = true;
    void loadHolidayCalendar(new Date().getFullYear())
      .then((holidays) => {
        if (!mounted) return;
        const yesterday = Date.now() - 86_400_000;
        setApiHolidays(holidays.filter(holiday => new Date(holiday.date).getTime() >= yesterday));
      })
      .catch(() => { /* Feriados externos são opcionais e não bloqueiam a Loja. */ });
    return () => { mounted = false; };
  }, [hasHydrated]);

  const toggleStore = async () => {
    if (toggleInFlight.current || settingsInFlight.current) return;
    toggleInFlight.current = true;
    setStoreToggleBusy(true);
    touchFeedback(ImpactStyle.Heavy);

    const previousState = isStoreOpen;
    const newState = !previousState;

    setIsStoreOpen(newState);

    try {
      await updateStoreSettings({
        isOpen: newState,
      });

      toast.success(
        newState
          ? 'Operação aberta!'
          : 'Operação fechada!',
      );
    } catch (error) {
      setIsStoreOpen(previousState);

      toast.error(
        'Não foi possível alterar a operação.',
        {
          description:
            'A alteração local foi desfeita.',
        },
      );
    } finally {
      toggleInFlight.current = false;
      setStoreToggleBusy(false);
    }
  };

  const handleSaveAllSettings = async (
    e?: React.FormEvent,
  ) => {
    if (e) e.preventDefault();
    if (settingsInFlight.current || toggleInFlight.current) return;
    settingsInFlight.current = true;
    setStoreSettingsBusy(true);
    touchFeedback(ImpactStyle.Medium);

    try {
      await updateStoreSettings({
        isOpen: isStoreOpen,
        storeAddress: storeAddress.trim(),
        storeLatitude: storePoint?.lat,
        storeLongitude: storePoint?.lng,
        storeMapsLink:
          storeLocationReference.trim() ||
          undefined,
        alertsEnabled,
        schedule,
        pauses,
        holidaysOverrides,
      });

      toast.success(
        'Configurações da operação salvas.',
      );
    } catch (error) {
      toast.error(
        'Não foi possível salvar as configurações.',
        {
          description:
            'Confira sua conexão e tente novamente.',
        },
      );
    } finally {
      settingsInFlight.current = false;
      setStoreSettingsBusy(false);
    }
  };

  const [capturingStoreLocation, setCapturingStoreLocation] = useState(false);
  const [locationFailure, setLocationFailure] = useState<LocationFailureCode | null>(null);
  const captureStoreLocation = async () => {
    if (capturingStoreLocation) return;
    setCapturingStoreLocation(true);
    setLocationFailure(null);
    try {
      const point = await requestDeviceLocation();
      await updateStoreSettings({ storeLatitude: point.lat, storeLongitude: point.lng });
      setStorePoint(point);
      toast.success('Origem das rotas salva com a localização atual.');
      if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light);
    } catch (error) {
      setLocationFailure(error instanceof LocationFailure ? error.code : 'unknown');
      toast.error('Não foi possível salvar a localização.', { description: error instanceof Error ? error.message : 'Confira as permissões do dispositivo.' });
    } finally {
      setCapturingStoreLocation(false);
    }
  };
  const applyStoreReference=()=>{const point=parseCoordinateString(storeLocationReference)||extractLatLngFromMapsUrl(storeLocationReference);if(!point)return toast.error('Cole coordenadas ou um link completo do Maps com latitude e longitude.');setStorePoint(point);toast.success('Origem da loja reconhecida. Salve as configurações.')};

  const openDayEditor = (dayIndex: number) => {
    if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light);
    setEditingDay(dayIndex);
    setTempDaySchedule(schedule[dayIndex] || { active: true, shifts: [{ start: '18:00', end: '23:00' }] });
  };

  const [savingSchedule, setSavingSchedule] = useState(false);
  const saveDayEditor = async () => {
    if (savingSchedule || editingDay === null) return;
    const error = validateSchedule(tempDaySchedule);
    if (error) { toast.error('Confira os horários', { description: error }); return; }
    const nextSchedule = {
      ...schedule,
      [editingDay]: { ...tempDaySchedule, shifts: tempDaySchedule.shifts.map(shift => ({ ...shift })) },
    };
    setSavingSchedule(true);
    try {
      await updateStoreSettings({ schedule: nextSchedule });
      setSchedule(nextSchedule);
      setEditingDay(null);
      toast.success('Horário salvo na operação.');
      if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Medium);
    } catch {
      toast.error('Não foi possível salvar o horário.', { description: 'O editor foi mantido aberto para tentar novamente.' });
    } finally {
      setSavingSchedule(false);
    }
  };

  const applyQuickAdjustment = (type: '24h' | 'almoco' | 'janta' | 'ambos') => {
    if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light);
    let s: Shift[] = [];
    if (type === '24h') s = [{ start: '00:00', end: '23:59' }];
    if (type === 'almoco') s = [{ start: '11:00', end: '15:00' }];
    if (type === 'janta') s = [{ start: '18:00', end: '23:00' }];
    if (type === 'ambos') s = [{ start: '11:00', end: '15:00' }, { start: '18:00', end: '23:00' }];
    setTempDaySchedule(p => ({ ...p, active: true, shifts: s }));
  };

  const confirmTimePicker = () => {
    if (!timePicker) return;
    if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Medium);
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

  const scheduledOpenNow = isWithinSchedule(
    new Date(),
    schedule,
    pauses,
    holidaysOverrides,
  );

  if (!isMounted || !hasHydrated) return null;

  return (
    <div className="dfl-page dfl-loja-v7 flex flex-col gap-4 pb-32 animate-in fade-in duration-300 relative">
      <PageHeader title="Minha Loja" subtitle="Pedidos, atendimento e operação" to="/" />

      <SiteAdminHub
        selectedDateOrders={dashboardData.selectedDateOrders}
        selectedDateLabel={dashboardData.formattedDateLabel}
      />

      <section id="dfl-loja-abertura" className={`overflow-hidden rounded-[24px] border shadow-[0_18px_45px_rgba(0,0,0,.14)] ${isStoreOpen ? 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[.09] via-zinc-900/55 to-zinc-950/60' : 'border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950/60'}`}>
        <button
          onClick={toggleStore} disabled={storeToggleBusy || storeSettingsBusy} aria-busy={storeToggleBusy}
          className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left active:scale-[0.99]"
        >
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${isStoreOpen ? 'bg-emerald-400 text-zinc-950 shadow-[0_0_24px_rgba(52,211,153,.16)]' : 'bg-zinc-800/90 text-zinc-500'}`}>
            <Power size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className={`truncate text-[15px] font-black ${isStoreOpen ? 'text-emerald-300' : 'text-zinc-100'}`}>
                {isStoreOpen ? (scheduledOpenNow ? 'Aberta no expediente' : 'Aberta manualmente') : 'Fechada agora'}
              </p>
              <span className={`h-2 w-2 shrink-0 rounded-full ${isStoreOpen ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
            </div>
            <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-zinc-500">
              {isStoreOpen
                ? scheduledOpenNow
                  ? `Expediente programado · ${activeMotoboys.length} entregador${activeMotoboys.length === 1 ? '' : 'es'} ativo${activeMotoboys.length === 1 ? '' : 's'}`
                  : 'Fora do expediente programado · fechamento automático continua protegido'
                : scheduledOpenNow
                  ? 'Expediente programado ativo · a automação deve abrir a operação'
                  : 'Fora do expediente · toque em Abrir agora somente se precisar operar'}
            </p>
          </div>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-wide text-zinc-600">
            {isStoreOpen ? 'Encerrar' : 'Abrir agora'}
          </span>
        </button>
        {/* R55: expediente ao lado da abertura manual; usa editor existente. */}
        <div className="flex items-center gap-2 border-t border-zinc-800/60 px-3.5 py-2.5">
          <Clock size={16} className="shrink-0 text-emerald-300" />
          <span className="min-w-0 flex-1 text-[11px] font-semibold text-zinc-300">
            {activeScheduleDays.length} dia{activeScheduleDays.length === 1 ? '' : 's'} programado{activeScheduleDays.length === 1 ? '' : 's'}
          </span>
          <button type="button" onClick={() => { setActiveTab('horarios'); setIsScheduleEditorOpen(true); document.getElementById('dfl-loja-expediente')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
            className="min-h-10 shrink-0 rounded-xl border border-emerald-500/25 bg-emerald-500/[.07] px-3 text-[11px] font-black text-emerald-300 active:bg-emerald-500/15">
            Editar expediente
          </button>
        </div>
      </section>

      <section aria-label="Conferência opcional de abertura" className="rounded-2xl border border-zinc-800/80 bg-zinc-900/25 p-2">
        <button type="button" aria-expanded={showOpeningReview} aria-controls="dfl-loja-opening-review"
          onClick={() => setShowOpeningReview(open => !open)}
          className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-[11px] font-black text-zinc-300 active:bg-zinc-800/40">
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="min-w-0 flex-1">Conferência de abertura</span>
          <span className="text-[10px] font-medium text-zinc-500">Opcional</span>
          <ChevronDown size={15} className={`transition-transform ${showOpeningReview ? 'rotate-180' : ''}`} />
        </button>
        {showOpeningReview && <div id="dfl-loja-opening-review" className="mt-2 border-t border-zinc-800/60 pt-3"><ShiftBriefing /></div>}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400/80">Agora</p>
            <h2 className="mt-0.5 font-heading text-[17px] font-black text-zinc-50">Operação do dia</h2>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-bold text-zinc-500">
            {dashboardData.formattedDateLabel}
          </span>
        </div>

        <OperationalAttentionQueue orders={dashboardData.selectedDateOrders} selectedDateKey={dashboardData.selectedDateKey} onFinance={()=>setIsRevenueModalOpen(true)}/>

        {/* R54: Loja e autoridade administrativa. Site e operação primeiro; financeiro sempre visível. */}
        <section aria-label="Centro de acessos da Loja" className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div><p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-400">Seu ponto de comando</p><h3 className="mt-1 font-heading text-[15px] font-black text-zinc-100">Acessos da Loja</h3></div>
            <span className="text-[10px] font-medium text-zinc-500">Operação e gestão</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => router.push('/loja/caixa-de-entrada?aba=site')}
              className="col-span-2 flex min-h-[72px] items-center gap-3 rounded-[19px] border border-amber-400/25 bg-gradient-to-r from-amber-400/[.10] to-zinc-900/55 px-3.5 py-3 text-left active:scale-[.99]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-amber-400/10 text-amber-300"><Inbox size={20}/></span>
              <span className="min-w-0 flex-1"><strong className="block text-[13px] font-black text-amber-100">Pedidos do Site</strong><small className="mt-1 block text-[10px] leading-snug text-zinc-400">Recebimento, pronto para rota e histórico</small></span>
              <ChevronRight size={17} className="text-amber-300" />
            </button>
            <button type="button" onClick={() => router.push('/loja/caixa-de-entrada')}
              className="flex min-h-[70px] items-center gap-2.5 rounded-[18px] border border-zinc-800 bg-zinc-900/40 px-3 text-left active:bg-zinc-800/50">
              <Inbox size={19} className="shrink-0 text-violet-300"/><span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-zinc-100">Caixa de Entrada</strong><small className="mt-1 block text-[10px] leading-snug text-zinc-500">iFood, texto e balcão</small></span><ChevronRight size={14} className="shrink-0 text-zinc-600"/>
            </button>
            <button type="button" onClick={() => router.push(`/entregas?date=${encodeURIComponent(dashboardData.selectedDateKey)}`)} aria-label={`Abrir entregas: ${dashboardData.totalEntregas} no período`}
              className="flex min-h-[70px] items-center gap-2.5 rounded-[18px] border border-zinc-800 bg-zinc-900/40 px-3 text-left active:bg-zinc-800/50">
              <Package size={19} className="shrink-0 text-amber-300"/><span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-zinc-100">Entregas <span className="text-amber-300">{dashboardData.totalEntregas}</span></strong><small className="mt-1 block text-[10px] leading-snug text-zinc-500">{dashboardData.pendingDeliveries} pendente(s)</small></span><ChevronRight size={14} className="shrink-0 text-zinc-600"/>
            </button>
            <button type="button" onClick={() => router.push(`/rotas?date=${encodeURIComponent(dashboardData.selectedDateKey)}`)} aria-label={`Abrir rotas: ${dashboardData.selectedDateRoutes.length} no período · Acompanhar sequência e motoboys`}
              className="col-span-2 flex min-h-[65px] items-center gap-3 rounded-[18px] border border-sky-500/20 bg-sky-500/[.045] px-3.5 text-left active:bg-sky-500/[.07]">
              <Bike size={19} className="shrink-0 text-sky-300"/><span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-zinc-100">Rotas</strong><small className="mt-0.5 block text-[10px] leading-snug text-zinc-400">Sequência, saídas e motoboys · {dashboardData.selectedDateRoutes.length} no período</small></span><ChevronRight size={15} className="text-sky-300" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1"><span className="text-[10px] font-black uppercase tracking-[.13em] text-zinc-400">Estoque e financeiro</span><span className="h-px flex-1 bg-zinc-800/70"/></div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => router.push('/abastecimentos')} className="flex min-h-[69px] items-center gap-2.5 rounded-[17px] border border-amber-500/20 bg-amber-500/[.05] px-3 text-left active:bg-amber-500/10"><PackagePlus size={19} className="shrink-0 text-amber-300"/><span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-zinc-100">Compras</strong><small className="mt-0.5 block text-[10px] text-zinc-400">Fornecedores e custos</small></span><ChevronRight size={14} className="shrink-0 text-zinc-600"/></button>
              <button type="button" onClick={() => router.push('/estoque')} className="flex min-h-[69px] items-center gap-2.5 rounded-[17px] border border-emerald-500/20 bg-emerald-500/[.05] px-3 text-left active:bg-emerald-500/10"><Boxes size={19} className="shrink-0 text-emerald-300"/><span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-zinc-100">Estoque</strong><small className="mt-0.5 block text-[10px] text-zinc-400">Saldos e contagens</small></span><ChevronRight size={14} className="shrink-0 text-zinc-600"/></button>
              <button type="button" onClick={() => router.push('/despesas')} className="col-span-2 flex min-h-[60px] items-center gap-2.5 rounded-[17px] border border-zinc-800 bg-zinc-900/45 px-3 text-left active:bg-zinc-800/50"><ReceiptText size={19} className="shrink-0 text-amber-300"/><span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-zinc-100">Despesas operacionais</strong><small className="mt-0.5 block text-[10px] text-zinc-400">Taxas, fretes, manutenção e diárias</small></span><ChevronRight size={14} className="shrink-0 text-zinc-600"/></button>
            </div>
          </div>

          <div className="space-y-2">
            <button type="button" aria-expanded={showManagement} onClick={toggleManagement} className="flex min-h-[54px] w-full items-center justify-between rounded-[17px] border border-zinc-800 bg-zinc-900/30 px-3.5 text-left active:bg-zinc-800/40">
              <span className="flex items-center gap-2.5"><Users size={18} className="text-violet-300"/><span><strong className="block text-[12px] font-black text-zinc-100">Pessoas e equipe</strong><small className="mt-0.5 block text-[10px] text-zinc-400">Clientes, colaboradores e motoboys</small></span></span>
              <ChevronDown size={16} className={`shrink-0 text-zinc-500 transition-transform ${showManagement ? 'rotate-180' : ''}`}/>
            </button>
            {showManagement && (<>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => router.push('/clientes')} className="flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[15px] border border-zinc-800 bg-zinc-900/45 px-1.5 py-2.5 text-center transition-colors active:bg-zinc-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label="Abrir Clientes">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-sky-500/10 text-sky-300"><UserRound size={18} strokeWidth={2}/></span>
                  <span className="block text-[11px] font-black leading-tight text-zinc-100">Clientes</span>
                  <span className="block text-[9px] leading-tight text-zinc-400">Cadastros</span>
                </button>
                <button type="button" onClick={() => router.push('/equipe')} className="flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[15px] border border-zinc-800 bg-zinc-900/45 px-1.5 py-2.5 text-center transition-colors active:bg-zinc-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label="Abrir Equipe">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-violet-500/10 text-violet-300"><UsersRound size={18} strokeWidth={2}/></span>
                  <span className="block text-[11px] font-black leading-tight text-zinc-100">Equipe</span>
                  <span className="block text-[9px] leading-tight text-zinc-400">Colaboradores</span>
                </button>
                <button type="button" onClick={() => router.push('/motoboys')} className="flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[15px] border border-zinc-800 bg-zinc-900/45 px-1.5 py-2.5 text-center transition-colors active:bg-zinc-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400" aria-label="Abrir Motoboys">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-emerald-500/10 text-emerald-300"><Bike size={18} strokeWidth={2}/></span>
                  <span className="block text-[11px] font-black leading-tight text-zinc-100">Motoboys</span>
                  <span className="block text-[9px] leading-tight text-zinc-400">Entregadores</span>
                </button>
              </div>
            </>)}
          </div>
          <details className="group overflow-hidden rounded-[17px] border border-zinc-800 bg-zinc-950/30">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2.5 px-3.5 text-left text-[11px] font-bold text-zinc-300"><ShieldCheck size={17} className="text-sky-300"/><span className="flex-1">Confirmações, histórico e apoio</span><ChevronDown size={16} className="text-zinc-500 transition-transform group-open:rotate-180"/></summary>
            <nav aria-label="Acesso rápido a confirmações e histórico" className="grid grid-cols-2 gap-2 border-t border-zinc-800 p-2.5">
              <button type="button" onClick={() => router.push('/confirmacoes')} className="flex min-h-[94px] min-w-0 flex-col items-start justify-between gap-2 rounded-[15px] border border-red-500/20 bg-gradient-to-br from-red-500/[.07] to-zinc-950/50 p-3 text-left transition-colors active:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400" aria-label="Confirmar códigos pendentes do iFood">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-red-500/10 text-red-300"><ShieldCheck size={18} strokeWidth={2}/></span>
                <span className="min-w-0"><strong className="block text-[11px] font-black leading-tight text-zinc-100">Confirmar iFood</strong><small className="mt-0.5 block text-[10px] leading-snug text-zinc-400">Códigos e pendências</small></span>
              </button>
              <button type="button" onClick={() => router.push('/loja/caixa-de-entrada?aba=site&historico=1')} className="flex min-h-[94px] min-w-0 flex-col items-start justify-between gap-2 rounded-[15px] border border-sky-500/20 bg-gradient-to-br from-sky-500/[.07] to-zinc-950/50 p-3 text-left transition-colors active:bg-sky-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400" aria-label="Consultar histórico dos pedidos do Site">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-sky-500/10 text-sky-300"><History size={18} strokeWidth={2}/></span>
                <span className="min-w-0"><strong className="block text-[11px] font-black leading-tight text-zinc-100">Histórico do Site</strong><small className="mt-0.5 block text-[10px] leading-snug text-zinc-400">Pedidos anteriores</small></span>
              </button>
              <button type="button" onClick={() => router.push('/mais/preferencias')} className="col-span-2 flex min-h-[68px] w-full items-center gap-3 rounded-[15px] border border-emerald-500/20 bg-emerald-500/[.045] px-3 py-2.5 text-left transition-colors active:bg-emerald-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-emerald-500/10 text-emerald-300"><SlidersHorizontal size={19} strokeWidth={2}/></span>
                <span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-zinc-100">Preferências 360</strong><small className="mt-0.5 block text-[10px] leading-snug text-zinc-400">Rotas, parceiros e alertas</small></span>
                <ChevronRight size={16} className="shrink-0 text-emerald-300"/>
              </button>
            </nav>
          </details>
        </section>
      </section>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">Hoje em números</p>
            <h2 className="mt-0.5 font-heading text-[16px] font-black text-zinc-100">Resumo operacional</h2>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => { if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light); dashboardData.goToPreviousDay(); }}
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
              onClick={() => { if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light); dashboardData.goToNextDay(); }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500 active:scale-95"
              aria-label="Próximo dia"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded-[22px] border border-zinc-800/80 bg-zinc-900/35">
          <button
            onClick={() => setIsLogisticsModalOpen(true)}
            className="flex min-w-0 items-center justify-between gap-2 border-r border-zinc-800/80 p-3.5 text-left active:bg-zinc-900"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-sky-500">Operação</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-heading text-xl font-black text-zinc-50">{dashboardData.totalEntregas}</span>
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
            className="flex min-w-0 items-center justify-between gap-2 p-3.5 text-left active:bg-zinc-900"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-500">Valor dos pedidos</p>
              <p className="mt-1 font-heading text-[17px] font-black text-emerald-400">
                {isPrivacyMode ? 'R$ •••••' : `R$ ${formatMoney(dashboardData.faturamentoTotal)}`}
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Total econômico registrado no período</p>
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
            <h2 className="mt-0.5 font-heading text-[15px] font-black text-zinc-100">
              Leitura operacional
            </h2>
          </div>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[9px] font-black text-zinc-500">
            {intelligence.summary.total} sinal{intelligence.summary.total === 1 ? '' : 'is'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => router.push('/relatorios')}
          className="w-full rounded-[20px] border border-indigo-500/12 bg-indigo-500/[.025] p-3.5 text-left active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/[.08] text-indigo-400">
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
              <p className="mt-1 line-clamp-2 text-[11px] font-black leading-snug text-zinc-300">
                {intelligence.highlights[0]?.title || 'O cérebro ainda está formando uma base confiável'}
              </p>
              <p className="mt-1 text-[9px] text-zinc-600">
                Toque para abrir evidências e contexto nos Relatórios.
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-zinc-700" />
          </div>
        </button>
      </section>

      <section id="dfl-loja-expediente" className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Automação</p>
            <h2 className="font-heading text-base font-black text-zinc-100">Expediente</h2>
          </div>
          <button
            onClick={() => { setActiveTab('horarios'); setIsScheduleEditorOpen((value) => !value); }}
            className="text-[10px] font-black text-emerald-300"
          >
            {isScheduleEditorOpen ? 'Fechar editor' : 'Editar semana'}
          </button>
        </div>

        {isScheduleEditorOpen && (
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/[.06] px-3 py-2 text-[11px] font-medium text-emerald-300">
            Toque no dia, ajuste os horários e use “Salvar horário deste dia”. A alteração será gravada sem precisar abrir Configurações.
          </p>
        )}
        {!isScheduleEditorOpen && (
          <div className="rounded-[20px] border border-zinc-800/80 bg-zinc-900/35 p-3.5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-black text-zinc-200">{activeScheduleDays.length} dia{activeScheduleDays.length === 1 ? '' : 's'} programado{activeScheduleDays.length === 1 ? '' : 's'} na semana</p>
                <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">
                  Visão rápida do expediente. Toque em um dia para editar.
                </p>
              </div>
              <Clock size={18} className="shrink-0 text-indigo-400" />
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1">
              {DAYS_OF_WEEK.map((dayName, index) => {
                const dayData = schedule[index] || { active: false, shifts: [] };
                const active = dayData.active && dayData.shifts.length > 0;
                const shortNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

                return (
                  <button
                    key={dayName}
                    onClick={() => openDayEditor(index)}
                    className={`rounded-xl border px-0.5 py-1.5 text-center active:scale-95 ${active ? 'border-emerald-500/20 bg-emerald-500/[.07]' : 'border-zinc-800 bg-zinc-950/50'}`}
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
              <button onClick={() => setActiveTab('horarios')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-wide text-center border-b-2 ${activeTab === 'horarios' ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-zinc-500'}`}>Horários</button>
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

      <section id="dfl-loja-configuracoes" className="flex flex-col gap-3">
        <button
          onClick={() => setIsSettingsOpen((value) => !value)}
          className="flex items-center justify-between rounded-[20px] border border-zinc-800/70 bg-zinc-900/25 px-4 py-3.5 text-left active:scale-[0.99]"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">Configurações</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-black text-zinc-200"><SlidersHorizontal size={16} className="shrink-0 text-emerald-300"/>Logística, plataformas e preferências</p>
          </div>
          <ChevronDown size={18} className={`text-zinc-600 transition-transform ${isSettingsOpen ? 'rotate-180' : ''}`} />
        </button>
        <button type="button" onClick={() => router.push('/mais/preferencias')} className="mx-3 flex min-h-12 items-center justify-between gap-2.5 rounded-[14px] border border-emerald-500/20 bg-emerald-500/[.05] px-3 text-left text-[11px] font-bold text-emerald-200 transition-colors active:bg-emerald-500/10"><SlidersHorizontal size={17} className="shrink-0 text-emerald-300"/><span className="min-w-0 flex-1">Central de Preferências 360 · ver tudo</span><ChevronRight size={16} className="shrink-0"/></button>
        {/* R55: resumo fiel ao store fica disponivel sob demanda. */}
        <details className="group mx-3 overflow-hidden rounded-[16px] border border-zinc-800/75 bg-zinc-900/25">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[11px] font-bold text-zinc-300">
            <span className="flex min-w-0 flex-1 items-center gap-2"><Info size={16} className="shrink-0 text-sky-300"/>Conferir valores atuais</span><ChevronDown size={15} className="shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
          </summary>
        <div aria-label="Resumo das preferências operacionais" className="space-y-3 border-t border-zinc-800/70 px-3.5 pb-3.5 pt-3 text-[11px]">
          <p className="text-[11px] leading-relaxed text-zinc-400">Estas são as escolhas em vigor. Para alterar, abra a Central de Preferências 360.</p>
          <div className="grid gap-2 min-[370px]:grid-cols-3">
            <div className="rounded-[14px] border border-zinc-800 bg-zinc-950/40 p-2.5">
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Bike size={14} className="shrink-0 text-emerald-300"/>Ordem das rotas</span>
              <strong className="mt-1.5 block text-xs text-emerald-200">{routeOrderingMode === 'smart' ? 'Inteligente' : 'Manual'}</strong>
            </div>
            <div className="rounded-[14px] border border-zinc-800 bg-zinc-950/40 p-2.5">
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-400"><BellRing size={14} className="shrink-0 text-sky-300"/>Avisos de rota</span>
              <strong className="mt-1.5 block text-xs text-zinc-200">{routeReminderActive ? 'Ativos' : 'Pausados'}</strong>
            </div>
            <div className="rounded-[14px] border border-zinc-800 bg-zinc-950/40 p-2.5">
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Check size={14} className="shrink-0 text-amber-300"/>Fechar rotas</span>
              <strong className="mt-1.5 block text-xs text-zinc-200">{autoCloseActive ? 'Automático' : 'Manual'}</strong>
            </div>
          </div>
          <div className="border-t border-zinc-800/80 pt-3">
            <div className="flex items-center gap-2"><Store size={15} className="text-amber-300"/><h3 className="text-xs font-black text-zinc-100">Quem faz a entrega?</h3></div>
            <p className="mb-2.5 mt-1.5 text-[10px] leading-relaxed text-zinc-400">A escolha vale para novos pedidos. Entregas feitas pela plataforma não entram nas rotas da DFL; quando a DFL entrega, entram na nossa logística.</p>
            <div className="space-y-1.5">
              {([
                {source:'ifood' as const, label:'iFood', color:'text-red-300'},
                {source:'food99' as const, label:'99Food', color:'text-amber-300'},
                {source:'keeta' as const, label:'Keeta', color:'text-violet-300'},
              ] as const).map(item => {const partner = configuredMarketplaceMode(storeSettings.marketplaceDeliveryModes, item.source) === 'platform'; return (
                <div key={item.source} className="flex min-h-[57px] items-center justify-between gap-2 rounded-[13px] border border-zinc-800/80 bg-zinc-950/35 px-3 py-2">
                  <div className="min-w-0 flex-1"><strong className={`block text-[11px] font-black ${item.color}`}>{item.label}</strong><span className="mt-0.5 block text-[10px] leading-snug text-zinc-200">{partner ? 'Entregador da plataforma' : 'Entregador da DFL'}</span></div>
                  <span className={`max-w-[40%] text-right text-[10px] font-bold leading-snug ${partner ? 'text-zinc-400' : 'text-emerald-300'}`}>{partner ? 'Fora das rotas DFL' : 'Entra nas rotas DFL'}</span>
                </div>
              );})}
            </div>
          </div>
        </div>
        </details>
        {quickPreferenceBusy && <p role="status" className="px-4 pb-2 text-[11px] text-sky-300">Salvando preferência no sistema…</p>}

        {isSettingsOpen && (
          <div className="flex flex-col gap-4 rounded-[28px] border border-zinc-800 bg-zinc-900/45 p-4">
            <button type="button" onClick={()=>router.push('/mais/notificacoes')} className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[.05] px-3 text-left text-xs font-bold text-emerald-300">Personalizar notificações, horários e categorias <ChevronRight size={16}/></button>
             <section aria-label="Lembrete de preparo do Site" className="rounded-[22px] border border-sky-500/20 bg-sky-500/[.045] p-3.5">
               <h3 className="text-sm font-black text-zinc-100">Agendados · lembrar preparação</h3>
               <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">Aviso VISUAL na Caixa antes do horário do pedido. Não antecipa despacho, não envia WhatsApp ou push e não altera a janela do Site.</p>
               <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Antecedência visual de preparo">
                 {([15,30,60] as const).map(minutes => <button type="button" key={minutes}
                   disabled={quickPreferenceBusy || storeSettingsBusy || storeToggleBusy || sitePrepLead === minutes}
                   aria-pressed={sitePrepLead === minutes}
                   onClick={() => void saveQuickPreference({sitePreparationLeadMinutes:minutes})}
                   className={`min-h-12 rounded-xl border px-2 text-xs font-black disabled:opacity-60 ${sitePrepLead===minutes?'border-sky-400/40 bg-sky-500/10 text-sky-200':'border-zinc-700 bg-zinc-950/50 text-zinc-400'}`}>{minutes} min</button>)}
               </div>
             </section>
            <section aria-label="Ordenação das entregas" className="rounded-[22px] border border-emerald-500/20 bg-emerald-500/[.045] p-3.5">
              <div className="flex items-center gap-2"><Bike size={17} className="text-emerald-400" /><h3 className="text-sm font-black text-zinc-100">Ordem das entregas</h3></div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">Escolha como novas entregas entram nas rotas. Ajustes manuais confirmados nunca serão reorganizados automaticamente.</p>
              <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Modo de ordenação das rotas">
                {(['manual', 'smart'] as const).map(mode => (
                  <button key={mode} type="button" aria-pressed={routeOrderingMode === mode}
                    disabled={quickPreferenceBusy || storeSettingsBusy || storeToggleBusy || routeOrderingMode === mode}
                    onClick={() => void saveQuickPreference({ routeOrderingMode: mode })}
                    className={`min-h-[72px] rounded-2xl border px-3 py-2.5 text-left transition-colors active:scale-[.99] disabled:opacity-75 ${routeOrderingMode === mode ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200' : 'border-zinc-700 bg-zinc-950/50 text-zinc-300'}`}>
                    <span className="block text-xs font-black">{mode === 'manual' ? 'Manual' : 'Inteligente'}</span>
                    <span className="mt-1 block text-[10px] leading-snug opacity-75">{mode === 'manual' ? 'Chegada e movimentos definidos por você' : 'Sugestão automática na inserção de novos pedidos'}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">A mudança não altera o histórico nem reorganiza rotas prontas. Na opção inteligente, a distância é considerada somente quando houver origem e localizações suficientes. Se uma rota foi movida manualmente, sua sequência tem prioridade.</p>
            </section>
            <details className="group rounded-[20px] border border-zinc-800/80 bg-zinc-950/35" open>
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-sm font-black text-zinc-100">Plataformas parceiras <ChevronDown size={17} className="text-zinc-400 transition-transform group-open:rotate-180" /></summary>
            <section className="rounded-2xl border border-amber-500/20 bg-zinc-950/50 p-3">
              <p className="text-xs font-black text-zinc-100">Entrega por plataforma</p>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Defina se a plataforma entrega o pedido ou se a DFL precisa de endereço e rota. A alteração vale para novos cadastros; históricos não mudam.</p>
              {(['ifood','food99','keeta'] as const).map(source => {
                const mode = configuredMarketplaceMode(storeSettings.marketplaceDeliveryModes, source);
                const accent = source === 'ifood' ? 'text-red-300' : source === 'food99' ? 'text-amber-300' : 'text-violet-300';
                return <div key={source} className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-black ${accent}`}>{source === 'ifood' ? 'iFood' : source === 'food99' ? '99Food' : 'Keeta'}</p>
                    <span className="text-[10px] font-semibold text-zinc-500">{mode === 'platform' ? 'Sem rota DFL' : 'Com rota DFL'}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label={`Modo padrão de entrega ${source}`}>
                    {(['dfl','platform'] as const).map(next => <button key={next} type="button"
                      disabled={storeSettingsBusy||quickPreferenceBusy||mode===next} aria-pressed={mode===next}
                      onClick={() => void saveQuickPreference({ marketplaceDeliveryModes: mergeMarketplacePreference(storeSettings.marketplaceDeliveryModes,source,next) })}
                      className={`min-h-12 rounded-xl border px-2 text-[11px] font-black transition-colors disabled:opacity-60 ${mode===next?'border-amber-400/45 bg-amber-400/10 text-amber-200':'border-zinc-700 bg-zinc-950/40 text-zinc-400'}`}>
                      {next === 'dfl' ? 'DFL entrega' : 'Parceira entrega'}
                    </button>)}
                  </div>
                </div>;
              })}
              <p className="px-1 text-[10px] leading-relaxed text-zinc-500">O padrão é aplicado apenas ao cadastrar. Alterar aqui não reclassifica entregas, pagamentos ou acertos anteriores.</p>
            </section>
            </details>
            <details className="group rounded-[20px] border border-zinc-800/80 bg-zinc-950/35">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-sm font-black text-zinc-100">Origem e navegação <ChevronDown size={17} className="text-zinc-400 transition-transform group-open:rotate-180" /></summary>
              <div className="px-3.5 pb-3.5">
            <div className="flex flex-col gap-2">
              <AddressAutocomplete value={storeAddress} onChange={setStoreAddress} placeholder="Rua, Número, Bairro, Cidade - MG" label="Endereço Base (Origem)" />
              <p className="px-1 text-[11px] font-medium text-zinc-400">Origem das rotas. Informe rua e número ou salve um ponto exato no mapa.</p>
              {!(storePoint || storedOriginPoint(storeSettings)) && !hasSpecificStoreAddress(storeAddress) && (
                <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/[.05] p-3 text-[11px] leading-relaxed text-amber-200">
                  Cidade ou bairro isolado não define a origem da loja. Para organizar as rotas corretamente, salve a localização precisa ou informe o endereço completo.
                </p>
              )}
              <button type="button" onClick={captureStoreLocation} disabled={capturingStoreLocation} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/[.07] px-3 text-xs font-black text-sky-400 disabled:opacity-50"><Crosshair size={15}/>{capturingStoreLocation ? 'Obtendo e salvando localização…' : 'Usar GPS e salvar origem da loja'}</button>
              <LocationPermissionGuide code={locationFailure} />
              <div className="grid grid-cols-[1fr_auto] gap-2"><input value={storeLocationReference} onChange={e=>setStoreLocationReference(e.target.value)} placeholder="Coordenadas ou link completo do Maps" className="h-11 min-w-0 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs text-zinc-200 outline-none focus:border-sky-500"/><button type="button" onClick={applyStoreReference} className="rounded-xl border border-zinc-700 px-3 text-[10px] font-black text-zinc-300">Usar</button></div>
            </div>
              </div>
            </details>
            <details className="group rounded-[20px] border border-zinc-800/80 bg-zinc-950/35">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-sm font-black text-zinc-100">Alertas e automações <ChevronDown size={17} className="text-zinc-400 transition-transform group-open:rotate-180" /></summary>
              <div className="space-y-2 px-3 pb-3">
            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500"><AlertTriangle size={18} /></div>
                <div>
                  <p className="text-sm font-black text-zinc-200">Alerta de retorno</p>
                  <p className="text-[10px] text-zinc-600">Avisa quando o motoboy volta</p>
                </div>
              </div>
              <button type="button" onClick={() => { if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light); setRouteAlertsEnabled(!routeAlertsEnabled); }} className={`relative inline-flex h-8 w-14 items-center rounded-full ${routeAlertsEnabled ? 'bg-amber-500' : 'border border-zinc-700 bg-zinc-800'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${routeAlertsEnabled ? 'translate-x-7' : 'translate-x-1'}`} /></button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-400"><BellRing size={18} /></div>
                <div>
                  <p className="text-sm font-black text-zinc-200">Automação da loja</p>
                  <p className="text-[10px] text-zinc-600">Abre e fecha pelos horários</p>
                </div>
              </div>
              <button type="button" onClick={() => { if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light); setAlertsEnabled(!alertsEnabled); }} className={`relative inline-flex h-8 w-14 items-center rounded-full ${alertsEnabled ? 'bg-sky-500' : 'border border-zinc-700 bg-zinc-800'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform ${alertsEnabled ? 'translate-x-7' : 'translate-x-1'}`} /></button>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 text-violet-400"><BellRing size={18}/></div><div><p className="text-sm font-black text-zinc-200">Rotas e lembretes</p><p className="text-[10px] text-zinc-500">Lembretes e fechamento são salvos individualmente. Desativar o automático exige finalizar rotas manualmente.</p></div></div>
              <div className="flex min-w-0 flex-col gap-2">
                <button type="button" role="switch" aria-label="Lembretes de rotas" aria-checked={routeReminderActive} aria-busy={quickPreferenceBusy} disabled={storeSettingsBusy||quickPreferenceBusy} onClick={()=>void saveQuickPreference({routeReminderEnabled:!routeReminderActive})} className={`min-h-10 rounded-xl border px-3 text-[10px] font-bold disabled:opacity-50 ${routeReminderActive?'border-violet-500/40 bg-violet-500/10 text-violet-300':'border-zinc-700 text-zinc-400'}`}>Lembretes {routeReminderActive?'ligados':'desligados'}</button>
                <button type="button" role="switch" aria-label="Fechamento automático das rotas" aria-checked={autoCloseActive} aria-busy={quickPreferenceBusy} disabled={storeSettingsBusy||quickPreferenceBusy} onClick={()=>void saveQuickPreference({autoCloseCompletedRoutes:!autoCloseActive})} className={`min-h-10 rounded-xl border px-3 text-[10px] font-bold disabled:opacity-50 ${autoCloseActive?'border-emerald-500/40 bg-emerald-500/10 text-emerald-300':'border-zinc-700 text-zinc-400'}`}>Fechamento auto {autoCloseActive?'ligado':'desligado'}</button>
              </div>
            </div>

              </div>
            </details>
            <button onClick={handleSaveAllSettings} disabled={storeSettingsBusy || storeToggleBusy} aria-busy={storeSettingsBusy} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-4 text-xs font-black uppercase tracking-widest text-zinc-950 active:scale-95"><Check size={16} /> Salvar configurações</button>
          </div>
        )}
      </section>

      {editingDay !== null && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-zinc-950 animate-in slide-in-from-bottom duration-300">
           <div className="flex items-center justify-between p-4 border-b border-zinc-800/80 bg-zinc-950 shrink-0"><button onClick={() => setEditingDay(null)} className="p-2 text-zinc-400 active:scale-90 bg-zinc-900 rounded-full"><ChevronLeft size={24}/></button><span className="font-bold text-zinc-50">Editar horários</span><div className="w-10"></div></div>
           <div className="flex-1 overflow-y-auto pb-32">
             <div className="p-6 flex items-center justify-between"><span className="text-2xl font-bold text-zinc-100">{DAYS_OF_WEEK[editingDay]}</span><button type="button" onClick={() => { if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light); setTempDaySchedule(prev => ({ ...prev, active: !prev.active })); }} className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${tempDaySchedule.active ? 'bg-indigo-500' : 'bg-zinc-800 border border-zinc-700'}`}><span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-300 ${tempDaySchedule.active ? 'translate-x-7' : 'translate-x-1'}`} /></button></div>
             {tempDaySchedule.active && (
               <div className="px-6 flex flex-col gap-4">
                 {tempDaySchedule.shifts.map((shift, sIdx) => (
                   <div key={sIdx} className="flex items-center gap-3">
                     <button onClick={() => { if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light); setTimePicker({ isOpen: true, shiftIndex: sIdx, field: 'start', hour: shift.start.split(':')[0], minute: shift.start.split(':')[1] }); }} className="flex-1 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 flex items-center justify-between text-zinc-200 font-bold active:bg-zinc-800 transition-colors shadow-sm">{shift.start}<ChevronDown size={18} className="text-zinc-500" /></button>
                     <span className="text-zinc-600 font-black">-</span>
                     <button onClick={() => { if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light); setTimePicker({ isOpen: true, shiftIndex: sIdx, field: 'end', hour: shift.end.split(':')[0], minute: shift.end.split(':')[1] }); }} className="flex-1 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl px-5 flex items-center justify-between text-zinc-200 font-bold active:bg-zinc-800 transition-colors shadow-sm">{shift.end}<ChevronDown size={18} className="text-zinc-500" /></button>
                     {tempDaySchedule.shifts.length > 1 && <button onClick={() => { if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Medium); setTempDaySchedule(p => ({...p, shifts: p.shifts.filter((_, idx) => idx !== sIdx)})); }} className="p-4 text-zinc-500 hover:text-red-500 bg-zinc-900 border border-zinc-800 rounded-2xl transition-colors"><Trash2 size={20}/></button>}
                   </div>
                 ))}
                 <button onClick={() => { if (Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Light); setTempDaySchedule(p => ({...p, shifts: [...p.shifts, { start: '00:00', end: '00:00' }]})); }} className="self-end p-3 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 active:scale-90 transition-all mt-2 shadow-sm"><Plus size={20}/></button>
               </div>
             )}
             <div className="flex flex-col px-6 mt-10">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Ajustes Rápidos</span>
                <button onClick={() => applyQuickAdjustment('24h')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Aberto 24 horas | 00:00 às 23:59h</button>
                <button onClick={() => applyQuickAdjustment('almoco')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Almoço | 11:00 às 15:00h</button>
                <button onClick={() => applyQuickAdjustment('janta')} className="text-left py-5 border-b border-zinc-800/80 text-zinc-300 text-sm font-semibold active:bg-zinc-900/50 transition-colors">Janta | 18:00 às 23:00h</button>
             </div>
           </div>
           <div className="dfl-fixed-footer fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-zinc-800 bg-zinc-950 p-4 shrink-0"><button onClick={saveDayEditor} disabled={savingSchedule} className="w-full h-14 bg-emerald-500 disabled:opacity-60 text-zinc-950 font-black rounded-xl text-base active:scale-95 transition-all shadow-xl">{savingSchedule ? "Salvando horário…" : "Salvar horário deste dia"}</button></div>
        </div>
      )}

      {timePicker && <StoreTimePicker field={timePicker.field} hour={timePicker.hour} minute={timePicker.minute} onClose={() => setTimePicker(null)} onConfirm={confirmTimePicker} onChange={(value) => setTimePicker(current => current ? {...current,...value} : null)} />}
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
             <button onClick={() => { if(Capacitor.isNativePlatform()) touchFeedback(ImpactStyle.Medium); setPauses(prev => [...prev, { ...tempPause, id: Date.now().toString() }]); setIsPauseModalOpen(false); }} className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black rounded-xl mt-2 active:scale-95 transition-all text-lg shadow-lg shadow-amber-500/20">Salvar Pausa</button>
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
