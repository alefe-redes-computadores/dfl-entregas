'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banknote, CreditCard, QrCode, CupSoda, CheckCircle2, Pencil,
  Smartphone, Store, Globe2, Bike, UtensilsCrossed, Layers3, ArrowUp, ArrowDown, MapPin, ChevronDown, ShieldCheck, X, Maximize2, Minimize2, Navigation, MessageCircle, AlertTriangle, Copy, Crown, Map as MapIcon, CheckSquare, Trash2, LoaderCircle
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import clsx from 'clsx';
import type { Delivery, Customer, Route } from '@/types';
import { copyDeliveryToClipboard } from '@/lib/whatsapp';
import { MiniMap } from '@/components/deliveries/MiniMap';
import { LocationEvidencePreview } from '@/components/deliveries/LocationEvidencePreview';
import { locationEvidence } from '@/lib/location-evidence';
import { appendDeliveryAttempt, deliveryAttemptLabel, DELIVERY_ATTEMPT_REASONS } from '@/lib/delivery-attempts';
import type { DeliveryAttemptReason } from '@/lib/delivery-attempts';
import { buildNavigationLinks } from '@/lib/navigation-links';
import { useAppStore } from '@/store/useAppStore';
import { firstActionableCardIssue } from '@/lib/operation/operational-card-issues';
import { isCancelledSiteDelivery } from '@/lib/integration/site-order';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { dateKey, deliveryDate, routeStartedAt } from '@/lib/operational-time';
import { compactAddressForCard, hasHouseNumber } from "@/lib/operational-address";
import { auditOperationalAddress } from '@/lib/address-quality';
import { SiteOrderSnapshot } from '@/components/home/SiteOrderSnapshot';
import { customerRecurrence } from '@/lib/customer-recurrence';
import { isDeliveryExpanded } from '@/lib/delivery-expansion-index';
import { pendingOperationalStopDeliveries } from '@/lib/delivery-stop-pending';
import { deliveryPaymentStateLabel, deriveDeliveryPaymentState, deliveryCustomerCharge, deliveryEconomicValue } from '@/lib/delivery-finance';
import { summarizeStopFinance } from '@/lib/delivery-stop-finance';
import { orderConfirmationCode } from '@/lib/operation/ifoodOrderCode';
import { ownerContextLabel } from '@/lib/owner-order-context';
import { deliveryChannel } from '@/lib/delivery-presentation';
import { verifiedInternalCustomer } from '@/lib/internal-owner-identity';

interface DeliveryCardProps {
  delivery: Delivery & { is_expanded?: boolean };
  customer?: Customer;
  route: Route;
  isNeighbor?: boolean;
  position?: number;
  pendingCount?: number;
  neighborPosition?: number;
  neighborTotal?: number;
  stopDeliveries?: (Delivery & { is_expanded?: boolean })[];
}

