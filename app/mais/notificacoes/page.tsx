'use client';

import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';

import { useAppStore } from '@/store/useAppStore';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPermissionStatus,
  requestNotificationPermission,
  resolveNotificationPreferences,
  sendTestNotification,
  type NotificationPreferenceKey,
  type NotificationPreferences,
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

  const preferences = useMemo(
    () =>
      resolveNotificationPreferences(
        storeSettings.notificationPreferences,
      ),
    [storeSettings.notificationPreferences],
  );

  const isNative = Capacitor.isNativePlatform();

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
    try {
      await updateStoreSettings({
        notificationPreferences: next,
        // Mantém compatibilidade com os controles antigos enquanto eles
        // ainda existirem em Loja.
        alertsEnabled: next.enabled,
        routeReminderEnabled: next.routeOpenReminder,
      });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível salvar as notificações.');
    }
  };

  const toggle = (key: NotificationPreferenceKey) => {
    void save({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  const toggleMaster = () => {
    void save({
      ...preferences,
      enabled: !preferences.enabled,
    });
  };

  const enableAll = () => {
    void save({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      enabled: true,
      shiftOpen: true,
      shiftClose: true,
    });
    toast.success('Todas as notificações foram ativadas.');
  };

  const defaults = () => {
    void save(DEFAULT_NOTIFICATION_PREFERENCES);
    toast.success('Preferências recomendadas restauradas.');
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

    setTesting(true);
    try {
      const sent = await sendTestNotification();
      setPermissionState(await notificationPermissionStatus());
      if (sent) {
        toast.success('Notificação de teste enviada.');
      } else {
        toast.error('Não foi possível enviar a notificação de teste.');
      }
    } finally {
      setTesting(false);
    }
  };

  const masterDisabled = !preferences.enabled;
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
            onClick={toggleMaster}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${
              preferences.enabled ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
            aria-label="Ativar ou desativar notificações"
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

      <div className="space-y-4">
        <Section
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
            title="No fechamento"
            description="Avisa quando o horário programado termina."
            checked={preferences.shiftClose}
            onChange={() => toggle('shiftClose')}
            disabled={masterDisabled}
          />
        </Section>

        <Section
          icon={Bike}
          title="Rotas e iFood"
          subtitle="Avisos ligados ao fluxo real de entregas"
        >
          <ToggleRow
            title="Rota ainda aberta"
            description="Lembrete próximo ao fechamento quando existe rota iniciada."
            checked={preferences.routeOpenReminder}
            onChange={() => toggle('routeOpenReminder')}
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
            description="Leva direto para a Central filtrada pela rota."
            checked={preferences.ifoodPending}
            onChange={() => toggle('ifoodPending')}
            disabled={masterDisabled}
          />
        </Section>

        <Section
          icon={Box}
          title="Estoque e compras"
          subtitle="Alertas baseados em mudança real de saldo ou status"
        >
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
        </Section>

        <Section
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
        </Section>
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
    </div>
  );
}
