// app/entregas/details/page.tsx
'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  Bike,
  CheckCircle2,
  CheckCheck,
  PackageCheck,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Clock3,
  CreditCard,
  CupSoda,
  Copy,
  Edit3,
  ExternalLink,
  Globe2,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  QrCode,
  ShoppingBag,
  Smartphone,
  Store,
  UserRound,
  ShieldCheck,
  X,
} from 'lucide-react';
import { isSuperadminUid } from '@/lib/access/roles';
import { toast } from '@/lib/operational-toast';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAppStore } from '@/store/useAppStore';
import {
  fulfillmentLabel,
  getFulfillmentMode,
  isDeliveryFulfillment,
} from '@/lib/delivery-mode';
import { firstValidTimestamp, type TimestampLike } from '@/lib/reports/time';
import { routeStartedAt } from '@/lib/operational-time';
import { openDflAdmin as openDflAdminBridge } from '@/lib/native/admin-bridge';
import {
  deliveryChannel,
  deliveryChannelLabel,
  deliveryOrderNumber,
  deliveryReferenceLabel,
  formatBrazilianPhone,
  operationalAddressLabel,
  operationalMapsUrl,
  siteStatusLabel,
} from '@/lib/delivery-presentation';
import { siteIntegrationStages } from '@/lib/site-integration-health';
import { canMarkSitePickupReady, isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { canMarkManualPickupReady } from '@/lib/integration/site-order';
import { orderConfirmationCode } from '@/lib/operation/ifoodOrderCode';
import { kickManualPickup, manualPickupResultDescription } from '@/lib/integration/client/manualMessagingKick';
import { detailActionState } from '@/lib/operation/detail-action-state';
import { deriveDeliveryPaymentState } from '@/lib/delivery-finance';

const money = (value = 0) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dateTime = (...values: TimestampLike[]) => {
  const date = firstValidTimestamp(...values);

  return date
    ? date.toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Sao_Paulo',
      })
    : 'Não registrado';
};

function DeliveryDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const date = searchParams.get('date') || '';
  const deliveriesReturn = date ? `/entregas?date=${encodeURIComponent(date)}` : '/entregas';
  const dateSuffix = date ? `&date=${encodeURIComponent(date)}` : '';
  const delivery = useAppStore((state) => state.deliveries.find((item) => item.id === id));
  const route = useAppStore((state) =>
    state.routes.find((item) => item.id === delivery?.route_id),
  );
  const customer = useAppStore((state) =>
    state.customers.find((item) => item.id === delivery?.customer_id),
  );
  const isTrackingOwner = isSuperadminUid(useAppStore((state) => state.user?.uid));
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const ifoodPendingConfirmations = useAppStore(
    (state) => state.ifoodPendingConfirmations,
  );
  const [isCompleting, setIsCompleting] = useState(false);
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [confirmCardPaymentOpen, setConfirmCardPaymentOpen] = useState(false);
  const [confirmCardPaymentBusy, setConfirmCardPaymentBusy] = useState(false);
  const cardPaymentLock = useRef(false);
  const readyLock = useRef(false);
  const completionLock = useRef(false);
  const [openingAdmin, setOpeningAdmin] = useState(false);
  const [isIfoodModalOpen, setIsIfoodModalOpen] = useState(false);
  const [inputCode, setInputCode] = useState('');

  if (!delivery) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="text-amber-400" size={36} />
        <div>
          <h1 className="font-heading text-xl font-bold text-zinc-100">Pedido não encontrado</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Ele pode ter sido removido ou ainda não sincronizou.
          </p>
        </div>
        <button
          onClick={() => router.replace(deliveriesReturn)}
          className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-bold text-zinc-200"
        >
          Voltar aos pedidos
        </button>
      </div>
    );
  }

  const integrationStages = delivery.source_system === 'dfl_site'
    ? siteIntegrationStages(delivery, route)
    : [];

  const cancelled = isCancelledSiteDelivery(delivery);
  const name = customer?.name || delivery.customer_name || 'Cliente não informado';
  const phone = formatBrazilianPhone(delivery.phone || customer?.phone);
  const mode = getFulfillmentMode(delivery);
  const paymentConfirmed = deriveDeliveryPaymentState(delivery) === 'paid';
  const isCardPickup = mode === 'pickup' && ['cartao', 'cartao_credito', 'cartao_debito'].includes(delivery.payment_method);
  const logistics = isDeliveryFulfillment(delivery);
  const modeLabel = fulfillmentLabel(delivery);
  const ModeIcon = mode === 'pickup' || mode === 'external_delivery' ? ShoppingBag : mode === 'counter' ? Store : Bike;

  const mapsUrl = logistics ? operationalMapsUrl(delivery) : '';

  const customerCharge = delivery.customer_charge ?? delivery.value;
  const subsidy = delivery.ifood_subsidy || 0;

  const paymentIcon =
    delivery.payment_method === 'dinheiro'
      ? Banknote
      : delivery.payment_method === 'pix'
        ? QrCode
        : CreditCard;

  const PaymentIcon = paymentIcon;
  const isIfood = delivery.origin === 'ifood' || !delivery.origin;
  const channel = deliveryChannel(delivery);
  const visibleOrderNumber = deliveryOrderNumber(delivery);
  const visibleOrderReference = deliveryReferenceLabel(delivery);
  // O último código do cliente é histórico: nunca preenchê-lo em outra entrega.
  const savedConfirmationCode = orderConfirmationCode(delivery.confirmation_code);
  const normalizedIfoodId = (delivery.ifood_id || '').replace(/\D/g, '').slice(0, 8);
  const normalizedConfirmationCode = savedConfirmationCode;
  const externalPending = isIfood
    ? ifoodPendingConfirmations.find(
        (item) =>
          (item.status || 'pending') === 'pending' &&
          (item.delivery_id === delivery.id ||
            (normalizedIfoodId.length === 8 &&
              (item.ifood_id || '').replace(/\D/g, '').slice(0, 8) ===
                normalizedIfoodId)),
      )
    : undefined;
  const confirmationReturn =
    `/entregas/details?id=${encodeURIComponent(delivery.id)}${dateSuffix}`;
  const routeIsClosed = logistics && route?.status === 'fechada';
  const operationalStartedAt = route ? routeStartedAt(route) : '';
  const routeNotStarted =
    logistics && (!route || (route.status === 'aberta' && !operationalStartedAt));
  // R303: um CTA contextual, preservando as duas autoridades de prontidão.
  const sitePickup = delivery.source_system === 'dfl_site' && mode === 'pickup';
  const canSetReady = sitePickup ? canMarkSitePickupReady(delivery) : canMarkManualPickupReady(delivery);
  const actionState = detailActionState({
    pickup: mode === 'pickup', completed: delivery.completed === true, cancelled,
    ready: Boolean(delivery.pickup_ready_at), canMarkReady: canSetReady,
    logistics, routeAvailable: Boolean(route),
    routeStarted: Boolean(operationalStartedAt), routeClosed: Boolean(routeIsClosed),
  });

  // Feedback tátil nunca deve impedir persistência, confirmação ou navegação.
  const vibrate = async (style: ImpactStyle) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await Haptics.impact({ style });
    } catch {
      // Android sem haptics ou plugin indisponível: operação continua normalmente.
    }
  };

  const openDflAdmin = async () => {
    if (!delivery.external_order_id) {
      toast.error("Este pedido não possui vínculo com o DFL Admin.");
      return;
    }

    if (openingAdmin) return;
    setOpeningAdmin(true);
    try {
      await vibrate(ImpactStyle.Light);
      const result = await openDflAdminBridge(
        delivery.external_order_id,
        delivery.completed ? "concluidos" : "expedicao",
      );
      if (!result.opened) {
        toast.error(result.message || "Não foi possível abrir o DFL Admin.");
      } else if (result.target === "browser") {
        toast.info("DFL Admin não instalado. Abrindo no navegador.");
      }
    } finally {
      setOpeningAdmin(false);
    }
  };

  const openWhatsApp = () => {
    if (!phone) {
      toast.error('Este cliente não possui telefone cadastrado.');
      return;
    }

    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}`, '_blank');
  };

  const copyIfoodValue = async (value: string, label: string) => {
    if (!value) {
      toast.error(`${label} não informado.`);
      return;
    }

    try {
      await vibrate(ImpactStyle.Light);
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}.`);
    }
  };

  const openIfoodConfirmation = async () => {
    await vibrate(ImpactStyle.Medium);

    if (normalizedIfoodId.length === 8) {
      try {
        await navigator.clipboard.writeText(normalizedIfoodId);
      } catch {
        // Os dados permanecem visíveis e copiáveis na tela do portal.
      }
    }

    const pendingSuffix = externalPending
      ? `&pendingId=${encodeURIComponent(externalPending.id)}`
      : '';

    router.replace(
      `/confirmar?orderId=${encodeURIComponent(normalizedIfoodId)}&code=${encodeURIComponent(
        normalizedConfirmationCode,
      )}${pendingSuffix}&returnTo=${encodeURIComponent(confirmationReturn)}`,
    );
  };

  const markPickupReady = async () => {
    if (readyLock.current) return;
    if (delivery.source_system === 'dfl_site') {
      if (!canMarkSitePickupReady(delivery) || isMarkingReady) return;
    } else if (!canMarkManualPickupReady(delivery) || isMarkingReady) return;
    const manualPickup = canMarkManualPickupReady(delivery);
    readyLock.current = true;
    setIsMarkingReady(true);
    void vibrate(ImpactStyle.Light);
    try {
      await updateDelivery(delivery.id, { pickup_ready_at: new Date().toISOString() });
      if (manualPickup) {
        toast.success('Pronto para retirada registrado.');
        if (delivery.notify_whatsapp === true && delivery.manual_messaging_opt_in_v1 === true) {
          // R301: o produtor só consulta o documento após a escrita confirmada.
          void kickManualPickup(delivery.id, 'ready').then(messaging => {
            if (messaging.status === 'queued') toast.info('Aviso de retirada na fila.', {description:manualPickupResultDescription(messaging)});
            else if (messaging.status === 'off' || messaging.status === 'skipped') toast.info('Prontidão salva; aviso suprimido.', {description:manualPickupResultDescription(messaging)});
            else if (messaging.status === 'duplicate') toast.info('Aviso já reservado.', {description:manualPickupResultDescription(messaging)});
            else if (messaging.status === 'failed') toast.warning('Prontidão salva; aviso não confirmado.', {description:manualPickupResultDescription(messaging)});
          }).catch(() => toast.warning('Prontidão salva; status do aviso indisponível.'));
        }
      } else {
        toast.success('Prontidão registrada. O aviso ao cliente depende da sincronização com o Site.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao registrar prontidão.');
    } finally { readyLock.current = false; setIsMarkingReady(false); }
  };

  const executeCompletion = async (codeToSave?: string) => {
    if (cancelled || delivery.completed || isCompleting || completionLock.current) return;
    if (mode === 'pickup' && !delivery.pickup_ready_at) return;
    completionLock.current = true;
    setIsCompleting(true);
    const payload = {
      completed: true,
      ...(codeToSave ? { confirmation_code: codeToSave } : {}),
    };

    try {
      await updateDelivery(delivery.id, payload);
      // Após persistir, falha do plugin não pode ser tratada como falha da baixa.
      void vibrate(ImpactStyle.Medium);
      setIsIfoodModalOpen(false);
      setInputCode('');
      toast.success(
        mode === 'external_delivery'
          ? `Entrega parceira ${delivery.origin === 'keeta' ? 'Keeta' : delivery.origin === 'food99' ? '99Food' : delivery.origin === 'ifood' ? 'iFood' : ''} concluída.`
          : mode === 'pickup'
          ? 'Retirada concluída.'
          : mode === 'counter'
            ? 'Pedido de balcão concluído.'
            : 'Entrega concluída com sucesso.',
      );

      // R299 P5: conclusão persistida devolve à Home operacional e às rotas.
      // A confirmação financeira e a confirmação iFood seguem independentes.
      router.replace('/');
    } catch {
      void vibrate(ImpactStyle.Heavy);
      toast.error('Não foi possível concluir o pedido.', {
        description: 'O estado anterior foi restaurado. Tente novamente.',
      });
    } finally {
      completionLock.current = false;
      setIsCompleting(false);
    }
  };

  // Nunca inferir quitacao a partir de completed: o pagamento precisa de evidencia humana.
  const confirmCardPickupPayment = async () => {
    if (!isCardPickup || !delivery.completed || paymentConfirmed || cancelled || cardPaymentLock.current) return;
    cardPaymentLock.current = true;
    setConfirmCardPaymentBusy(true);
    try {
      await updateDelivery(delivery.id, { is_paid: true, payment_state: 'paid' });
      setConfirmCardPaymentOpen(false);
      toast.success('Pagamento em cartão confirmado e registrado.');
    } catch (error) {
      toast.error('Não foi possível confirmar o cartão.', {
        description: error instanceof Error ? error.message : 'Pagamento preservado para conferência.',
      });
    } finally {
      cardPaymentLock.current = false;
      setConfirmCardPaymentBusy(false);
    }
  };

  const handleCompletionAction = async () => {
    if (cancelled || isCompleting || completionLock.current) return;
    await vibrate(ImpactStyle.Light);

    if (delivery.completed) {
      if (routeIsClosed) {
        toast.error('Reabra a rota antes de desfazer esta baixa.', {
          description: 'Isso evita deixar uma rota fechada com entrega pendente.',
        });
        return;
      }

      completionLock.current = true;
      setIsCompleting(true);
      try {
        await updateDelivery(delivery.id, { completed: false });
        toast.success('Baixa desfeita.');
      } catch {
        toast.error('Não foi possível desfazer a baixa.');
      } finally {
        completionLock.current = false;
        setIsCompleting(false);
      }
      return;
    }

    if (mode === 'pickup' && !delivery.pickup_ready_at) {
      toast.info('Marque o pedido como pronto antes de confirmar a retirada.');
      return;
    }

    if (logistics) {
      if (!route) {
        toast.error('Esta entrega não possui uma rota válida.');
        return;
      }
      if (route.status === 'fechada') {
        toast.error('A rota está fechada. Reabra-a antes de dar baixa.');
        return;
      }
      if (!routeStartedAt(route)) {
        toast.error('Inicie a rota antes de dar baixa nesta entrega.');
        return;
      }
    }

    const skipsIfoodCode = delivery.payment_method === 'dinheiro' || delivery.payment_method?.includes('cartao');
    if (isIfood && !skipsIfoodCode && !savedConfirmationCode) {
      setInputCode('');
      setIsIfoodModalOpen(true);
      return;
    }

    await executeCompletion(savedConfirmationCode);
  };

  return (
    <div className="flex flex-col gap-5 pb-28 animate-in fade-in duration-300">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.replace(deliveriesReturn)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400"
        >
          <ChevronLeft size={21} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">
            Ficha do pedido
          </p>
          <h1 className="truncate font-heading text-xl font-bold text-zinc-50">{name}</h1>
        </div>

        <button
          disabled={cancelled}
          onClick={() => { if (!cancelled) router.push(`/entregas/editar?id=${delivery.id}${dateSuffix}`); }}
          className="flex h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs font-bold text-zinc-300 disabled:opacity-50"
        >
          <Edit3 size={15} />
          Editar
        </button>
      </header>

      {cancelled && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/[.06] p-4">
          <p className="font-black uppercase text-red-400">Pedido cancelado</p>
          <p className="mt-2 text-xs text-zinc-400">
            Registro histórico somente leitura. Valor operacional zerado.
            Edição, exclusão e conclusão bloqueadas.
          </p>
        </section>
      )}
      {isTrackingOwner && (
        <button type="button" onClick={() => router.push(`/mais/acompanhamento?id=${encodeURIComponent(delivery.id)}`)}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/[.045] px-4 text-left text-xs font-black text-cyan-200"
        >
          <span className="flex items-center gap-2"><ShieldCheck size={17}/> Acompanhamento · revisão interna</span>
          <ChevronRight size={16} className="text-cyan-300" />
        </button>
      )}
      {channel === 'site' && delivery.external_order_id && (
        <button type="button" onClick={() => void openDflAdmin()} disabled={openingAdmin} className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-sky-500/20 bg-sky-500/[0.07] px-4 py-3 text-left active:scale-[0.99] disabled:cursor-wait disabled:opacity-70">
          <span className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-[0.16em] text-sky-400">Ecossistema DFL</span><strong className="mt-1 block truncate text-sm text-zinc-100">{openingAdmin ? 'Abrindo DFL Admin…' : 'Abrir pedido no DFL Admin'}</strong></span>
          <ExternalLink size={18} className="shrink-0 text-sky-400" />
        </button>
      )}

      <section
        className={`rounded-[26px] border p-5 ${
          delivery.completed
            ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
            : 'border-amber-500/25 bg-amber-500/[0.05]'
        }`}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                channel === 'ifood'
                  ? 'bg-red-500/15 text-red-400'
                  : channel === 'food99'
                    ? 'bg-amber-400/15 text-amber-300'
                  : channel === 'keeta'
                    ? 'bg-violet-400/15 text-violet-300'
                  : channel === 'site'
                    ? 'bg-sky-500/15 text-sky-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {channel === 'ifood' ? <Smartphone /> : channel === 'food99' ? <ShoppingBag /> : channel === 'keeta' ? <ShoppingBag /> : channel === 'site' ? <Globe2 /> : <Store />}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-zinc-500">
                {deliveryChannelLabel(delivery)}
              </p>
              <p className="mt-0.5 truncate text-lg font-black text-zinc-100">
                {visibleOrderNumber ? visibleOrderReference : 'Referência comercial não informada'}
              </p>
            </div>
          </div>

          <span
            className={`max-w-[148px] rounded-full px-3 py-1 text-center text-[10px] font-black uppercase leading-snug ${
              delivery.completed
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {cancelled ? 'Cancelado' : delivery.completed ? 'Concluído' : mode === 'pickup' && delivery.pickup_ready_at ? 'Pronto' : logistics && operationalStartedAt ? 'Em rota' : channel === 'site' && logistics ? (route ? 'Aguardando saída' : 'Aguardando rota') : 'Pendente'}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
            <ModeIcon size={17} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
              Modalidade
            </p>
            <p className="mt-0.5 text-sm font-black text-zinc-100">{modeLabel}</p>
          </div>
        </div>

        {channel === 'site' && (
          <div className="mt-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3" aria-label="Preparo comercial informado pelo Site">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">Preparo no Site</span>
              <strong className="text-right text-sm font-black text-zinc-100">
                {delivery.site_order_status ? siteStatusLabel(delivery.site_order_status) : 'Aguardando sincronização'}
              </strong>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">Etapa comercial recebida do Site. Prontidão não significa saída da rota.</p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase text-zinc-500">Valor</p>
            <p className="text-xl font-black text-emerald-400">{cancelled ? money(0) : money(customerCharge)}</p>{cancelled && <p className="mt-1 text-xs text-zinc-500">Valor original: {money(customerCharge)}</p>}{!cancelled && subsidy > 0 && <p className="mt-1 text-[10px] text-zinc-500">Total econômico {money(delivery.value)} · iFood {money(subsidy)}</p>}
          </div>
          <div>
            <p className="text-[10px] uppercase text-zinc-500">Pagamento</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold capitalize text-zinc-200">
              <PaymentIcon size={15} />
              {paymentConfirmed ? 'Pagamento confirmado' : isCardPickup && delivery.completed ? 'Cartão · recebimento a conferir' : delivery.payment_method}
            </p>
          </div>
        </div>
      </section>

      {isCardPickup && delivery.completed && !paymentConfirmed && !cancelled && (
        <section className="rounded-[22px] border border-amber-500/25 bg-amber-500/[.06] p-4" aria-label="Conferência financeira da retirada">
          <p className="text-sm font-black text-amber-200">Retirada concluída · cartão a conferir</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">A entrega do pedido foi registrada, mas ainda falta confirmar que o valor entrou pela maquininha. A conclusão não quita a venda automaticamente.</p>
          <button type="button" disabled={confirmCardPaymentBusy} onClick={() => setConfirmCardPaymentOpen(true)} className="mt-3 min-h-11 w-full rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 text-xs font-black text-amber-200 disabled:opacity-45">Confirmar cartão recebido</button>
        </section>
      )}
      {confirmCardPaymentOpen && (
        <div role="dialog" aria-modal="true" aria-label="Confirmar pagamento da retirada" className="fixed inset-0 z-[180] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm" onClick={() => { if (!confirmCardPaymentBusy) setConfirmCardPaymentOpen(false); }}>
          <section className="w-full max-w-md rounded-[26px] border border-amber-500/25 bg-zinc-950 p-5 pb-[max(20px,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Conferência do cartão</p>
            <h3 className="mt-2 text-base font-black text-zinc-100">O pagamento foi recebido?</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">Confirme somente depois de verificar a aprovação na maquininha. A retirada já está concluída; esta ação registra apenas a quitação financeira.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={confirmCardPaymentBusy} onClick={() => setConfirmCardPaymentOpen(false)} className="h-12 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300 disabled:opacity-45">Cancelar</button>
              <button type="button" disabled={confirmCardPaymentBusy || paymentConfirmed} aria-busy={confirmCardPaymentBusy} onClick={() => void confirmCardPickupPayment()} className="h-12 rounded-xl bg-amber-500 px-2 text-xs font-black text-zinc-950 disabled:opacity-45">{confirmCardPaymentBusy ? 'Registrando…' : 'Sim, cartão recebido'}</button>
            </div>
          </section>
        </div>
      )}

      {channel === 'site' && (
        <section className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/[.035] p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-400">Integracao operacional</p><h2 className="mt-1 text-sm font-black text-zinc-100">Site → Entregas → Site</h2></div><span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[8px] font-black text-cyan-300">{delivery.completed ? 'CONCLUSAO REGISTRADA' : 'ACOMPANHADO'}</span></div>
          <div className="mt-4 space-y-2">{integrationStages.map((stage)=><div key={stage.key} className="flex items-center gap-3"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${stage.done ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 bg-zinc-950 text-zinc-700'}`}>{stage.done ? <CheckCircle2 size={14}/> : <Clock3 size={13}/>}</span><span className="min-w-0 flex-1"><b className={`block text-[10px] ${stage.done ? 'text-zinc-200' : 'text-zinc-600'}`}>{stage.label}</b><small className="block text-[8px] text-zinc-600">{stage.at ? dateTime(stage.at) : 'Ainda nao confirmado'}</small></span></div>)}</div>
        </section>
      )}

      <section className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
        <InfoRow icon={UserRound} label="Cliente" value={name} />
        <InfoRow icon={Phone} label="Contato" value={phone || 'Não informado'} />

        {logistics && (
          <InfoRow
            icon={MapPin}
            label="Endereço"
            value={operationalAddressLabel(delivery.address_string, customer?.neighborhood) || 'Não informado'}
          />
        )}

        {!logistics && (
          <InfoRow
            icon={ModeIcon}
            label="Fluxo"
            value={
              mode === 'pickup'
                ? 'Cliente retira o pedido na loja'
                : 'Atendimento presencial / balcão'
            }
          />
        )}

        {delivery.manual_order_items && delivery.origin === 'loja' && (
          <InfoRow icon={ShoppingBag} label="Itens deste pedido" value={delivery.manual_order_items} />
        )}
        {delivery.drinks && (
          <InfoRow icon={CupSoda} label="Bebidas" value={delivery.drinks} />
        )}

        {delivery.observation && (
          <InfoRow icon={AlertTriangle} label="Observações" value={delivery.observation} />
        )}
      </section>

      {isIfood && (
        <section className="rounded-[24px] border border-red-500/20 bg-red-500/[.045] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
                Confirmação iFood
              </p>
              <p className="mt-1 text-sm font-black text-zinc-100">
                {externalPending
                  ? 'Confirmação externa ainda pendente'
                  : delivery.completed
                    ? 'Sem pendência externa registrada'
                    : 'Dados prontos para o portal'}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-black ${
                normalizedIfoodId.length === 8
                  ? normalizedConfirmationCode.length === 4
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-amber-500/10 text-amber-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {normalizedIfoodId.length !== 8
                ? 'Falta ID'
                : normalizedConfirmationCode.length === 4
                  ? 'ID + código prontos'
                  : 'Código pendente'}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => copyIfoodValue(normalizedIfoodId, 'ID do pedido')}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-3 text-left active:scale-[0.99]"
            >
              <span className="text-[9px] font-black uppercase tracking-wide text-zinc-600">
                ID de 8 dígitos
              </span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <strong className="truncate font-mono text-sm text-zinc-100">
                  {normalizedIfoodId || 'Não informado'}
                </strong>
                <Copy size={14} className="shrink-0 text-sky-400" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => copyIfoodValue(normalizedConfirmationCode, 'Código do cliente')}
              className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-3 text-left active:scale-[0.99]"
            >
              <span className="text-[9px] font-black uppercase tracking-wide text-zinc-600">
                Código do cliente
              </span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <strong className="truncate font-mono text-sm text-amber-400">
                  {normalizedConfirmationCode || 'Pendente'}
                </strong>
                <Copy size={14} className="shrink-0 text-amber-400" />
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={openIfoodConfirmation}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-500 font-black text-white active:scale-[0.98]"
          >
            <ExternalLink size={16} />
            Abrir portal de confirmação
          </button>
        </section>
      )}

      <section className="rounded-[24px] border border-zinc-800 bg-zinc-900/45 p-4" aria-label="Ação operacional do pedido">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Próximo passo</p>
            <h2 className="mt-1 text-sm font-black text-zinc-100">
              {cancelled ? 'Pedido cancelado' : delivery.completed ? (mode === 'pickup' ? 'Retirada finalizada' : 'Atendimento finalizado') : mode === 'pickup' ? 'Retirada na loja' : 'Entrega operacional'}
            </h2>
          </div>
          {logistics && (
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${routeIsClosed ? 'bg-zinc-800 text-zinc-400' : routeNotStarted ? 'bg-amber-400/10 text-amber-200' : 'bg-sky-500/10 text-sky-300'}`}>
              {routeIsClosed ? 'Rota fechada' : routeNotStarted ? 'Rota não iniciada' : 'Em rota'}
            </span>
          )}
        </div>

        {actionState === 'pickup_prepare' && (
          <button type="button" onClick={markPickupReady}
            disabled={isMarkingReady || isCompleting} aria-busy={isMarkingReady}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 text-sm font-black text-zinc-950 shadow-sm shadow-amber-900/10 active:scale-[0.99] disabled:opacity-55">
            {isMarkingReady ? <Loader2 size={19} className="animate-spin" /> : <PackageCheck size={19} />}
            {isMarkingReady ? 'Registrando prontidão…' : 'Marcar pronto para retirada'}
          </button>
        )}

        {actionState === 'pickup_confirm' && (
          <>
            <p role="status" className="mb-3 flex items-center gap-2 text-xs font-medium text-sky-300">
              <PackageCheck size={15} /> Pronto para retirada · Aguardando cliente
            </p>
            <button type="button" onClick={handleCompletionAction}
              disabled={isCompleting || isMarkingReady} aria-busy={isCompleting}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 text-sm font-black text-white active:scale-[0.99] disabled:opacity-55">
              {isCompleting ? <Loader2 size={19} className="animate-spin" /> : <CheckCheck size={19} />}
              {isCompleting ? 'Confirmando retirada…' : 'Confirmar retirada pelo cliente'}
            </button>
          </>
        )}

        {(actionState === 'delivery_complete' || actionState === 'service_complete') && (
          <button type="button" onClick={handleCompletionAction} disabled={isCompleting || cancelled} aria-busy={isCompleting}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-4 text-sm font-black text-zinc-950 active:scale-[0.99] disabled:opacity-55">
            {isCompleting ? <Loader2 size={19} className="animate-spin" /> : <CheckCheck size={19} />}
            {isCompleting ? 'Registrando conclusão…' : mode === 'external_delivery' ? 'Confirmar entrega parceira' : mode === 'counter' ? 'Concluir atendimento de balcão' : 'Confirmar entrega ao cliente'}
          </button>
        )}

        {actionState === 'completed' && (
          <>
            <div role="status" className="flex items-center gap-3 rounded-2xl border border-zinc-700/70 bg-zinc-950/45 p-3.5">
              <CheckCircle2 size={21} className="shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="text-sm font-black text-zinc-100">{mode === 'pickup' ? 'Retirada concluída' : 'Pedido concluído'}</p>
                {Boolean(delivery.completed_at) && <p className="mt-1 text-xs text-zinc-500">{dateTime(delivery.completed_at)}</p>}
              </div>
            </div>
            <button type="button" onClick={handleCompletionAction} disabled={isCompleting || routeIsClosed}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-transparent text-xs font-semibold text-zinc-400 active:bg-zinc-800 disabled:opacity-40">
              {isCompleting ? 'Revertendo baixa…' : 'Desfazer baixa · ação secundária'}
            </button>
            {routeIsClosed && <p className="mt-2 text-center text-[11px] text-zinc-500">Reabra a rota para desfazer a baixa.</p>}
          </>
        )}

        {actionState === 'pickup_wait' && (
          <p role="status" className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3 text-xs text-zinc-400">
            A prontidão deste pedido não está disponível nesta etapa. Verifique o estado comercial no {sitePickup ? 'DFL Admin' : 'cadastro'}.
          </p>
        )}
        {actionState === 'route_blocked' && (
          <p role="status" className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-3 text-xs text-amber-200">
            {!route ? 'Esta entrega não está vinculada a uma rota válida.' : routeIsClosed ? 'Rota fechada. Reabra a rota antes de concluir.' : 'Inicie a rota para habilitar a conclusão.'}
          </p>
        )}
        {actionState === 'cancelled' && (
          <p role="status" className="rounded-2xl border border-zinc-800 bg-zinc-950/45 p-3 text-xs text-zinc-400">Cancelado · somente leitura, sem conclusão operacional.</p>
        )}
        {sitePickup && !delivery.completed && !cancelled && (
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">Pedido do Site · prontidão sincronizada pelo fluxo comercial existente. Não usa o produtor manual.</p>
        )}
      </section>

      <div className={`grid gap-3 ${logistics ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {logistics && (
          <button
            onClick={() => window.open(mapsUrl, '_blank')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/10 text-xs font-bold text-sky-200 active:scale-[0.99]"
          >
            <Navigation size={18} />
            Abrir Maps
          </button>
        )}

        <button
          onClick={openWhatsApp}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-300 active:scale-[0.99]"
        >
          <MessageCircle size={18} />
          WhatsApp
        </button>
      </div>

      <section className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
        {logistics && (
          <InfoRow
            icon={Bike}
            label="Rota"
            value={route ? `${route.name} • ${route.motoboy_name}` : 'Rota não encontrada'}
          />
        )}

        <InfoRow
          icon={Clock3}
          label={channel === 'site' ? 'Pedido recebido' : 'Criado em'}
          value={dateTime(delivery.created_at, delivery.createdAt)}
        />

        {channel === 'site' && delivery.site_order_timeline?.length ? (
          delivery.site_order_timeline.map((entry) => (
            <InfoRow key={entry.event_id} icon={Globe2} label={siteStatusLabel(entry.status)} value={dateTime(entry.occurred_at)} />
          ))
        ) : channel === 'site' && delivery.site_order_status ? (
          <InfoRow
            icon={Globe2}
            label={siteStatusLabel(delivery.site_order_status)}
            value={dateTime(delivery.site_order_status_updated_at, delivery.site_order_last_event_at)}
          />
        ) : null}

        {logistics && route && routeStartedAt(route) && (
          <InfoRow icon={Navigation} label="Saiu para entrega" value={dateTime(routeStartedAt(route))} />
        )}

        <InfoRow
          icon={CheckCircle2}
          label="Conclusão"
          value={cancelled ? 'Não aplicável — cancelado' : delivery.completed ? dateTime(delivery.completed_at) : 'Ainda pendente'}
        />

        {delivery.ifood_id && (
          <InfoRow
            icon={Smartphone}
            label="ID iFood"
            value={delivery.ifood_id}
          />
        )}

        {savedConfirmationCode ? (
          <InfoRow icon={ShieldCheck} label="Código deste pedido" value={savedConfirmationCode} />
        ) : isIfood ? (
          <InfoRow icon={AlertTriangle} label="Código deste pedido" value="Não informado — solicite ao cliente" />
        ) : null}
      </section>

      {isIfoodModalOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] border border-red-500/25 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="font-heading text-base font-black text-zinc-50">
                    Código iFood
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {delivery.order_id ? `Pedido #${delivery.order_id}` : 'Pedido iFood'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsIfoodModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-500 active:scale-95"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <label className="mt-5 block text-xs font-bold text-zinc-400">
              Digite os 4 dígitos informados pelo cliente
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              autoFocus
              placeholder="0000"
              value={inputCode}
              onChange={(event) => setInputCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
              className="mt-2 h-16 w-full rounded-2xl border-2 border-red-500/40 bg-zinc-950 px-4 text-center font-mono text-2xl font-black tracking-[0.25em] text-zinc-50 outline-none focus:border-red-500"
            />

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (inputCode.length !== 4) {
                    await vibrate(ImpactStyle.Heavy);
                    toast.error('Digite os 4 dígitos ou use a opção sem código.');
                    return;
                  }
                  await executeCompletion(inputCode);
                }}
                disabled={isCompleting}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950 active:scale-95 disabled:opacity-60"
              >
                <ShieldCheck size={18} />
                Concluir com código
              </button>
              <button
                type="button"
                onClick={() => executeCompletion()}
                disabled={isCompleting}
                className="h-12 rounded-2xl bg-zinc-800 font-bold text-zinc-300 active:scale-95 disabled:opacity-60"
              >
                Concluir sem código
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-zinc-800/80 p-4 last:border-0">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold leading-relaxed text-zinc-200">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function DeliveryDetailsPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center text-zinc-500">Carregando pedido...</div>}
    >
      <DeliveryDetailsContent />
    </Suspense>
  );
}
