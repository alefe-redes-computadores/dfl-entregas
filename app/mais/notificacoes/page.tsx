'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  Bike,
  Box,
  Check,
  ChevronLeft,
  Clock3,
  PackageCheck,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Store,
  WifiOff,
  Moon,
  Gauge,
  Search,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/operational-toast';
import { Capacitor } from '@capacitor/core';
import {
  DEFAULT_NOTIFICATION_DELIVERY_POLICY,
  resolveNotificationDeliveryPolicy,
  type NotificationDeliveryPolicy,
} from '@/lib/native/notification-delivery-policy';

import { useAppStore } from '@/store/useAppStore';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPermissionStatus,
  requestNotificationPermission,
  resolveNotificationPreferences,
  sendTestNotification,
  type NotificationPreferenceKey,
  type NotificationPreferences,
  reconcileNotificationPreferences,
  syncShiftNotifications,
  syncOpenRouteReminderNotifications,
} from '@/lib/native/notifications';

type ToggleRowProps = {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
};

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: ToggleRowProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      className="flex w-full items-center gap-3 border-b border-zinc-800/70 px-4 py-3.5 text-left last:border-b-0 disabled:opacity-45"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-zinc-200">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">
          {description}
        </span>
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-emerald-500' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </span>
    </button>
  );
}