const PAYMENT_CONFIG = {
  dinheiro: { label: 'Dinheiro', icon: Banknote, className: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  pix: { label: 'Pix', icon: QrCode, className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  cartao: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  cartao_credito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  cartao_debito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
} as const;

export function DeliveryCard({ delivery, customer, route, isNeighbor = false, position, pendingCount = 0, neighborPosition, neighborTotal, stopDeliveries }: DeliveryCardProps) {
  const router = useRouter();
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const deleteDelivery = useAppStore((state) => state.deleteDelivery);
  const moveDeliveryToIndex = useAppStore((state) => state.moveDeliveryToIndex);
  const toggleDeliveryExpansion = useAppStore((state) => state.toggleDeliveryExpansion);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const getDeliveriesByRoute = useAppStore((state) => state.getDeliveriesByRoute);
  const getCustomerById = useAppStore((state) => state.getCustomerById);
  const ifoodConfirmationMode = useAppStore((state) => (state.motoboys.find(item => item.id === route.motoboy_id) || state.motoboys.find(item => item.name === route.motoboy_name))?.ifood_confirmation_mode || 'store');
  const isExpanded = useAppStore((state) => isDeliveryExpanded(state.deliveries, delivery.id));
  const groupedDeliveries = stopDeliveries?.length ? stopDeliveries : [delivery];
  const navigationLinks = useMemo(() => buildNavigationLinks(delivery.address_string, delivery.maps_link), [delivery.address_string, delivery.maps_link]);
  const isGroupedStop = groupedDeliveries.length > 1;
  const groupedFinance = useMemo(() => summarizeStopFinance(groupedDeliveries), [stopDeliveries, delivery]);
  const groupedTotal = groupedFinance.economicTotal;
  const groupedPending = pendingOperationalStopDeliveries(groupedDeliveries).length;
  // O estado visual representa a parada física inteira, não só o pedido representante.
  const stopCompleted = isGroupedStop ? groupedPending === 0 : delivery.completed;
  const groupedPaymentRows = useMemo(() => {
    const toCollect: Delivery[] = [];
    const pixPending: Delivery[] = [];
    for (const item of groupedDeliveries) {
      const state = deriveDeliveryPaymentState(item);
      if (state === 'collect_on_delivery') toCollect.push(item);
      else if (state === 'pending') pixPending.push(item);
    }
    return {toCollect, pixPending};
  }, [stopDeliveries, delivery]);
  const groupedToCollect = groupedPaymentRows.toCollect;
  const groupedPixPending = groupedPaymentRows.pixPending;
  const groupedCollectValue = groupedFinance.collectTotal;
  const groupedCodes = groupedDeliveries.map((item) => orderConfirmationCode(item.confirmation_code));
  // O atalho coletivo só existe se TODOS os pedidos são iFood e possuem o MESMO
  // código válido. Um pedido sem código não pode herdar o do vizinho.
  const commonConfirmationCode = groupedDeliveries.length > 0 &&
    groupedDeliveries.every((item) => item.origin === 'ifood' && orderConfirmationCode(item.confirmation_code) === groupedCodes[0])
    ? groupedCodes[0] : '';

  // R78: uma parada aberta permanece assim até o operador minimizá-la.
  // Não redefinir is_expanded quando o cartão remonta ou muda a ordem.

  // Movimentar o cartão via ref evita renderizar ~1.000 linhas de JSX a cada pixel.
  const swipeSurfaceRef = useRef<HTMLDivElement | null>(null);
  const swipeOffsetRef = useRef(0);
  const swipeFrameRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (swipeFrameRef.current !== null) {
      window.cancelAnimationFrame(swipeFrameRef.current);
      swipeFrameRef.current = null;
    }
  }, []);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const reorderBusyRef = useRef(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [moveSheetOpen, setMoveSheetOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchCurrentX = useRef(0);
  const touchCurrentY = useRef(0);
  const swipeAxis = useRef<'pending' | 'horizontal' | 'vertical' | null>(null);
  const suppressCardClick = useRef(false);
  const completionBusyRef = useRef(false);
  const copyBusyRef = useRef(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [completionBusy, setCompletionBusy] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [attemptReason, setAttemptReason] = useState<DeliveryAttemptReason>('customer_absent');
  const [attemptTargetId, setAttemptTargetId] = useState(delivery.id);
  const [attemptNote, setAttemptNote] = useState('');
  const [attemptMoveLast, setAttemptMoveLast] = useState(false);
  const [attemptBusy, setAttemptBusy] = useState(false);
  const [isIfoodModalOpen, setIsIfoodModalOpen] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [groupedCodeDrafts, setGroupedCodeDrafts] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const impact = (style: ImpactStyle) => {
    if (!Capacitor.isNativePlatform()) return;
    // Feedback tátil nunca pode bloquear abertura de modal, baixa ou navegação.
    void Haptics.impact({ style }).catch(() => undefined);
  };

  const payment = PAYMENT_CONFIG[delivery.payment_method as keyof typeof PAYMENT_CONFIG] || PAYMENT_CONFIG.dinheiro;
  const PaymentIcon = payment.icon;
  const paymentState = deriveDeliveryPaymentState(delivery);
  const paymentStateLabel = deliveryPaymentStateLabel(delivery);
  const isIfood = delivery.origin === 'ifood' || !delivery.origin;
  const isSiteOrder = delivery.source_system === 'dfl_site';
  const visualOrigin = deliveryChannel(delivery);
  const mixedOrigins = isGroupedStop && groupedDeliveries.some(item => deliveryChannel(item) !== visualOrigin);
  const visualChannels = {
    ifood: { label: 'IFOOD', icon: UtensilsCrossed, rail: 'bg-red-500', shell: 'border-red-500/30 bg-red-500/10 text-red-400', badge: 'border-red-500/30 bg-red-500/[.10] text-red-300' },
    food99: { label: '99FOOD', icon: Bike, rail: 'bg-amber-400', shell: 'border-amber-400/30 bg-amber-400/10 text-amber-300', badge: 'border-amber-400/30 bg-amber-400/[.10] text-amber-200' },
    site: { label: 'SITE', icon: Globe2, rail: 'bg-sky-400', shell: 'border-sky-400/30 bg-sky-400/10 text-sky-300', badge: 'border-sky-400/30 bg-sky-400/[.10] text-sky-200' },
    store: { label: 'LOJA', icon: Store, rail: 'bg-emerald-400', shell: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300', badge: 'border-emerald-400/30 bg-emerald-400/[.10] text-emerald-200' },
    mixed: { label: 'MISTO', icon: Layers3, rail: 'bg-violet-400', shell: 'border-violet-400/30 bg-violet-400/10 text-violet-300', badge: 'border-violet-400/30 bg-violet-400/[.10] text-violet-200' },
  } as const;
  const channelStyle = mixedOrigins ? visualChannels.mixed : visualChannels[visualOrigin];
  const ChannelIcon = channelStyle.icon;
  const operationalContextLabel = ownerContextLabel(delivery) || (verifiedInternalCustomer(customer)?'DEV · Interno':null);
  const isDeveloperTest = delivery.developer_test === true || delivery.owner_order_context === 'owner_provisional';
  const isSiteAwaitingConfirmation = isSiteOrder && (delivery.site_order_status || '').trim().toLocaleLowerCase('pt-BR') === 'pendente';
  const isUrgent = groupedDeliveries.some((item) => item.is_urgent);
  const shortAddress = compactAddressForCard(delivery.address_string, customer?.address, customer?.neighborhood);
  const mapTarget = delivery.maps_link || customer?.maps_link || (shortAddress && shortAddress !== 'Endereço pendente' ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shortAddress)}` : '');
  const hasCoordinatesOrLink = !!(customer?.maps_link || delivery.maps_link);
  const hasStreetNumber = hasHouseNumber(shortAddress);
  const addressQuality = auditOperationalAddress(
    delivery.address_string || customer?.address,
    { fallbackNeighborhood: customer?.neighborhood },
  );
  const activePhone = delivery.phone || customer?.phone;
  // Links wa.me aceitam DDI, mas não devem duplicar o 55 já cadastrado.
  const whatsappDigits = (activePhone || '').replace(/\D/g, '');
  const normalizedWhatsappPhone = whatsappDigits.startsWith('55') && whatsappDigits.length >= 12
    ? whatsappDigits
    : whatsappDigits.length >= 10 && whatsappDigits.length <= 11
      ? `55${whatsappDigits}`
      : '';

  const cardIssue = useMemo(
    () => firstActionableCardIssue(groupedDeliveries, route.id, (id) => getCustomerById(id)?.address),
    [stopDeliveries, delivery, route.id, getCustomerById],
  );
  const isRecoveryRoute = route.id === 'rota-resgate-recuperada';
  const isAwaitingRoute = route.id === 'rota-aguardando-vinculo';
  const canDismissFromOperation =
    isAwaitingRoute &&
    !delivery.route_id &&
    !delivery.completed &&
    !delivery.operational_dismissed_at;
  const operationalDate = deliveryDate(delivery);
  const operationalDateKey = operationalDate ? dateKey(operationalDate) : '';
  const operationalDateQuery = operationalDateKey
    ? `&date=${encodeURIComponent(operationalDateKey)}`
    : '';
  const confirmationReturn = operationalDateKey
    ? `/confirmacoes?date=${encodeURIComponent(operationalDateKey)}`
    : '/confirmacoes';

  const triggerCopyAndRedirect = async (
    textToCopy: string,
    options: { offerIfoodPortal?: boolean } = {},
  ) => {
    if (!textToCopy) return;

    impact(ImpactStyle.Heavy);

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success('Copiado para a área de transferência!', { duration: 1400 });
    } catch {
      toast.error('Não foi possível copiar automaticamente.', {
        description: 'Toque novamente ou copie o valor manualmente.',
      });
      return;
    }

    const normalizedId = (delivery.ifood_id || '').replace(/\D/g, '').slice(0, 8);
    const copiedDigits = textToCopy.replace(/\D/g, '');

    void options; void normalizedId; void copiedDigits;
  };

  const handleTouchStartLongPress = (text: string, openPortal = false) => {
    longPressTimer.current = setTimeout(() => {
      if (!openPortal || !delivery.completed) return;
      const code = orderConfirmationCode(delivery.confirmation_code);
      const rawId = (delivery.ifood_id || '').replace(/\D/g, '');
      const orderId = rawId.length === 8 ? rawId : '';
      if (code.length !== 4 || orderId.length !== 8) return;
      void navigator.clipboard.writeText(code).catch(() => undefined);
      router.replace(`/confirmar?orderId=${encodeURIComponent(orderId)}&code=${encodeURIComponent(code)}&returnTo=${encodeURIComponent(confirmationReturn)}`);
    }, 5000);
  };

  const handleTouchEndLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const pendingGroupedDeliveries = pendingOperationalStopDeliveries(groupedDeliveries);
  const requiresConfirmationCode = (item: Delivery) => {
    const itemIsIfood = item.origin === 'ifood' || !item.origin;
    const skipsCode = item.payment_method === 'dinheiro' || item.payment_method?.includes('cartao');
    return itemIsIfood && !skipsCode;
  };
  const storedConfirmationCode = (item: Delivery) => orderConfirmationCode(item.confirmation_code);
  // Todo pedido iFood de uma parada física pode ter código próprio,
  // independentemente de Pix/cartão/dinheiro. Não herdar código do vizinho.
  const groupedCodeDeliveries = pendingGroupedDeliveries.filter((item) =>
    (item.origin === 'ifood' || !item.origin) && ifoodConfirmationMode !== 'motoboy');
  const groupedCodeMode = pendingGroupedDeliveries.length > 1;
  const lastAttempt = groupedDeliveries
    .flatMap(item => item.delivery_attempts || [])
    .sort((left, right) => left.at.localeCompare(right.at)).at(-1);

  const [skippedCodeIds, setSkippedCodeIds] = useState<string[]>([]);

  const closeConfirmationModal = () => {
    setIsIfoodModalOpen(false);
    setInputCode('');
    setGroupedCodeDrafts({});
    setSkippedCodeIds([]);
  };

  const copyStop = async () => {
    if (copyBusyRef.current) return;
    copyBusyRef.current = true;
    setCopyBusy(true);
    try {
      const copied = await copyDeliveryToClipboard(delivery, customer?.name, isIfood ? delivery.confirmation_code : customer?.last_confirmation_code, groupedDeliveries, typeof delivery.order_index === 'number' ? delivery.order_index + 1 : undefined, ifoodConfirmationMode);
      if (copied) toast.success('Entrega copiada!');
      else toast.error('Não foi possível copiar a entrega.', { description: 'Tente novamente. Nenhum pedido foi alterado.' });
    } finally {
      copyBusyRef.current = false;
      setCopyBusy(false);
    }
  };

  const copyIndividualOrder = async (item: Delivery, name?: string) => {
    if (copyBusyRef.current) return;
    copyBusyRef.current = true;
    setCopyBusy(true);
    try {
      const copied = await copyDeliveryToClipboard(
        item, name, item.origin === 'ifood' ? item.confirmation_code : undefined,
        [item], typeof item.order_index === 'number' ? item.order_index + 1 : undefined,
        ifoodConfirmationMode,
      );
      if (copied) toast.success('Pedido individual copiado!');
      else toast.error('Não foi possível copiar este pedido.');
    } catch {
      toast.error('Não foi possível copiar este pedido.');
    } finally {
      copyBusyRef.current = false;
      setCopyBusy(false);
    }
  };

  const executeCompletion = async (codeInput?: string | Record<string, string>) => {
    const targets = pendingOperationalStopDeliveries(groupedDeliveries);
    if (targets.length === 0 || completionBusyRef.current) return;
    completionBusyRef.current = true;
    setCompletionBusy(true);

    try {
      const failed: Delivery[] = [];
      const completedIds = new Set<string>();

      for (const item of targets) {
        const suppliedCode = typeof codeInput === 'string'
          ? (item.id === delivery.id ? codeInput : '')
          : codeInput?.[item.id];
        const codeToSave = orderConfirmationCode(suppliedCode || storedConfirmationCode(item));
        const updatePayload: Partial<Delivery> = { completed: true };
        if (codeToSave) updatePayload.confirmation_code = codeToSave;

        try {
          await updateDelivery(item.id, updatePayload);
          completedIds.add(item.id);
        } catch (error) {
          console.error(`Erro ao concluir entrega ${item.id}:`, error);
          failed.push(item);
        }
      }

      if (failed.length > 0) {
        const pendingLabels = failed.map((item) => {
          const itemCustomer = getCustomerById(item.customer_id);
          return itemCustomer?.name || item.customer_name || (item.order_id ? `#${item.order_id}` : 'pedido sem nome');
        });
        impact(ImpactStyle.Heavy);
        toast.error(`${failed.length} entrega${failed.length === 1 ? '' : 's'} ficou${failed.length === 1 ? '' : 'aram'} pendente${failed.length === 1 ? '' : 's'}.`, {
          description: pendingLabels.join(', '),
          duration: 4500,
        });
        return;
      }

      closeConfirmationModal();

      impact(ImpactStyle.Medium);
      toast.success(
        targets.length > 1 ? `${targets.length} entregas concluídas na parada.` : 'Entrega concluída.',
        { duration: 1800 },
      );

      const routeDeliveries = getDeliveriesByRoute(route.id);
      const remainingPending = routeDeliveries.filter((item) => !isCancelledSiteDelivery(item) && !completedIds.has(item.id) && !item.completed).length;
      if (remainingPending === 0) {
        toast.info('Última entrega salva. Conferindo fechamento seguro no servidor.', { duration: 2200 });
      }
    } catch (error) {
      console.error('Erro inesperado ao concluir parada:', error);
      impact(ImpactStyle.Heavy);
      toast.error('Não foi possível dar baixa na entrega.', {
        description: 'O estado anterior foi restaurado. Tente novamente.',
      });
    } finally {
      completionBusyRef.current = false;
      setCompletionBusy(false);
    }
  };

  const confirmDeleteDelivery = async () => {
    if (deleteBusy || delivery.completed) return;
    setDeleteBusy(true);
    try {
      await deleteDelivery(delivery.id);
      setDeleteOpen(false);
      impact(ImpactStyle.Medium);
      toast.success('Entrega excluída.', { description: 'A rota foi reconciliada e o cadastro do cliente foi preservado.' });
    } catch (error) {
      console.error('Erro ao excluir entrega:', error);
      toast.error('Não foi possível excluir a entrega.', { description: error instanceof Error ? error.message : 'A entrega foi preservada.' });
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleDismissFromOperation = async () => {
    if (!canDismissFromOperation) return;

    const reason = window.prompt(
      'Motivo para remover este pedido da operação:',
      'Pedido encerrado fora da operação',
    )?.trim();

    if (!reason) return;

    const confirmed = window.confirm(
      'Remover este pedido da fila operacional? O histórico comercial será preservado e ele NÃO será marcado como entregue.',
    );
    if (!confirmed) return;

    try {
      await updateDelivery(delivery.id, {
        operational_dismissed_at: new Date().toISOString(),
        operational_dismissal_reason: reason,
        operational_dismissal_source: 'manual',
        operational_completion_pending_route: false,
      });
      toast.success('Pedido removido da operação.', {
        description: 'Histórico preservado; nenhuma entrega foi registrada.',
      });
    } catch (error) {
      console.error('Erro ao remover pedido da operação:', error);
      toast.error('Não foi possível remover o pedido da operação.');
    }
  };

  async function handleTriggerAction(actionType: 'complete' | 'expand') {
    impact(ImpactStyle.Light);

    if (actionType === 'complete') {
      if (
        !delivery.completed &&
        addressQuality.needsReview
      ) {
        toast.warning(addressQuality.label || 'Confira o endereço', {
          description:
            addressQuality.description ||
            'Há dados de endereço que merecem revisão antes da baixa.',
          duration: 4200,
        });
      }

      if (isRecoveryRoute) {
        toast.error('Corrija a rota desta entrega antes de dar baixa.', {
          description:
            'Pedidos em recuperação precisam ser reassociados a uma rota real.',
        });
        return;
      }

      if (route.status === 'fechada') {
        toast.error(
          delivery.completed
            ? 'Reabra a rota antes de desfazer esta baixa.'
            : 'A rota está fechada. Reabra-a antes de dar baixa.',
        );
        return;
      }
      if (!routeStartedAt(route)) {
        toast.error('Inicie a rota antes de dar baixa!');
        return;
      }

      const newStatus = pendingGroupedDeliveries.length > 0 || !delivery.completed;
      if (!newStatus) {
        try {
          await updateDelivery(delivery.id, { completed: false });
          toast.success('Baixa desfeita.');
        } catch (error) {
          console.error('Erro ao desfazer baixa:', error);
          toast.error('Não foi possível desfazer a baixa.');
        }
        return;
      }

      const codeDeliveries = groupedCodeDeliveries;
      const needsGroupedCodeModal = pendingGroupedDeliveries.length > 1 && codeDeliveries.length > 0;
      const needsSingleCodeModal = codeDeliveries.length === 1 && !storedConfirmationCode(codeDeliveries[0]);
      if (needsGroupedCodeModal || needsSingleCodeModal) {
        const initialDrafts = Object.fromEntries(
          codeDeliveries.map((item) => [item.id, storedConfirmationCode(item)]),
        );
        setGroupedCodeDrafts(initialDrafts);
        setSkippedCodeIds([]);
        setInputCode(codeDeliveries.length === 1 ? initialDrafts[codeDeliveries[0].id] || '' : '');
        setIsIfoodModalOpen(true);
        return;
      }

      await executeCompletion(
        Object.fromEntries(codeDeliveries.map((item) => [item.id, storedConfirmationCode(item)])),
      );
    } else {
      // Abrir um cartão não recolhe outros. Somente o próprio operador
      // escolhe minimizar; pedidos de uma mesma parada continuam agrupados.
      toggleDeliveryExpansion(delivery.id, !isExpanded);
    }
  }

  const orderLocked = groupedDeliveries.some((item) => item.order_locked === true);
  const manualLocked = groupedDeliveries.some(
    (item) => item.order_locked === true && item.order_source !== 'smart',
  );
  const smartLocked = orderLocked && !manualLocked;
  const canManageStop =
    !isRecoveryRoute &&
    !isAwaitingRoute &&
    route.id !== 'rota-site-aguardando-confirmacao' &&
    route.status === 'aberta' && !delivery.completed;
  const canReorder = canManageStop && position !== undefined && pendingCount > 1 && !completionBusy;

  const toggleStopLock = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (reorderBusyRef.current) return;
    reorderBusyRef.current = true;
    setReorderBusy(true);
    try {
      const nextLocked = !orderLocked;
      const changedAt = new Date().toISOString();
      for (const item of groupedDeliveries) {
        await updateDelivery(item.id, {
          order_locked: nextLocked,
          order_source: 'manual',
          order_updated_at: changedAt,
        });
      }
      toast.success(nextLocked ? 'Parada fixada nesta posição.' : 'Parada destravada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a trava.');
    } finally {
      reorderBusyRef.current = false;
      setReorderBusy(false);
    }
  };

  const moveStop = async (targetIndex: number) => {
    if (!canReorder || reorderBusyRef.current) return;
    if (orderLocked) {
      toast.info('Destrave esta parada antes de mudar sua posição.');
      return;
    }
    const currentIndex = Math.max(0, (position || 1) - 1);
    const boundedTarget = Math.max(0, Math.min(targetIndex, pendingCount - 1));
    if (boundedTarget === currentIndex) {
      toast.info(targetIndex < currentIndex ? 'Esta parada já é a primeira.' : 'Esta parada já é a última.');
      return;
    }
    reorderBusyRef.current = true;
    setReorderBusy(true);
    try {
      await moveDeliveryToIndex(route.id, delivery.id, boundedTarget);
      impact(ImpactStyle.Light);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a nova posição.');
    } finally {
      reorderBusyRef.current = false;
      setReorderBusy(false);
    }
  };


  const saveAttempt = async () => {
    if (attemptBusy) return;
    setAttemptBusy(true);
    try {
      // Always use the current snapshot; never overwrite a newer local attempt.
      const current = useAppStore.getState().deliveries.find(item => item.id === attemptTargetId);
      if (!current || current.completed || route.status !== 'aberta' || !routeStartedAt(route) || !canManageStop || !pendingGroupedDeliveries.some(item => item.id === current.id)) {
        throw new Error('A tentativa só pode ser registrada para pedido pendente em rota iniciada.');
      }
      const attempt = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
        reason: attemptReason,
        at: new Date().toISOString(),
        note: attemptNote.trim(),
      };
      await updateDelivery(current.id, {
        delivery_attempts: appendDeliveryAttempt(current.delivery_attempts, attempt),
      });
      setAttemptOpen(false);
      setAttemptNote('');
      toast.success('Tentativa registrada; entrega continua pendente.', { description: deliveryAttemptLabel(attemptReason) });
      if (attemptMoveLast && canReorder && !orderLocked) {
        try { await moveStop(pendingCount - 1); }
        catch { toast.warning('Tentativa salva; não foi possível mover a parada.'); }
      }
      setAttemptMoveLast(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a tentativa.');
    } finally { setAttemptBusy(false); }
  };

  const resetCardSwipe = () => {
    if (swipeFrameRef.current !== null) {
      window.cancelAnimationFrame(swipeFrameRef.current);
      swipeFrameRef.current = null;
    }
    const element = swipeSurfaceRef.current;
    if (element) {
      element.style.transition = 'transform 180ms ease-out';
      element.style.transform = 'translate3d(0px,0,0)';
      element.style.willChange = 'auto';
    }
    swipeOffsetRef.current = 0;
    setSwipeDirection(null);
    setIsSwiping(false);
    touchStartX.current = 0;
    touchStartY.current = 0;
    touchCurrentX.current = 0;
    touchCurrentY.current = 0;
    swipeAxis.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || completionBusy || reorderBusyRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [data-no-card-swipe="true"]')) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchCurrentX.current = touch.clientX;
    touchCurrentY.current = touch.clientY;
    swipeAxis.current = 'pending';
    if (swipeSurfaceRef.current) swipeSurfaceRef.current.style.transition = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || swipeAxis.current === null || swipeAxis.current === 'vertical') return;
    const touch = e.touches[0];
    touchCurrentX.current = touch.clientX;
    touchCurrentY.current = touch.clientY;
    const dx = touchCurrentX.current - touchStartX.current;
    const dy = touchCurrentY.current - touchStartY.current;
    if (swipeAxis.current === 'pending') {
      if (Math.hypot(dx, dy) < 14) return;
      // Rolagem diagonal não pode acionar baixa nem expansão.
      if (Math.abs(dy) * 1.25 >= Math.abs(dx)) {
        swipeAxis.current = 'vertical';
        return;
      }
      swipeAxis.current = 'horizontal';
      if (swipeSurfaceRef.current) swipeSurfaceRef.current.style.willChange = 'transform';
      setIsSwiping(true);
    }
    if (swipeAxis.current !== 'horizontal') return;
    const offset = Math.max(-112, Math.min(112, dx * 0.82));
    swipeOffsetRef.current = offset;
    // Não escrever transform centenas de vezes num só frame em aparelhos Android.
    if (swipeFrameRef.current === null) {
      swipeFrameRef.current = window.requestAnimationFrame(() => {
        swipeFrameRef.current = null;
        if (swipeAxis.current === 'horizontal' && swipeSurfaceRef.current) {
          swipeSurfaceRef.current.style.transform = `translate3d(${swipeOffsetRef.current}px,0,0)`;
        }
      });
    }
    const direction = offset > 55 ? 'right' : offset < -55 ? 'left' : null;
    // Só dois possíveis re-renders durante o gesto: armar/desarmar a ação.
    setSwipeDirection((previous) => previous === direction ? previous : direction);
  };

  const handleTouchEnd = () => {
    if (swipeAxis.current !== 'horizontal') { resetCardSwipe(); return; }
    const dx = touchCurrentX.current - touchStartX.current;
    const dy = touchCurrentY.current - touchStartY.current;
    const wasComplete = groupedPending > 0;
    resetCardSwipe();
    suppressCardClick.current = true;
    window.setTimeout(() => { suppressCardClick.current = false; }, 300);
    if (Math.abs(dx) < 88 || Math.abs(dx) <= Math.abs(dy) * 1.5) return;
    if (dx < 0 && wasComplete) void handleTriggerAction('complete');
    if (dx > 0) void handleTriggerAction('expand');
  };

  const handleTouchCancel = () => resetCardSwipe();

  const isDraggingRight = swipeDirection === 'right';
  const isDraggingLeft = swipeDirection === 'left';

  return (
    <>
      <div data-dfl-route-id={route.id} data-dfl-stop-index={canReorder ? position : undefined} className={clsx(
          "relative overflow-hidden rounded-[18px] transition-colors duration-150",
          stopCompleted ? "opacity-80" : "shadow-sm",
          isUrgent && !stopCompleted && "shadow-[0_0_15px_rgba(239,68,68,0.15)] border border-red-500/40",
          isNeighbor && !stopCompleted && "border-amber-500/30",
          isExpanded
            ? "bg-zinc-900 border border-amber-500/35 shadow-[0_14px_34px_rgba(0,0,0,0.32)]"
            : stopCompleted
              ? "bg-zinc-900/24 border border-emerald-500/12"
              : "bg-zinc-900/35 border border-zinc-800/70"
        )}
      >
        <div aria-hidden="true" className={clsx('pointer-events-none absolute inset-y-1.5 left-0 z-20 w-[3px] rounded-full', channelStyle.rail)} />
        <div className={clsx(
          "absolute inset-0 flex items-center justify-between px-6 transition-colors duration-150",
          isDraggingRight ? "bg-sky-500/40" : isDraggingLeft ? "bg-emerald-500/50" : "bg-zinc-950"
        )}>
          <div className={clsx("flex items-center gap-2 font-bold transition-[opacity,color,transform] duration-150", isDraggingRight ? "opacity-100 text-sky-200 scale-110" : "opacity-40 text-zinc-400")}>
            {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            <span className="text-xs">{isExpanded ? 'Minimizar' : 'Expandir'}</span>
          </div>
          <div className={clsx("flex items-center gap-2 font-bold transition-[opacity,color,transform] duration-150", isDraggingLeft ? "opacity-100 text-emerald-200 scale-110" : "opacity-40 text-zinc-400")}>
            <span className="text-xs">{isRecoveryRoute ? 'Corrigir rota' : 'Dar Baixa'}</span>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div
          ref={swipeSurfaceRef}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (isExpanded || isSwiping || suppressCardClick.current || target.closest('button, a, input, textarea, select, [data-no-card-swipe="true"]')) return;
            void handleTriggerAction('expand');
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          style={{ touchAction: 'pan-y' }}
          className={clsx("relative z-10 flex w-full flex-col bg-zinc-900", !isSwiping && "transition-transform duration-200")}
        >
          <div className={clsx("flex flex-col", isExpanded ? "p-3 sm:p-3.5" : "px-2.5 py-2")}>
            <div className="flex items-start gap-3">
              <div className="relative mt-0.5 flex w-9 shrink-0 self-start flex-col items-center">
                <span className={clsx('flex shrink-0 items-center justify-center rounded-lg border', isExpanded ? 'h-9 w-9' : 'h-9 w-9', channelStyle.shell)}>
                  <ChannelIcon size={19} aria-hidden="true" />
                </span>
                {position !== undefined && (
                  <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 px-1 text-[9px] font-black text-zinc-200 shadow-lg">
                    {position}
                  </span>
                )}
                <span
                  aria-label={`Origem ${channelStyle.label}`}
                  className={clsx('mt-1.5 flex h-[65px] w-7 shrink-0 items-center justify-center rounded-lg border py-1 font-heading text-[9px] font-black uppercase tracking-[.10em]', channelStyle.badge)}
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {channelStyle.label}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex justify-between items-start">
                  <div className="flex min-w-0 max-w-[54%] flex-col items-start gap-1">
                    <p className="max-w-full break-words font-heading text-[13px] font-black leading-snug tracking-tight text-zinc-50 [overflow-wrap:anywhere]">
                      {isGroupedStop
                        ? groupedDeliveries.every(item => item.customer_id === delivery.customer_id)
                          ? `${customer?.name || delivery.customer_name || 'Cliente'} (${groupedDeliveries.length})`
                          : `${groupedDeliveries.length} pedidos nesta parada`
                        : customer?.name || delivery.customer_name || (isIfood ? 'Cliente iFood' : 'Sem Nome')}
                    </p>
                  {/* Linha dos Identificadores com Press & Hold */}
                  {(isGroupedStop || (visualOrigin === 'food99' && Boolean(delivery.order_id)) || isSiteAwaitingConfirmation || Boolean(operationalContextLabel) || (isIfood && Boolean(delivery.order_id || delivery.ifood_id || orderConfirmationCode(delivery.confirmation_code)))) && (
                  <div className="flex max-w-full flex-wrap items-center gap-1.5">
                    {!isGroupedStop && visualOrigin === 'food99' && delivery.order_id && <span className="rounded-md border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-300">#{delivery.order_id}</span>}
                    {isSiteAwaitingConfirmation && <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-300">Aguardando confirmação</span>}
                    {!isGroupedStop && operationalContextLabel && <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-black text-sky-300">{operationalContextLabel}</span>}
                    {isGroupedStop ? (
                      <span className="bg-violet-500/15 border border-violet-500/30 text-violet-300 px-2 py-0.5 rounded-md text-[10px] font-black shrink-0">
                        {groupedPending === 0 ? 'Todos concluídos' : `${groupedPending} pendente${groupedPending === 1 ? '' : 's'}`}
                      </span>
                    ) : isIfood && delivery.order_id ? (
                      <span className="bg-red-500/15 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0">
                        #{delivery.order_id}
                      </span>
                    ) : null}
                    {!isGroupedStop && isIfood && delivery.ifood_id && (
                      <button
                        onClick={() => triggerCopyAndRedirect(delivery.ifood_id!, { offerIfoodPortal: true })}
                        onTouchStart={() => handleTouchStartLongPress(delivery.ifood_id!, true)}
                        onTouchEnd={handleTouchEndLongPress}
                        className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 active:scale-95 text-zinc-300 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 flex items-center gap-1 transition-all"
                      >
                        ID: {delivery.ifood_id} <Copy size={9} className="text-sky-400"/>
                      </button>
                    )}
                    {!isGroupedStop && isIfood && orderConfirmationCode(delivery.confirmation_code) && (
                      <button
                        onClick={() => triggerCopyAndRedirect(orderConfirmationCode(delivery.confirmation_code))}
                        onTouchStart={() => handleTouchStartLongPress(delivery.confirmation_code || '')}
                        onTouchEnd={handleTouchEndLongPress}
                        className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 active:scale-95 text-amber-400 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 flex items-center gap-1 transition-all"
                      >
                        Cód: {orderConfirmationCode(delivery.confirmation_code)} <Copy size={9} />
                      </button>
                    )}
                  </div>
                  )}
                  </div>
                  <div className="min-w-0 max-w-[43%] shrink-0 flex flex-col items-end">
                    <span className="block text-right text-[9px] font-bold uppercase tracking-wide text-zinc-500">{isGroupedStop ? 'Valor dos pedidos' : 'Valor do pedido'}</span>
                    <p className="max-w-full break-words text-right text-[clamp(0.8rem,3.2vw,1rem)] font-black tabular-nums text-zinc-100 tracking-tight">
                      {isPrivacyMode ? 'R$ •••••' : `R$ ${(isGroupedStop ? groupedTotal : deliveryEconomicValue(delivery)).toFixed(2).replace('.', ',')}`}
                    </p>
                    {(isGroupedStop ? groupedFinance.hasDifferentCustomerCharge : Math.abs(deliveryEconomicValue(delivery) - deliveryCustomerCharge(delivery)) >= 0.005) && (
                      <span className="mt-0.5 block text-right text-[9px] font-semibold text-amber-300">Cliente paga: {isPrivacyMode ? 'R$ •••' : `R$ ${(isGroupedStop ? groupedFinance.customerTotal : deliveryCustomerCharge(delivery)).toFixed(2).replace('.', ',')}`}</span>
                    )}
                  </div>
                </div>

                {lastAttempt && (
                  <p className="mt-1 max-w-full break-words text-[10px] font-semibold text-amber-300" title="Tentativa não equivale a entrega concluída">
                    <AlertTriangle size={11} className="mr-1 inline" />Tentativa: {deliveryAttemptLabel(lastAttempt.reason)}
                  </p>
                )}


                {isGroupedStop && isExpanded && (
                  <div className="mt-2 rounded-xl border border-violet-500/20 bg-violet-500/[.04] p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-black uppercase tracking-[.12em] text-violet-300">Pedidos desta parada</span>
                      {commonConfirmationCode && (
                        <button type="button" data-no-card-swipe="true" onClick={(event) => { event.stopPropagation(); void triggerCopyAndRedirect(commonConfirmationCode); }} className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-mono text-[9px] font-black text-amber-300">
                          Cód. {commonConfirmationCode} <Copy size={8} className="inline" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {groupedDeliveries.map((item, index) => {
                        const itemCustomer = getCustomerById(item.customer_id);
                        const charge = deliveryCustomerCharge(item);
                        const itemCode = orderConfirmationCode(item.confirmation_code);
                        const itemPayment = deriveDeliveryPaymentState(item);
                        const paymentLabel = itemPayment === 'paid' ? 'Pago' : itemPayment === 'pending' ? 'Pix pendente' : item.payment_method === 'dinheiro' ? (item.change_for ? `Cobrar dinheiro · troco p/ ${isPrivacyMode ? 'R$ •••' : `R$ ${item.change_for.toFixed(2).replace('.', ',')}`}` : 'Cobrar dinheiro') : 'Cobrar cartão';
                        return (
                          <div key={item.id} className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/55 px-2.5 py-2">
                            <span className={clsx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-black", item.completed ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-300")}>{item.completed ? '✓' : index + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[10px] font-black text-zinc-200">
                                {itemCustomer?.name || item.customer_name || `Pedido ${index + 1}`}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-black text-zinc-200">#{item.order_id || '—'}</span>
                                {item.ifood_id && <span className="truncate font-mono text-[9px] text-zinc-500">ID {item.ifood_id}</span>}
                                {itemCode && <span className="font-mono text-[9px] text-amber-400">Cód {itemCode}</span>}
                              </div>
                              <p className="mt-0.5 truncate text-[9px] font-bold text-zinc-500">
                                {paymentLabel}
                                {item.drinks?.trim() ? ` · ${item.drinks.trim()}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-black text-emerald-400">{isPrivacyMode ? 'R$ •••' : `R$ ${charge.toFixed(2).replace('.', ',')}`}</span>
                            <button type="button" data-no-card-swipe="true" disabled={copyBusy} aria-label={`Copiar pedido individual de ${itemCustomer?.name || item.customer_name || 'cliente'}`} title="Copiar somente este pedido" onClick={(event)=>{event.stopPropagation();void copyIndividualOrder(item,itemCustomer?.name || item.customer_name);}} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-500/25 bg-emerald-500/[.07] text-emerald-300 disabled:opacity-35"><Copy size={13}/></button>
                            <Link href={`/entregas/editar?id=${item.id}${operationalDateQuery}`} onClick={(event) => event.stopPropagation()} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400" title="Editar este pedido">
                              <Pencil size={11} />
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                    <Link href={`/entregas/nova?sameStop=${encodeURIComponent(delivery.id)}${operationalDateQuery}`} onClick={(event) => event.stopPropagation()} className="mt-2 flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-violet-500/30 bg-violet-500/[.04] text-[9px] font-black uppercase tracking-wide text-violet-300">
                      + Adicionar pedido nesta parada
                    </Link>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate w-full">
                  <MapPin size={12} className="shrink-0 text-zinc-500" />
                  <span className="truncate">{shortAddress}</span>
                  {isUrgent && <span className="ml-1 rounded bg-red-500/20 text-red-400 text-[9px] px-1 font-bold uppercase">Urgente</span>}
                </div>

                {cardIssue && (
                  <div role="alert" aria-label="Pendência da parada" className="mt-2 flex min-w-0 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/[.07] px-2.5 py-2.5">
                    <AlertTriangle size={15} className="shrink-0 text-red-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-red-200">{cardIssue.label}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-zinc-400">{cardIssue.detail}</p>
                    </div>
                    <Link
                      data-no-card-swipe="true"
                      href={`/entregas/editar?id=${encodeURIComponent(cardIssue.deliveryId)}${operationalDateQuery}`}
                      onClick={(event) => { event.stopPropagation(); impact(ImpactStyle.Light); }}
                      aria-label={`Corrigir ${cardIssue.label.toLowerCase()} do pedido`}
                      className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-red-400/35 bg-red-500/15 px-2.5 text-[10px] font-black text-red-100 active:scale-[.98]"
                    >
                      <Pencil size={12} /> Corrigir
                    </Link>
                  </div>
                )}

                {!delivery.completed && !cardIssue && addressQuality.needsReview && (
                  <button
                    type="button"
                    data-no-card-swipe="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(
                        `/entregas/editar?id=${encodeURIComponent(delivery.id)}${operationalDateQuery}`,
                      );
                    }}
                    className="mt-1 flex w-fit max-w-full items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2 py-1 text-left text-[9px] font-black text-amber-300 active:scale-[0.98]"
                    title={addressQuality.description}
                  >
                    <AlertTriangle size={10} className="shrink-0" />
                    <span className="truncate">
                      {addressQuality.label || 'Revisar endereço'}
                    </span>
                  </button>
                )}

                {/* VISUALIZAÇÃO COMPACTA — operação em duas linhas, sem iframe/mapa */}
                {!isExpanded && (
                  <div className="mt-1.5 flex flex-col gap-1.5 border-t border-zinc-800/50 pt-1.5">
                    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                      {isGroupedStop ? (
                        groupedFinance.collectCount > 0
                          ? <span className="truncate rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">{groupedFinance.collectCount} cobrar · {isPrivacyMode ? 'R$ •••' : `R$ ${groupedCollectValue.toFixed(2).replace('.', ',')}`}</span>
                          : groupedFinance.pendingCount > 0
                            ? <span className="truncate rounded-md bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">{groupedFinance.pendingCount} Pix pendente</span>
                            : <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Pago</span>
                      ) : paymentState === 'paid' ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300"><CheckCircle2 size={11}/> Pago</span>
                      ) : (
                        <span className={clsx('inline-flex min-w-0 items-center gap-1 truncate rounded-md border px-2 py-0.5 text-[10px] font-bold', payment.className)}><PaymentIcon size={11} className="shrink-0"/>{paymentState === 'pending' ? 'Pix pendente' : payment.label === 'Dinheiro' ? 'Cobrar dinheiro' : 'Cobrar cartão'}</span>
                      )}
                      {!isGroupedStop && delivery.drinks && <span className="truncate text-[10px] text-sky-300"><CupSoda size={11} className="mr-1 inline"/>{delivery.drinks}</span>}
                      {isNeighbor && <span className="ml-auto shrink-0 text-[9px] font-bold text-sky-400">Vizinha {neighborPosition || 1}/{neighborTotal || 2}</span>}
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5" aria-label="Ações rápidas da parada">
                      {canManageStop && Boolean(routeStartedAt(route)) ? (
                        <button type="button" data-no-card-swipe="true" onClick={event=>{event.stopPropagation();void handleTriggerAction('complete');}} className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-1.5 text-[11px] font-black text-emerald-300"><CheckCircle2 size={14}/>Dar baixa</button>
                      ) : (
                        <button
                          type="button"
                          data-no-card-swipe="true"
                          onClick={event => { event.stopPropagation(); void copyStop(); }}
                          disabled={copyBusy}
                          aria-busy={copyBusy}
                          aria-label={copyBusy ? 'Copiando mensagem' : isGroupedStop ? 'Copiar mensagem da parada' : 'Copiar mensagem do pedido'}
                          className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[.065] px-2 text-[11px] font-black text-emerald-300 disabled:opacity-40 active:bg-emerald-500/15"
                        >
                          {copyBusy ? <LoaderCircle size={15} className="shrink-0 animate-spin" /> : <Copy size={15} className="shrink-0" />}
                          <span className="truncate">{copyBusy ? 'Copiando...' : isGroupedStop ? 'Copiar parada' : 'Copiar pedido'}</span>
                        </button>
                      )}
                      {canManageStop && Boolean(routeStartedAt(route)) && (
                        <button
                          type="button"
                          data-no-card-swipe="true"
                          onClick={event => { event.stopPropagation(); void copyStop(); }}
                          disabled={copyBusy}
                          aria-busy={copyBusy}
                          aria-label={copyBusy ? 'Copiando mensagem' : isGroupedStop ? 'Copiar mensagem da parada' : 'Copiar mensagem do pedido'}
                          title={isGroupedStop ? 'Copiar todos os pedidos desta parada' : 'Copiar mensagem deste pedido'}
                          className="grid h-10 w-9 shrink-0 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/[.065] text-emerald-300 disabled:opacity-40 active:bg-emerald-500/15"
                        >
                          {copyBusy ? <LoaderCircle size={15} className="animate-spin" /> : <Copy size={15} />}
                        </button>
                      )}
                      {normalizedWhatsappPhone && <a href={`https://wa.me/${normalizedWhatsappPhone}?text=${encodeURIComponent('Olá! Sou o entregador da Da Família Lanches e já cheguei com seu pedido. Estou no portão.')}`} target="_blank" rel="noreferrer" aria-label="Chamar cliente no WhatsApp" onClick={event=>event.stopPropagation()} className="grid h-10 w-9 shrink-0 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/[.05] text-emerald-300"><MessageCircle size={15}/></a>}
                      {canReorder && <div role="group" aria-label="Subir ou descer parada" className="flex shrink-0 items-center overflow-hidden rounded-xl border border-sky-500/25 bg-sky-500/[.05]">
                        <button type="button" aria-label="Mover uma posição para cima" disabled={reorderBusy || orderLocked || (position || 1) <= 1} onClick={event=>{event.stopPropagation();void moveStop(Math.max(0,(position||1)-2));}} className="grid h-10 w-8 place-items-center text-sky-200 disabled:opacity-30"><ArrowUp size={14}/></button>
                        <button type="button" aria-label="Mover uma posição para baixo" disabled={reorderBusy || orderLocked || (position || 1) >= pendingCount} onClick={event=>{event.stopPropagation();void moveStop(position||1);}} className="grid h-10 w-8 place-items-center text-sky-200 disabled:opacity-30"><ArrowDown size={14}/></button>
                      </div>}
                      <button type="button" data-no-card-swipe="true" onClick={event=>{event.stopPropagation();toggleDeliveryExpansion(delivery.id,true);}} aria-label="Expandir detalhes da parada" className="grid h-10 w-9 shrink-0 place-items-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300"><Maximize2 size={15}/></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

                           {/* R124-R5-COMPACT: cosmetic-only; JSX hierarchy and handlers preserved */}
{/* VISUALIZAÇÃO EXPANDIDA */}
          {isExpanded && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="px-3 pb-2.5 flex flex-col gap-2">
                <div className="rounded-xl border border-zinc-800/65 bg-zinc-950/25 px-3 py-2" aria-label="Resumo da parada">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[.12em] text-zinc-500">Detalhes da parada</span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button type="button" data-no-card-swipe="true" onClick={(event)=>{event.stopPropagation();toggleDeliveryExpansion(delivery.id,false);}} aria-label="Minimizar esta parada" className="flex min-h-9 items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[10px] font-black text-zinc-200"><Minimize2 size={13}/>Minimizar</button>
                      <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${stopCompleted ? 'bg-emerald-500/10 text-emerald-300' : 'bg-sky-500/10 text-sky-300'}`}>{stopCompleted ? 'Concluída' : isGroupedStop ? `${groupedPending} pedidos pendentes` : 'Pendente'}</span>
                    </div>
                  </div>
                  {canManageStop && <details className="mt-2 rounded-xl border border-zinc-800/60 bg-zinc-950/25 px-2.5 py-1">
                    <summary className="flex min-h-9 cursor-pointer items-center justify-between gap-2 text-[11px] font-black text-sky-300"><span>Ajustar ordem {position ? `· parada ${position}` : ''}</span><ChevronDown size={15}/></summary>
                    <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Organizar parada expandida">
                      {canManageStop && <button type="button" onClick={(event)=>void toggleStopLock(event)} disabled={reorderBusy} className={`rounded-lg border px-2 py-1 text-[10px] font-black ${orderLocked ? 'border-amber-500/35 bg-amber-500/10 text-amber-300' : 'border-zinc-700 bg-zinc-900 text-zinc-300'}`}>{orderLocked ? 'Destravar' : 'Fixar'}</button>}
                    <span className="mr-auto text-[10px] font-semibold text-zinc-400">{orderLocked ? 'Parada fixada · destrave para mover' : canReorder ? `Parada ${position} de ${pendingCount}` : 'Sequência de parada'}</span>
                    {canReorder && <div className="flex items-center overflow-hidden rounded-xl border border-sky-500/25 bg-sky-500/[.05]" role="group" aria-label="Mover parada expandida">
                      <button type="button" data-no-card-swipe="true" aria-label="Subir parada expandida" title="Subir uma parada" disabled={reorderBusy || orderLocked || (position || 1) <= 1} onClick={(event)=>{event.stopPropagation();void moveStop(Math.max(0,(position||1)-2));}} className="grid h-10 w-10 place-items-center text-sky-200 disabled:opacity-35"><ArrowUp size={15}/></button>
                      <span className="h-4 w-px bg-sky-500/20"/>
                      <button type="button" data-no-card-swipe="true" aria-label="Descer parada expandida" title="Descer uma parada" disabled={reorderBusy || orderLocked || (position || 1) >= pendingCount} onClick={(event)=>{event.stopPropagation();void moveStop(position||1);}} className="grid h-10 w-10 place-items-center text-sky-200 disabled:opacity-35"><ArrowDown size={15}/></button>
                    </div>}
                    {canReorder && <button type="button" data-no-card-swipe="true" onClick={(event)=>{event.stopPropagation();setMoveSheetOpen(true);}} className="min-h-10 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-[11px] font-bold text-zinc-200">Mover para…</button>}
                    {canReorder && <button type="button" data-no-card-swipe="true" disabled={reorderBusy || orderLocked || (position || 1) <= 1} onClick={(event)=>{event.stopPropagation();void moveStop(0);}} className="min-h-10 rounded-xl border border-emerald-500/25 bg-emerald-500/[.07] px-3 text-[11px] font-black text-emerald-300 disabled:opacity-35">Ir primeiro</button>}
                    {canReorder && <button type="button" data-no-card-swipe="true" disabled={reorderBusy || orderLocked || (position || 1) >= pendingCount} onClick={(event)=>{event.stopPropagation();void moveStop(pendingCount-1);}} className="min-h-10 rounded-xl border border-amber-500/25 bg-amber-500/[.06] px-3 text-[11px] font-black text-amber-300 disabled:opacity-35">Deixar por último</button>}
                  </div></details>}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    {!delivery.completed && groupedCodeDeliveries.length > 0 && <span className="rounded-lg bg-amber-500/10 px-2 py-1 font-bold text-amber-300">{groupedCodeDeliveries.length} código{groupedCodeDeliveries.length===1?'':'s'} para conferir</span>}
                    {activePhone && <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-300">Contato disponível</span>}
                  </div>
                </div>
                {(stopCompleted || route.status === 'fechada') && (
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[.04] px-3 py-2 text-[10px] font-semibold text-emerald-300">
                    {stopCompleted ? 'Parada concluída · reordenação indisponível' : 'Rota fechada · ordem preservada'}
                  </div>
                )}
                <section className="rounded-xl border border-sky-500/20 bg-sky-500/[.045] px-3 py-2.5" aria-label="Próxima ação operacional">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-300"><CheckSquare size={16}/></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-[.14em] text-sky-300">Próximo passo</p>
                      <p className="mt-1 text-[12px] font-black leading-snug text-zinc-100">{
                        stopCompleted ? 'Entrega concluída — confira o histórico' :
                        cardIssue ? cardIssue.label :
                        groupedCodeDeliveries.some(item=>!orderConfirmationCode(item.confirmation_code)) ? 'Solicitar código iFood do pedido pendente' :
                        groupedToCollect.length > 0 ? 'Receber o pagamento na entrega' :
                        groupedPixPending.length > 0 ? 'Conferir se o Pix foi recebido' :
                        !routeStartedAt(route) ? 'Aguardar início da rota' : 'Entregar e registrar a baixa'
                      }</p>
                      {isGroupedStop && <p className="mt-1 text-[10px] text-zinc-400">{groupedPending} pendente{groupedPending === 1 ? '' : 's'} · {groupedDeliveries.length} pedidos no mesmo endereço</p>}
                    </div>
                  </div>
                </section>
                <div className="flex items-center gap-2 pl-1 flex-wrap">
                  {hasCoordinatesOrLink ? (
                    <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                      <Navigation size={10} /> {locationEvidence(delivery.address_string, delivery.maps_link).title}
                    </span>
                  ) : !hasStreetNumber ? (
                    <span className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                      Sem número residencial
                    </span>
                  ) : null}
                </div>

                <div className="mt-1">
                  {navigationLinks && <div className="mb-1.5 grid min-w-0 grid-cols-2 gap-1.5" aria-label="Navegação sem abrir o mapa">
                    <a href={navigationLinks.maps} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-sky-500/25 bg-sky-500/[.08] px-2 text-[11px] font-black text-sky-200"><Navigation size={13} className="mr-1"/> Navegar com Maps</a>
                    <a href={navigationLinks.waze} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/[.08] px-2 text-[11px] font-black text-violet-200"><Navigation size={13} className="mr-1"/> Navegar com Waze</a>
                  </div>}

                  <button
                    type="button"
                    data-no-card-swipe="true"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMapOpen((value) => !value);
                    }}
                    className="flex h-9 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/45 px-3 text-[10px] font-black text-zinc-400 active:bg-zinc-800"
                  >
                    <MapIcon size={13} className="text-sky-400" />
                    {mapOpen ? 'Ocultar mapa' : 'Mapa da parada'}
                  </button>

                  {mapOpen && (
                    <div className="mt-2">
                      <MiniMap
                        address={delivery.address_string}
                        mapsLink={delivery.maps_link}
                      />

                    </div>
                  )}
                </div>
              </div>

              {canDismissFromOperation && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void handleDismissFromOperation();
          }}
          className="mt-2 w-full rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition active:scale-[0.99]"
        >
          Remover da operação
        </button>
      )}

              <details className="mx-3 mb-3 rounded-2xl border border-zinc-800/85 bg-zinc-950/40 px-3 py-2.5">
                <summary className="cursor-pointer text-[11px] font-semibold text-zinc-300">Histórico e localização</summary>
                <div className="mt-3 space-y-2">
      <SiteOrderSnapshot delivery={delivery} privacy={isPrivacyMode} />
              <details className="mx-3 mb-2 rounded-xl border border-sky-500/15 bg-sky-500/[.035] p-2.5 text-[11px] text-zinc-300">
                <summary className="cursor-pointer font-semibold text-sky-300">Mais sobre a localização</summary>
                <div className="mt-2"><LocationEvidencePreview address={delivery.address_string} mapsLink={delivery.maps_link} compact /></div>
              </details>
              {isExpanded && !isGroupedStop && <RecurrenceDetails delivery={delivery} />}

                </div>
              </details>
              {delivery.observation && (
                <div className="mx-3 mb-2 rounded-xl bg-amber-500/5 border border-amber-500/15 px-3 py-2">
                  <p className="text-xs text-zinc-300">
                    <span className="font-bold text-amber-500">OBS: </span>
                    {delivery.observation}
                  </p>
                </div>
              )}

              <div className={clsx(
                "mx-3 mb-3 flex flex-col border border-zinc-800/70 bg-zinc-950/45",
                isExpanded ? "gap-2.5 rounded-[18px] px-3 py-3" : "gap-2 rounded-[16px] px-3 py-2.5",
                delivery.completed && !isExpanded && "bg-emerald-500/[.025] border-emerald-500/10"
              )}>
                <p className="text-[9px] font-black uppercase tracking-[.15em] text-zinc-500">Pagamento e finalização</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {paymentState === 'paid' ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500">
                      <CheckCircle2 size={14} /> Pago
                    </span>
                  ) : (
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${payment.className}`}>
                      <PaymentIcon size={14} />
                      {payment.label === 'Dinheiro' && delivery.change_for
                        ? `Troco p/ R$ ${isPrivacyMode ? '•••••' : delivery.change_for.toFixed(2).replace('.', ',')}`
                        : paymentStateLabel}
                    </span>
                  )}
                  {delivery.drinks && (
                    <span className="flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 font-bold">
                      <CupSoda size={14} className="text-sky-400"/> {delivery.drinks}
                    </span>
                  )}
                </div>

                {canManageStop && Boolean(routeStartedAt(route)) && (
                  <button type="button" data-no-card-swipe="true" onClick={(event) => {
                    event.stopPropagation();
                    setAttemptTargetId(pendingGroupedDeliveries[0]?.id || delivery.id);
                    setAttemptReason('customer_absent');
                    setAttemptMoveLast(false);
                    setAttemptNote('');
                    setAttemptOpen(true);
                  }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[.07] px-3 text-[11px] font-black text-amber-200 active:bg-amber-500/15">
                    <AlertTriangle size={14} /> Registrar tentativa (sem dar baixa)
                  </button>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => handleTriggerAction('complete')}
                    disabled={isRecoveryRoute}
                    className={clsx(
                      "flex-1 flex h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-black transition-all active:scale-95 shadow-lg disabled:active:scale-100",
                      isRecoveryRoute
                        ? "cursor-not-allowed border border-amber-500/20 bg-amber-500/[.06] text-amber-300 shadow-none"
                        : delivery.completed
                          ? "bg-zinc-800 text-zinc-400 border border-zinc-700 shadow-none"
                          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-emerald-500/5"
                    )}
                  >
                    <CheckCircle2 size={16} />
                    {isRecoveryRoute
                      ? 'Corrigir rota primeiro'
                      : delivery.completed
                        ? 'Desfazer Baixa'
                        : isGroupedStop
                          ? `Dar baixa no próximo (${groupedPending})`
                          : 'Dar Baixa'}
                  </button>

                  {normalizedWhatsappPhone && (
                    <a
                      href={`https://wa.me/${normalizedWhatsappPhone}?text=${encodeURIComponent('Olá! Sou o entregador da Da Família Lanches e já cheguei com seu pedido. Estou no portão.')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 active:scale-90 transition-all"
                      title="Chamar cliente no WhatsApp"
                      aria-label="Chamar cliente no WhatsApp"
                    >
                      <MessageCircle size={18} />
                    </a>
                  )}

                  <Link
                    href={`/entregas/editar?id=${delivery.id}${operationalDateQuery}`}
                    onClick={() => impact(ImpactStyle.Light)}
                    aria-label="Editar entrega"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 active:scale-90 transition-all"
                  >
                    <Pencil size={16} />
                  </Link>

                  <button
                    type="button"
                    data-no-card-swipe="true"
                    onClick={(event) => { event.stopPropagation(); void copyStop(); }}
                    disabled={copyBusy}
                    aria-busy={copyBusy}
                    aria-label={copyBusy ? "Copiando mensagem da entrega" : "Copiar mensagem da entrega"}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/[.08] text-emerald-300 active:scale-90 transition-all"
                  >
                    {copyBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Copy size={16} strokeWidth={2.5} />}
                  </button>

                  {!delivery.completed && !isRecoveryRoute && (
                    <button type="button" data-no-card-swipe="true" onClick={(event) => { event.stopPropagation(); impact(ImpactStyle.Light); setDeleteOpen(true); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 active:scale-90 transition-all" aria-label="Excluir entrega" title="Excluir entrega">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {attemptOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/80 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-10 backdrop-blur-sm sm:items-center" onClick={() => { if (!attemptBusy) setAttemptOpen(false); }} role="presentation">
          <section role="dialog" aria-modal="true" aria-label="Registrar tentativa de entrega" className="max-h-[88dvh] w-full max-w-sm overflow-y-auto rounded-[24px] border border-amber-500/25 bg-zinc-950 p-4 shadow-2xl" onClick={event => event.stopPropagation()}>
            <h3 className="text-base font-black text-zinc-100">Registrar tentativa</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">A entrega permanece pendente. Não registra confirmação, pagamento ou conclusão.</p>
            {pendingGroupedDeliveries.length > 1 && <label className="mt-4 block text-[11px] font-bold text-zinc-300">Pedido desta parada
              <select value={attemptTargetId} onChange={event => setAttemptTargetId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100">
                {pendingGroupedDeliveries.map(item => <option key={item.id} value={item.id}>{item.customer_name || getCustomerById(item.customer_id)?.name || item.order_id || item.id}{item.order_id ? ` · #${item.order_id}` : ''}</option>)}
              </select>
            </label>}
            <label className="mt-4 block text-[11px] font-bold text-zinc-300">Motivo
              <select value={attemptReason} onChange={event => setAttemptReason(event.target.value as DeliveryAttemptReason)} className="mt-1 h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100">
                {DELIVERY_ATTEMPT_REASONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-[11px] font-bold text-zinc-300">Observação (opcional)
              <textarea rows={3} maxLength={240} value={attemptNote} onChange={event => setAttemptNote(event.target.value)} placeholder="Ex.: interfone sem resposta; combinar nova tentativa" className="mt-1 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-100 outline-none focus:border-amber-500" />
            </label>
            {canReorder && !orderLocked && <label className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 text-[11px] text-zinc-300">
              <input type="checkbox" checked={attemptMoveLast} onChange={event => setAttemptMoveLast(event.target.checked)} className="h-4 w-4 accent-amber-400" /> Deixar esta parada por último
            </label>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={attemptBusy} onClick={() => setAttemptOpen(false)} className="h-11 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-300 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={attemptBusy} onClick={() => void saveAttempt()} className="h-11 rounded-xl bg-amber-400 text-xs font-black text-zinc-950 disabled:opacity-50">{attemptBusy ? 'Salvando…' : 'Registrar'}</button>
            </div>
          </section>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-[140] flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onClick={() => { if (!deleteBusy) setDeleteOpen(false); }} role="presentation">
          <section className="w-full max-w-sm rounded-[28px] border border-red-500/20 bg-zinc-950 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400"><Trash2 size={19} /></div>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.16em] text-red-400">Excluir entrega</p>
            <h3 className="mt-1 font-heading text-lg font-black text-zinc-100">Remover {customer?.name || delivery.customer_name || 'esta entrega'}?</h3>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">A entrega será removida da operação. O cadastro do cliente não será apagado. Entregas concluídas continuam protegidas e exigem desfazer a baixa primeiro.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={deleteBusy} onClick={() => setDeleteOpen(false)} className="h-12 rounded-xl border border-zinc-800 bg-zinc-900 text-sm font-bold text-zinc-400 disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={deleteBusy} onClick={() => void confirmDeleteDelivery()} className="h-12 rounded-xl bg-red-500 text-sm font-black text-white disabled:opacity-50">{deleteBusy ? 'Excluindo...' : 'Excluir'}</button>
            </div>
          </section>
        </div>
      )}

      {moveSheetOpen && (
        <div className="fixed inset-0 z-[125] flex items-end justify-center bg-black/75" onClick={() => setMoveSheetOpen(false)}>
          <div className="w-full max-w-lg rounded-t-[24px] border border-zinc-700 bg-[#171717] p-4 pb-[max(18px,env(safe-area-inset-bottom))] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-black text-zinc-100">Mover / Fixar parada</p><p className="text-[11px] text-zinc-400">{position || 1}ª posição · {groupedDeliveries.length} pedido(s)</p></div><button type="button" className="rounded-xl border border-zinc-700 p-2 text-zinc-300" onClick={() => setMoveSheetOpen(false)}><X size={18}/></button></div>
            <button type="button" className="mb-3 w-full rounded-xl border border-amber-500/25 bg-amber-500/[.06] p-3 text-left text-xs font-bold text-amber-200" disabled={reorderBusy} onClick={(event) => {void toggleStopLock(event);}}>{orderLocked ? 'Destravar esta posição' : 'Fixar esta posição'}</button>
            <div className="grid grid-cols-3 gap-2">
              {([['Primeira',0],['Subir',Math.max(0,(position || 1)-2)],['Descer',position || 1]] as const).map(([label,target]) => <button key={label} type="button" disabled={!canReorder || reorderBusy || orderLocked} onClick={() => {void moveStop(target).then(() => setMoveSheetOpen(false));}} className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-2 text-[11px] font-bold text-zinc-100 disabled:opacity-30">{label}</button>)}
            </div>
            <p className="mt-3 text-[10px] text-zinc-500">Paradas fixadas permanecem na posição. Destrave para movê-las.</p>
          </div>
        </div>
      )}
      {/* Código iFood — captura operacional compacta */}
      {isIfoodModalOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end bg-black/70 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-16 backdrop-blur-sm animate-in fade-in duration-150 sm:items-center sm:justify-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !completionBusy) {
              closeConfirmationModal();
            }
          }}
        >
          <div
            className="mx-auto w-full max-w-[340px] rounded-[20px] border border-zinc-800 bg-zinc-950 p-3.5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-400">
                <ShieldCheck size={17} />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-zinc-100">
                  {groupedCodeMode ? 'Códigos desta parada' : 'Código de confirmação'}
                </h3>
                <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                  {groupedCodeMode
                    ? `${pendingGroupedDeliveries.length} entregas · 1 parada física`
                    : `${customer?.name || delivery.customer_name || 'Cliente iFood'}${delivery.order_id ? ` · #${delivery.order_id}` : ''}`}
                </p>
              </div>

              <button
                type="button"
                disabled={completionBusy}
                onClick={closeConfirmationModal}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-900 text-zinc-500 disabled:opacity-35"
                aria-label="Fechar"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 max-h-[52vh] space-y-2 overflow-y-auto pr-0.5">
              {groupedCodeDeliveries.map((item, index) => {
                const itemCustomer = getCustomerById(item.customer_id);
                const itemName = itemCustomer?.name || item.customer_name || 'Cliente iFood';
                const value = groupedCodeMode ? (groupedCodeDrafts[item.id] || '') : inputCode;
                return (
                  <label key={item.id} className="block rounded-xl border border-zinc-800 bg-zinc-900/45 p-2.5">
                    <span className="mb-2 flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-black text-zinc-200">{index + 1}. {itemName}</span>
                      {item.order_id && <span className="shrink-0 text-[9px] font-bold text-zinc-600">#{item.order_id}</span>}
                    </span>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-500">Código individual (opcional)</span>
                      <button type="button" disabled={completionBusy} className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold ${skippedCodeIds.includes(item.id) ? 'border-amber-500/35 text-amber-200' : 'border-zinc-700 text-zinc-300'}`} onClick={() => {
                        setSkippedCodeIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]);
                        setGroupedCodeDrafts((current) => ({...current, [item.id]: ''}));
                        if (!groupedCodeMode) setInputCode('');
                      }}>{skippedCodeIds.includes(item.id) ? 'Pulado ✓' : 'Pular este'}</button>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      autoFocus={index === 0}
                      disabled={completionBusy || skippedCodeIds.includes(item.id)}
                      aria-label={`Código de confirmação de ${itemName}`}
                      placeholder="0000"
                      value={value}
                      onChange={(event) => {
                        const nextCode = event.target.value.replace(/\D/g, '').slice(0, 4);
                        setSkippedCodeIds((current) => current.filter((id) => id !== item.id));
                        if (groupedCodeMode) {
                          setGroupedCodeDrafts((current) => ({ ...current, [item.id]: nextCode }));
                        } else {
                          setInputCode(nextCode);
                          setGroupedCodeDrafts({ [item.id]: nextCode });
                        }
                      }}
                      onKeyDown={(event) => {
                        const drafts = groupedCodeMode ? groupedCodeDrafts : { [item.id]: inputCode };
                        const allValid = groupedCodeDeliveries.every((codeItem) => skippedCodeIds.includes(codeItem.id) || (drafts[codeItem.id] || '').length === 4);
                        if (event.key === 'Enter' && allValid) void executeCompletion(drafts);
                      }}
                      className="h-11 w-full rounded-lg border border-red-500/30 bg-zinc-950 px-4 text-center font-mono text-lg font-black tracking-[0.32em] text-zinc-50 outline-none focus:border-red-400 disabled:opacity-60"
                    />
                  </label>
                );
              })}
              <p className="mt-2 text-center text-[9px] leading-relaxed text-zinc-600">
                Cada código fica salvo na entrega e no cliente correspondente.
                A confirmação externa do iFood continua separada.
              </p>
            </div>

            <button
              type="button"
              disabled={groupedCodeDeliveries.some((item) => !skippedCodeIds.includes(item.id) && (groupedCodeMode ? groupedCodeDrafts[item.id] : inputCode).length !== 4) || completionBusy}
              onClick={async () => {
                const drafts = groupedCodeMode
                  ? groupedCodeDrafts
                  : { [groupedCodeDeliveries[0]?.id || delivery.id]: inputCode };
                if (groupedCodeDeliveries.some((item) => !skippedCodeIds.includes(item.id) && (drafts[item.id] || '').length !== 4)) return;
                await executeCompletion(drafts);
              }}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-black text-zinc-950 disabled:opacity-35"
            >
              {completionBusy ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
              {completionBusy
                ? 'Finalizando...'
                : groupedCodeMode
                  ? `Salvar e finalizar ${pendingGroupedDeliveries.length} entregas`
                  : 'Salvar e finalizar'}
            </button>

            <button
              type="button"
              disabled={completionBusy}
              onClick={async () => {
                impact(ImpactStyle.Light);
                await executeCompletion();
              }}
              className="mt-1 flex h-9 w-full items-center justify-center text-[10px] font-bold text-zinc-500 disabled:opacity-35"
            >
              {groupedCodeMode
                ? `Finalizar ${pendingGroupedDeliveries.length} entregas sem código`
                : 'Finalizar sem código'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Isolated subscription: compact stops must not all recalculate customer history
// when unrelated deliveries change in Zustand.
function RecurrenceDetails({ delivery }: { delivery: Delivery }) {
  const recurrenceDeliveries = useAppStore((state) => state.deliveries);
  const recurrence = useMemo(() => customerRecurrence(recurrenceDeliveries, delivery.customer_id, delivery),
    [recurrenceDeliveries, delivery.customer_id, delivery.id, delivery.completed]);
  const isTest = delivery.developer_test === true || delivery.owner_order_context === 'owner_provisional';
  if (isTest || (!recurrence.tier && !recurrence.milestoneLabel)) return null;
  return <div className="flex flex-wrap items-center gap-1.5 text-[10px]" aria-label="Histórico do cliente">
    {recurrence.tier && <span className="rounded-lg bg-amber-500/10 px-2 py-1 font-bold text-amber-300"><Crown size={12} className="mr-1 inline"/>{recurrence.tier === 'super' ? 'Supercliente' : 'Frequente'} · {recurrence.completedOrders} concluídos</span>}
    {recurrence.milestoneLabel && <button type="button" onClick={() => toast.info('Marco de cliente direto', { description: recurrence.milestoneLabel || undefined })} className="rounded-lg bg-violet-500/10 px-2 py-1 font-bold text-violet-300">{recurrence.milestoneLabel}</button>}
  </div>;
}