function TimeRow({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex w-full items-center gap-3 border-b border-zinc-800/70 px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-zinc-200">{title}</span>
        <span className="mt-0.5 block text-[10px] leading-relaxed text-zinc-500">{description}</span>
      </span>
      <input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-black text-zinc-100 outline-none focus:border-emerald-500 disabled:opacity-40"
      />
    </label>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof Bell;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/45">
      <div className="flex items-center gap-3 border-b border-zinc-800 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <Icon size={18} />
        </span>
        <span>
          <b className="block text-sm text-zinc-100">{title}</b>
          <small className="text-[10px] text-zinc-500">{subtitle}</small>
        </span>
      </div>
      {children}
    </section>
  );
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const storeSettings = useAppStore((state) => state.storeSettings);
  const updateStoreSettings = useAppStore((state) => state.updateStoreSettings);
  const [permissionState, setPermissionState] = useState<
    string | null
  >(null);
  const [testing, setTesting] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const testLock = useRef(false);

  const preferences = useMemo(
    () =>
      resolveNotificationPreferences(
        storeSettings.notificationPreferences,
      ),
    [storeSettings.notificationPreferences],
  );

  const isNative = Capacitor.isNativePlatform();
  const deliveryPolicy = useMemo(
    () => resolveNotificationDeliveryPolicy(preferences.deliveryPolicy),
    [preferences.deliveryPolicy],
  );
  const showCategory = (label: string) => !categorySearch.trim() ||
    label.toLocaleLowerCase('pt-BR').includes(categorySearch.trim().toLocaleLowerCase('pt-BR'));

  useEffect(() => {
    let mounted = true;
    void notificationPermissionStatus().then((value) => {
      if (mounted) setPermissionState(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const save = async (next: NotificationPreferences) => {
    if (saveLock.current) return false;
    saveLock.current = true;
    setSaving(true);
    const previous = preferences;
    try {
      if (next.enabled && isNative && !(await requestNotificationPermission())) {
        setPermissionState(await notificationPermissionStatus());
        toast.error('Autorize as notificações no Android para ativá-las.');
        return false;
      }
      await updateStoreSettings({
        notificationPreferences: next,
        // Mantém compatibilidade com os controles antigos enquanto eles
        // ainda existirem em Loja.
        alertsEnabled: next.enabled,
        routeReminderEnabled: next.routeOpenReminder,
      });
      await reconcileNotificationPreferences(previous, next);
      if (JSON.stringify(resolveNotificationDeliveryPolicy(previous.deliveryPolicy)) !== JSON.stringify(resolveNotificationDeliveryPolicy(next.deliveryPolicy))) {
        const latest = useAppStore.getState();
        await Promise.all([
          syncShiftNotifications({ ...latest.storeSettings, notificationPreferences: next }),
          syncOpenRouteReminderNotifications(latest.routes, { ...latest.storeSettings, notificationPreferences: next }),
        ]);
      }
      return true;
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar as notificações.');
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const toggle = (key: NotificationPreferenceKey) => {
    void save({
      ...preferences,
      [key]: !preferences[key],
    }).then((ok) => { if (ok) toast.success('Categoria atualizada.'); });
  };

  const savePolicy = (patch: Partial<NotificationDeliveryPolicy>) => {
    if (saveLock.current) return;
    const next = { ...deliveryPolicy, ...patch };
    void save({ ...preferences, deliveryPolicy: next }).then((ok) => {
      if (ok) toast.success('Ritmo e prioridades salvos.');
    });
  };

  const saveTime = (
    key: 'purchasePlanningTime' | 'stockReviewTime',
    value: string,
  ) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return;
    if (saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    void updateStoreSettings({ [key]: value }).then(() => {
      toast.success('Horário salvo.', { description: 'O agendamento local será atualizado conforme a permissão do Android.' });
    }).catch(() => {
      toast.error('Não foi possível atualizar o horário.');
    }).finally(() => {
      saveLock.current = false;
      setSaving(false);
    });
  };

  const toggleMaster = async () => {
    if (preferences.enabled) {
      if (await save({ ...preferences, enabled: false })) toast.success('Notificações pausadas.');
      return;
    }

    if (await save({ ...preferences, enabled: true })) {
      setPermissionState(await notificationPermissionStatus());
      toast.success('Notificações ativadas.');
    }
  };

  const enableAll = async () => {
    const saved = await save({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      deliveryPolicy: preferences.deliveryPolicy,
      enabled: true,
      shiftOpen: true,
      shiftClose: true,
      ifoodAdsBeforeOpen: true,
      ifoodAdsAfterClose: true,
    });
    if (saved) toast.success('Todas as notificações foram ativadas.');
  };

  const defaults = async () => {
    if (await save({ ...DEFAULT_NOTIFICATION_PREFERENCES, deliveryPolicy: DEFAULT_NOTIFICATION_DELIVERY_POLICY })) toast.success('Preferências recomendadas restauradas.');
  };

  const requestPermission = async () => {
    if (!isNative) {
      toast.message('A permissão nativa estará disponível no APK.');
      return;
    }

    const granted = await requestNotificationPermission();
    setPermissionState(await notificationPermissionStatus());
    if (granted) {
      toast.success('Notificações autorizadas no Android.');
    } else {
      toast.error(
        'O Android não autorizou notificações. Confira as permissões do app.',
      );
    }
  };

  const test = async () => {
    if (!isNative) {
      toast.message('O teste nativo funciona no APK instalado.');
      return;
    }

    if (testLock.current) return;
    testLock.current = true;
    setTesting(true);
    try {
      const sent = await sendTestNotification();
      setPermissionState(await notificationPermissionStatus());
      if (sent) {
        toast.success('Notificação de teste enviada.');
      } else {
        toast.error('Não foi possível enviar a notificação de teste.');
      }
    } catch {
      toast.error('Não foi possível testar as notificações.');
    } finally {
      testLock.current = false;
      setTesting(false);
    }
  };

  // R197: indicador de grupos efetivamente habilitados, sem confundir permissão Android com preferência.
  const enabledNotificationGroups = Object.entries(preferences).filter(([key, value]) => key !== 'enabled' && typeof value === 'boolean' && value).length;
  const masterDisabled = !preferences.enabled || saving;
  const permissionLabel =
    permissionState === 'granted'
      ? 'Permitidas pelo Android'
      : permissionState === 'denied'
        ? 'Bloqueadas pelo Android'
        : permissionState === 'prompt'
          ? 'Permissão ainda não solicitada'
          : isNative
            ? 'Verificando permissão'
            : 'Disponível no APK';

  return (
    <div className="pb-28">
      <header className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.replace('/mais')}
          className="grid h-11 w-11 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300"
          aria-label="Voltar"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">
            Preferências
          </p>
          <h1 className="font-heading text-xl font-black text-zinc-50">
            Notificações
          </h1>
          <p className="text-[10px] text-zinc-500">
            Escolha o que realmente merece interromper você.
          </p>
        </div>
      </header>

      <p className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/35 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-400">As categorias abaixo já controlam avisos reais. O Android exige autorização explícita. Lembretes de turno/estoque são agendados localmente; ações diretas na notificação ainda não estão disponíveis.</p>
      <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3">
        <label htmlFor="dfl-notification-category-search" className="mb-2 flex items-center gap-2 text-xs font-bold text-zinc-300"><Search size={15}/> Encontrar avisos</label>
        <input id="dfl-notification-category-search" value={categorySearch} onChange={(event)=>setCategorySearch(event.target.value)} placeholder="Expediente, rotas, iFood, estoque, sistema…" className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-emerald-400" />
        <p className="mt-2 text-[10px] text-zinc-500">Filtra os grupos desta página. Preferências salvas não são alteradas pela busca.</p>
      </div>
      <div aria-label="Estado das notificações" className="mb-3 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Preferências</p><p className="mt-1 text-xs font-black text-zinc-100">{preferences.enabled ? `${enabledNotificationGroups} grupos ativos` : 'Avisos pausados'}</p></div>
        <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-3"><p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Permissão do aparelho</p><p className="mt-1 text-[11px] font-bold leading-snug text-zinc-200">{permissionLabel}</p></div>
      </div>
      <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/35 px-3 py-3">
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-zinc-400">
          {isNative ? 'APK Android: os avisos locais exigem permissão do sistema. Ativar uma categoria não confirma que uma mensagem externa foi entregue.' : 'PWA: estas preferências não comprovam notificações nativas em segundo plano. O teste do Android está disponível apenas no APK.'}
          {' '}Mensageria WhatsApp e acompanhamento do Site possuem autorizações separadas.
        </p>
        {isNative && <button type="button" onClick={() => void notificationPermissionStatus().then(setPermissionState).catch(() => toast.error('Não foi possível consultar a permissão.'))} className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-zinc-700 px-2 text-[10px] font-bold text-zinc-200"><RefreshCcw size={13}/> Atualizar</button>}
      </div>
      {saving && <p role="status" className="mb-3 rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">Salvando suas preferências…</p>}
      <fieldset disabled={saving} className="min-w-0">

      <section className="mb-4 rounded-[26px] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[.10] to-zinc-900/40 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <BellRing size={21} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-zinc-100">
              Notificações operacionais
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              O interruptor geral pausa todos os avisos do DFL sem alterar
              sua escala, estoque ou outros dados.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleMaster()}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${
              preferences.enabled ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
            aria-label="Ativar ou desativar notificações"
            role="switch"
            aria-checked={preferences.enabled}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
                preferences.enabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-zinc-950/45 p-3">
          <Smartphone
            size={16}
            className={
              permissionState === 'granted'
                ? 'text-emerald-400'
                : 'text-amber-400'
            }
          />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase text-zinc-500">
              Permissão do sistema
            </p>
            <p className="text-xs font-bold text-zinc-300">
              {permissionLabel}
            </p>
          </div>
          {permissionState !== 'granted' && isNative && (
            <button
              type="button"
              onClick={requestPermission}
              className="rounded-xl bg-emerald-500 px-3 py-2 text-[10px] font-black text-zinc-950"
            >
              Autorizar
            </button>
          )}
        </div>
      </section>

      <section aria-label="Ritmo e prioridade" className="mb-4 overflow-hidden rounded-[24px] border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[.07] to-zinc-900/40">
        <div className="flex gap-3 border-b border-zinc-800 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><Gauge size={19}/></span><div><h2 className="text-sm font-black text-zinc-100">Ritmo e prioridades</h2><p className="mt-1 text-[11px] text-zinc-400">Controle avisos do APK sem alterar mensagens externas.</p></div></div>
        <div className="space-y-4 p-4">
          <div><p className="mb-2 text-xs font-black text-zinc-200">Frequência de alertas repetitivos</p><div role="group" aria-label="Frequência dos alertas" className="grid grid-cols-3 gap-2">{([['immediate','Normal'],['balanced','Moderada'],['minimal','Mínima']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={deliveryPolicy.frequency===value} disabled={saving} onClick={()=>savePolicy({frequency:value})} className={`min-h-12 rounded-xl border px-2 text-[11px] font-bold disabled:opacity-50 ${deliveryPolicy.frequency===value?'border-emerald-400/40 bg-emerald-500/10 text-emerald-200':'border-zinc-700 bg-zinc-950/50 text-zinc-400'}`}>{label}</button>)}</div><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Moderada agrupa avisos repetidos por tema por 10 min; mínima por 45 min. Novos pedidos do Site e alertas críticos nunca são agrupados.</p></div>
          <div><p className="mb-2 text-xs font-black text-zinc-200">Nível de prioridade</p><div role="group" aria-label="Nível de prioridade" className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={deliveryPolicy.priority==='all'} disabled={saving} onClick={()=>savePolicy({priority:'all'})} className={`min-h-12 rounded-xl border px-3 text-xs font-bold disabled:opacity-50 ${deliveryPolicy.priority==='all'?'border-sky-400/40 bg-sky-500/10 text-sky-200':'border-zinc-700 text-zinc-400'}`}>Todos os ativos</button><button type="button" aria-pressed={deliveryPolicy.priority==='important'} disabled={saving} onClick={()=>savePolicy({priority:'important'})} className={`min-h-12 rounded-xl border px-3 text-xs font-bold disabled:opacity-50 ${deliveryPolicy.priority==='important'?'border-amber-400/40 bg-amber-500/10 text-amber-200':'border-zinc-700 text-zinc-400'}`}><Zap size={14} className="mr-1 inline"/>Só essenciais</button></div><p className="mt-2 text-[10px] leading-relaxed text-zinc-500">Essenciais: pedido Site, confirmação iFood pendente, estoque zerado, falha de sincronização e rota aberta. Categorias não essenciais ficam silenciadas, mesmo ligadas individualmente.</p></div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40">
            <ToggleRow title="Horário de silêncio" description="Desliga avisos locais durante a faixa escolhida, respeitando as exceções abaixo." checked={deliveryPolicy.quietEnabled} onChange={()=>savePolicy({quietEnabled:!deliveryPolicy.quietEnabled})} disabled={saving}/>
            {deliveryPolicy.quietEnabled && <div className="grid grid-cols-2 gap-2 px-3 pb-2"><label className="text-[10px] font-bold text-zinc-400">De <input type="time" value={deliveryPolicy.quietFrom} disabled={saving} onChange={(event)=>savePolicy({quietFrom:event.target.value})} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"/></label><label className="text-[10px] font-bold text-zinc-400">Até <input type="time" value={deliveryPolicy.quietUntil} disabled={saving} onChange={(event)=>savePolicy({quietUntil:event.target.value})} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-xs text-zinc-100"/></label></div>}
            {deliveryPolicy.quietEnabled && <ToggleRow title="Permitir essenciais durante o silêncio" description="Mantém pedidos do Site e alertas críticos. Desative para silêncio total." checked={deliveryPolicy.criticalDuringQuiet} onChange={()=>savePolicy({criticalDuringQuiet:!deliveryPolicy.criticalDuringQuiet})} disabled={saving}/>}
          </div>
          <p className="flex items-start gap-2 text-[10px] leading-relaxed text-zinc-500"><Moon size={15} className="mt-0.5 shrink-0 text-emerald-400"/> Avisos silenciados não ficam numa fila de envio tardio. Lembretes locais agendados são recalculados ao salvar. A operação e os registros continuam normalmente.</p>
        </div>
      </section>

      <div className="space-y-4">
        {showCategory('expediente abertura fechamento turno anúncios ifood') && <Section
          icon={Clock3}
          title="Expediente"
          subtitle="Baseado nos horários reais configurados em Loja"
        >
          <ToggleRow
            title="15 min antes de abrir"
            description="Lembra de preparar equipe, estoque e operação."
            checked={preferences.shiftPrepare}
            onChange={() => toggle('shiftPrepare')}
            disabled={masterDisabled}
          />
          <ToggleRow
            title="No início do expediente"
            description="Confirma que o turno programado começou."
            checked={preferences.shiftOpen}
            onChange={() => toggle('shiftOpen')}
            disabled={masterDisabled}
          />
          <ToggleRow
            title="15 min antes de fechar"
            description="Lembra de revisar rotas, iFood e pendências."
            checked={preferences.shiftPreClose}
            onChange={() => toggle('shiftPreClose')}
            disabled={masterDisabled}
          />
          <ToggleRow
            title="Ao terminar a última rota"
            description="Avisa quando não há mais rotas abertas; não depende apenas do relógio."
            checked={preferences.shiftClose}
            onChange={() => toggle('shiftClose')}
            disabled={masterDisabled}
          />
          <ToggleRow
            title="Anúncio iFood: antes de abrir"
            description="5 minutos antes de cada turno, lembra de conferir a ativação do anúncio no iFood."
            checked={preferences.ifoodAdsBeforeOpen}
            onChange={() => toggle('ifoodAdsBeforeOpen')}
            disabled={masterDisabled}
          />
          <ToggleRow
            title="Anúncio iFood: após fechar"
            description="15 minutos após o fechamento previsto, lembra de conferir se o anúncio deve ser pausado."
            checked={preferences.ifoodAdsAfterClose}
            onChange={() => toggle('ifoodAdsAfterClose')}
            disabled={masterDisabled}
          />
          <p className="px-4 py-3 text-xs leading-relaxed text-zinc-400">Os lembretes seguem dias, turnos, pausas e exceções da Loja. Eles não ativam nem pausam anúncios automaticamente.</p>
        </Section>}

        {showCategory('pedidos rotas ifood confirmação') && <Section
          icon={Bike}
          title="Pedidos, rotas e iFood"
          subtitle="Avisos que levam direto para a ação necessária"
        >
          <ToggleRow
            title="Novo pedido do site"
            description="Ao sincronizar um pedido novo, abre diretamente os detalhes para conferência."
            checked={preferences.siteOrderNew}
            onChange={() => toggle('siteOrderNew')}
            disabled={masterDisabled}
          />
          <ToggleRow
            title="Rota ainda aberta"
            description="Lembrete próximo ao fechamento quando existe rota iniciada."
            checked={preferences.routeOpenReminder}
            onChange={() => toggle('routeOpenReminder')}
            disabled={masterDisabled}
          />
          <ToggleRow
              title="Rota iniciada"
              description="Confirma quem iniciou, motoboy, pedidos e paradas."
              checked={preferences.routeStarted}
              onChange={() => toggle('routeStarted')}
              disabled={masterDisabled}
            />
            <ToggleRow
            title="Rota finalizada"
            description="Confirma o encerramento quando não há iFood pendente."
            checked={preferences.routeFinished}
            onChange={() => toggle('routeFinished')}
            disabled={masterDisabled}
          />
          <ToggleRow
            title="Confirmações iFood pendentes"
            description="Depois de finalizar a rota, avisa somente se restarem confirmações e abre a Central dessa rota."
            checked={preferences.ifoodPending}
            onChange={() => toggle('ifoodPending')}
            disabled={masterDisabled}
          />
        </Section>}

        {showCategory('estoque compras abastecimento reposição') && <Section
          icon={Box}
          title="Estoque e compras"
          subtitle="Alertas baseados em mudança real de saldo ou status"
        >
          <ToggleRow
            title="Planejamento de compras"
            description="Nos dias de funcionamento, lembra de registrar compras, recebimentos e reposições."
            checked={preferences.purchasePlanning}
            onChange={() => toggle('purchasePlanning')}
            disabled={masterDisabled}
          />
          <TimeRow
            title="Horário do planejamento"
            description="Padrão recomendado: 12:00."
            value={storeSettings.purchasePlanningTime || '12:00'}
            onChange={(value) => saveTime('purchasePlanningTime', value)}
            disabled={masterDisabled || !preferences.purchasePlanning}
          />
          <ToggleRow
            title="Conferência diária do estoque"
            description="Uma vez por dia de funcionamento, lembra de registrar saídas e ajustes pendentes."
            checked={preferences.closingReview}
            onChange={() => toggle('closingReview')}
            disabled={masterDisabled}
          />
          <TimeRow
            title="Horário da conferência"
            description="Padrão recomendado: 23:30."
            value={storeSettings.stockReviewTime || '23:30'}
            onChange={(value) => saveTime('stockReviewTime', value)}
            disabled={masterDisabled || !preferences.closingReview}
          />
          <ToggleRow
            title="Estoque baixo"
            description="Somente quando o produto cruza o mínimo cadastrado."
            checked={preferences.stockLow}
            onChange={() => toggle('stockLow')}
            disabled={masterDisabled}
          />
          <ToggleRow
            title="Produto zerado"
            description="Alerta prioritário ao saldo chegar a zero."
            checked={preferences.stockZero}
            onChange={() => toggle('stockZero')}
            disabled={masterDisabled}
          />
          <ToggleRow
            title="Compra aguardando conferência"
            description="Lembra 10 minutos após uma compra ser recebida."
            checked={preferences.supplyCheck}
            onChange={() => toggle('supplyCheck')}
            disabled={masterDisabled}
          />
        </Section>}

        {showCategory('sistema sincronização falha') && <Section
          icon={ShieldCheck}
          title="Sistema"
          subtitle="Somente problemas que precisam da sua atenção"
        >
          <ToggleRow
            title="Falha de sincronização"
            description="Alerta com proteção contra repetição excessiva."
            checked={preferences.syncFailure}
            onChange={() => toggle('syncFailure')}
            disabled={masterDisabled}
          />
        </Section>}
      </div>

      <section className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={defaults}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 text-xs font-black text-zinc-300"
        >
          <RefreshCcw size={15} />
          Recomendadas
        </button>
        <button
          type="button"
          onClick={enableAll}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.08] text-xs font-black text-emerald-400"
        >
          <Check size={15} />
          Ativar todas
        </button>
      </section>

      <button
        type="button"
        onClick={test}
        disabled={testing}
        className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950 disabled:opacity-50"
      >
        <Bell size={18} />
        {testing ? 'Enviando...' : 'Enviar notificação de teste'}
      </button>

      <div className="mt-3 flex gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/35 p-3 text-[10px] leading-relaxed text-zinc-500">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
        <p>
          Avisos de expediente são agendados localmente e podem chegar com o
          app fechado. Eventos remotos que acontecem enquanto o app não está
          rodando exigem Push Notification e ficam separados deste módulo.
        </p>
      </div>
      </fieldset>
    </div>
  );
}
