'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Share2, Banknote, CreditCard, QrCode, CupSoda, CheckCircle2, Pencil,
  Smartphone, Store, Globe2, ArrowUp, ArrowDown, MapPin, ShieldCheck, X, Maximize2, Minimize2, Navigation, MessageCircle, AlertTriangle, Copy, Crown, Map as MapIcon, CheckSquare, Trash2, LoaderCircle, GripVertical
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import clsx from 'clsx';
import type { Delivery, Customer, Route } from '@/types';
import { copyDeliveryToClipboard } from '@/lib/whatsapp';
import { MiniMap } from '@/components/deliveries/MiniMap';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { dateKey, deliveryDate, routeStartedAt } from '@/lib/operational-time';
import { compactAddressForCard, hasHouseNumber } from "@/lib/operational-address";
import { auditOperationalAddress } from '@/lib/address-quality';
import { SiteOrderSnapshot } from '@/components/home/SiteOrderSnapshot';
import { customerRecurrence } from '@/lib/customer-recurrence';
import { deliveryPaymentStateLabel, deriveDeliveryPaymentState, deliveryCustomerCharge, deliveryEconomicValue } from '@/lib/delivery-finance';
import { summarizeStopFinance } from '@/lib/delivery-stop-finance';
import { ownerContextLabel } from '@/lib/owner-order-context';

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
  const isExpanded = useAppStore(
    (state) =>
      state.deliveries.find((item) => item.id === delivery.id)?.is_expanded ||
      false,
  );
  const groupedDeliveries = stopDeliveries?.length ? stopDeliveries : [delivery];
  const isGroupedStop = groupedDeliveries.length > 1;
  const groupedFinance = useMemo(() => summarizeStopFinance(groupedDeliveries), [stopDeliveries, delivery]);
  const groupedTotal = groupedFinance.economicTotal;
  const groupedPending = groupedDeliveries.filter((item) => !item.completed).length;
  const groupedToCollect = groupedDeliveries.filter(item => deriveDeliveryPaymentState(item) === 'collect_on_delivery');
  const groupedPixPending = groupedDeliveries.filter(item => deriveDeliveryPaymentState(item) === 'pending');
  const groupedCollectValue = groupedFinance.collectTotal;
  const groupedCodes = Array.from(new Set(groupedDeliveries.map((item) => item.confirmation_code?.replace(/\D/g, '').slice(0, 4)).filter((code): code is string => Boolean(code))));
  const commonConfirmationCode = groupedCodes.length === 1 ? groupedCodes[0] : customer?.last_confirmation_code || '';

  // V42: expansão é apenas estado transitório de conferência.
  // Ao entrar/recarregar a tela, o padrão volta a ser compacto.
  useEffect(() => {
    if (delivery.is_expanded) toggleDeliveryExpansion(delivery.id, false);
    // Executa somente na montagem deste card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Movimentar o cartão via ref evita renderizar ~1.000 linhas de JSX a cada pixel.
  const swipeSurfaceRef = useRef<HTMLDivElement | null>(null);
  const swipeOffsetRef = useRef(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const reorderBusyRef = useRef(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  // Alça dedicada: não disputa o gesto horizontal de concluir/expandir.
  const reorderGesture = useRef<null | {
    pointerId: number;
    startY: number;
    origin: number;
    target: number;
    moved: boolean;
    targets: Array<{ index: number; middle: number; element: HTMLElement }>;
    highlighted: HTMLElement | null;
  }>(null);
  const [dropTargetPosition, setDropTargetPosition] = useState<number | null>(null);
  // Arraste longo: acompanha a lista perto das bordas sem recalcular a rota
  // inteira nem transformar cada pixel em atualização React.
  const reorderAutoScrollFrame = useRef<number | null>(null);
  const reorderPointerY = useRef<number | null>(null);
  const reorderAutoScrollStep = useRef(0);

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
  useEffect(() => () => {
    if (reorderAutoScrollFrame.current !== null) {
      window.cancelAnimationFrame(reorderAutoScrollFrame.current);
      reorderAutoScrollFrame.current = null;
    }
    const highlighted = reorderGesture.current?.highlighted;
    if (highlighted) {
      highlighted.style.outline = '';
      highlighted.style.outlineOffset = '';
    }
    reorderGesture.current = null;
  }, []);

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
  const operationalContextLabel = ownerContextLabel(delivery);
  const isDeveloperTest = delivery.developer_test === true || delivery.owner_order_context === 'owner_provisional';
  const isSiteAwaitingConfirmation = isSiteOrder && (delivery.site_order_status || '').trim().toLocaleLowerCase('pt-BR') === 'pendente';
  const isUrgent = groupedDeliveries.some((item) => item.is_urgent);
  // Uma única leitura da lista e um único cálculo por card/versão, evitando
  // três varreduras completas do histórico em cada renderização.
  const recurrenceDeliveries = useAppStore((state) => state.deliveries);
  const recurrence = useMemo(
    () => customerRecurrence(recurrenceDeliveries, delivery.customer_id, delivery),
    [recurrenceDeliveries, delivery.customer_id, delivery.id, delivery.completed],
  );
  const customerTier = recurrence.tier;
  const isVIP = Boolean(customerTier);

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
      const code = (delivery.confirmation_code || customer?.last_confirmation_code || '').replace(/\D/g, '').slice(0, 4);
      const orderId = (delivery.ifood_id || '').replace(/\D/g, '').slice(0, 8);
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

  const pendingGroupedDeliveries = groupedDeliveries.filter((item) => !item.completed);
  const requiresConfirmationCode = (item: Delivery) => {
    const itemIsIfood = item.origin === 'ifood' || !item.origin;
    const skipsCode = item.payment_method === 'dinheiro' || item.payment_method?.includes('cartao');
    return itemIsIfood && !skipsCode;
  };
  const storedConfirmationCode = (item: Delivery) => (
    item.confirmation_code || getCustomerById(item.customer_id)?.last_confirmation_code || ''
  ).replace(/\D/g, '').slice(0, 4);
  const groupedCodeDeliveries = pendingGroupedDeliveries.filter(requiresConfirmationCode);
  const groupedCodeMode = pendingGroupedDeliveries.length > 1;

  const closeConfirmationModal = () => {
    setIsIfoodModalOpen(false);
    setInputCode('');
    setGroupedCodeDrafts({});
  };

  const copyStop = async () => {
    if (copyBusyRef.current) return;
    copyBusyRef.current = true;
    setCopyBusy(true);
    try {
      const copied = await copyDeliveryToClipboard(delivery, customer?.name, customer?.last_confirmation_code, groupedDeliveries, typeof delivery.order_index === 'number' ? delivery.order_index + 1 : undefined);
      if (copied) toast.success('Entrega copiada!');
      else toast.error('Não foi possível copiar a entrega.', { description: 'Tente novamente. Nenhum pedido foi alterado.' });
    } finally {
      copyBusyRef.current = false;
      setCopyBusy(false);
    }
  };

  const executeCompletion = async (codeInput?: string | Record<string, string>) => {
    const targets = groupedDeliveries.filter((item) => !item.completed);
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
        const codeToSave = (suppliedCode || storedConfirmationCode(item)).replace(/\D/g, '').slice(0, 4);
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
      const remainingPending = routeDeliveries.filter((item) => !completedIds.has(item.id) && !item.completed).length;
      if (remainingPending === 0) {
        toast.info('Última entrega registrada. Aguardando confirmação do fechamento da rota.');
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

      const newStatus = !delivery.completed;
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

      const codeDeliveries = pendingGroupedDeliveries.filter(requiresConfirmationCode);
      const needsGroupedCodeModal = pendingGroupedDeliveries.length > 1 && codeDeliveries.length > 0;
      const needsSingleCodeModal = codeDeliveries.length === 1 && !storedConfirmationCode(codeDeliveries[0]);
      if (needsGroupedCodeModal || needsSingleCodeModal) {
        const initialDrafts = Object.fromEntries(
          codeDeliveries.map((item) => [item.id, storedConfirmationCode(item)]),
        );
        setGroupedCodeDrafts(initialDrafts);
        setInputCode(codeDeliveries.length === 1 ? initialDrafts[codeDeliveries[0].id] || '' : '');
        setIsIfoodModalOpen(true);
        return;
      }

      await executeCompletion(
        Object.fromEntries(codeDeliveries.map((item) => [item.id, storedConfirmationCode(item)])),
      );
    } else {
      if (!isExpanded) {
      getDeliveriesByRoute(route.id)
        .filter((item) => item.id !== delivery.id && item.is_expanded)
        .forEach((item) => toggleDeliveryExpansion(item.id, false));
    }
    toggleDeliveryExpansion(delivery.id, !isExpanded);
    }
  }

  const orderLocked = groupedDeliveries.some((item) => item.order_locked === true);
  const manualLocked = groupedDeliveries.some(
    (item) => item.order_locked === true && item.order_source !== 'smart',
  );
  const smartLocked = orderLocked && !manualLocked;
  const canReorder =
    !isRecoveryRoute &&
    !isAwaitingRoute &&
    route.id !== 'rota-site-aguardando-confirmacao' &&
    route.status === 'aberta' &&
    !delivery.completed &&
    position !== undefined &&
    pendingCount > 1 && !completionBusy;

  const moveStop = async (targetIndex: number) => {
    if (!canReorder || reorderBusyRef.current) return;
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


  const stopReorderAutoScroll = () => {
    reorderAutoScrollStep.current = 0;
    reorderPointerY.current = null;
    if (reorderAutoScrollFrame.current !== null) {
      window.cancelAnimationFrame(reorderAutoScrollFrame.current);
      reorderAutoScrollFrame.current = null;
    }
  };

  const clearReorderGesture = () => {
    stopReorderAutoScroll();
    const gesture = reorderGesture.current;
    if (gesture?.highlighted) {
      gesture.highlighted.style.outline = '';
      gesture.highlighted.style.outlineOffset = '';
    }
    reorderGesture.current = null;
    setDropTargetPosition(null);
  };

  const updateReorderTarget = (clientY: number) => {
    const gesture = reorderGesture.current;
    if (!gesture) return;
    let nearest = gesture.targets[0];
    if (!nearest) return;
    // O centro da parada precisa ser relido depois de rolar a página.
    let nearestDistance = Math.abs(clientY - (nearest.element.getBoundingClientRect().top + nearest.element.getBoundingClientRect().height / 2));
    for (const candidate of gesture.targets.slice(1)) {
      const rect = candidate.element.getBoundingClientRect();
      const distance = Math.abs(clientY - rect.top - rect.height / 2);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }
    if (nearest.index === gesture.target && gesture.highlighted === nearest.element) return;
    if (gesture.highlighted) {
      gesture.highlighted.style.outline = '';
      gesture.highlighted.style.outlineOffset = '';
    }
    nearest.element.style.outline = '2px solid rgba(56,189,248,.9)';
    nearest.element.style.outlineOffset = '2px';
    gesture.highlighted = nearest.element;
    gesture.target = nearest.index;
    setDropTargetPosition(nearest.index + 1);
  };

  const advanceReorderAutoScroll = () => {
    reorderAutoScrollFrame.current = null;
    const gesture = reorderGesture.current;
    const clientY = reorderPointerY.current;
    const step = reorderAutoScrollStep.current;
    if (!gesture || !gesture.moved || clientY === null || step === 0) return;
    const previousY = window.scrollY;
    window.scrollBy(0, step);
    updateReorderTarget(clientY);
    // Sem espaço para rolar (início/fim da página): não agendar RAF em loop.
    if (Math.abs(window.scrollY - previousY) < 0.5) return;
    reorderAutoScrollFrame.current = window.requestAnimationFrame(advanceReorderAutoScroll);
  };

  const handleReorderPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!canReorder || reorderBusyRef.current || reorderGesture.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-dfl-stop-index]'))
      .filter((element) => element.dataset.dflRouteId === route.id)
      .map((element) => ({
        index: Number(element.dataset.dflStopIndex) - 1,
        middle: element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2,
        element,
      }))
      .filter((target) => Number.isInteger(target.index) && target.index >= 0 && target.index < pendingCount);
    if (targets.length < 2) return;
    const origin = Math.max(0, (position || 1) - 1);
    reorderGesture.current = {
      pointerId: event.pointerId, startY: event.clientY, origin, target: origin,
      moved: false, targets, highlighted: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDropTargetPosition(origin + 1);
  };

  const handleReorderPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = reorderGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (!gesture.moved && Math.abs(event.clientY - gesture.startY) < 8) return;
    gesture.moved = true;
    reorderPointerY.current = event.clientY;
    updateReorderTarget(event.clientY);
    const edge = 88;
    const y = event.clientY;
    const distance = Math.min(y, window.innerHeight - y);
    const strength = Math.max(0, Math.min(1, (edge - distance) / edge));
    reorderAutoScrollStep.current = strength === 0 ? 0 : (y < edge ? -1 : 1) * Math.max(2, Math.round(strength * 18));
    if (reorderAutoScrollStep.current === 0) {
      if (reorderAutoScrollFrame.current !== null) {
        window.cancelAnimationFrame(reorderAutoScrollFrame.current);
        reorderAutoScrollFrame.current = null;
      }
    } else if (reorderAutoScrollFrame.current === null) {
      reorderAutoScrollFrame.current = window.requestAnimationFrame(advanceReorderAutoScroll);
    }
  };

  const handleReorderPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    const gesture = reorderGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const shouldMove = gesture.moved && gesture.origin !== gesture.target;
    const target = gesture.target;
    clearReorderGesture();
    if (shouldMove) {
      suppressCardClick.current = true;
      window.setTimeout(() => { suppressCardClick.current = false; }, 300);
      void moveStop(target);
    }
  };

  const resetCardSwipe = () => {
    const element = swipeSurfaceRef.current;
    if (element) {
      element.style.transition = 'transform 180ms ease-out';
      element.style.transform = 'translateX(0px)';
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
      setIsSwiping(true);
    }
    if (swipeAxis.current !== 'horizontal') return;
    const offset = Math.max(-112, Math.min(112, dx * 0.82));
    swipeOffsetRef.current = offset;
    if (swipeSurfaceRef.current) swipeSurfaceRef.current.style.transform = `translateX(${offset}px)`;
    const direction = offset > 55 ? 'right' : offset < -55 ? 'left' : null;
    // Só dois possíveis re-renders durante o gesto: armar/desarmar a ação.
    setSwipeDirection((previous) => previous === direction ? previous : direction);
  };

  const handleTouchEnd = () => {
    if (swipeAxis.current !== 'horizontal') { resetCardSwipe(); return; }
    const dx = touchCurrentX.current - touchStartX.current;
    const dy = touchCurrentY.current - touchStartY.current;
    const wasComplete = !delivery.completed;
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
          "relative overflow-hidden rounded-[18px] transition-all duration-200",
          delivery.completed ? "opacity-80" : "shadow-sm",
          isUrgent && !delivery.completed && "shadow-[0_0_15px_rgba(239,68,68,0.15)] border border-red-500/40",
          isNeighbor && !delivery.completed && "border-amber-500/30",
          isExpanded
            ? "bg-zinc-900 border border-amber-500/35 shadow-[0_14px_34px_rgba(0,0,0,0.32)]"
            : delivery.completed
              ? "bg-zinc-900/24 border border-emerald-500/12"
              : "bg-zinc-900/35 border border-zinc-800/70"
        )}
      >
        <div className={clsx(
          "absolute inset-0 flex items-center justify-between px-6 transition-colors duration-150",
          isDraggingRight ? "bg-sky-500/40" : isDraggingLeft ? "bg-emerald-500/50" : "bg-zinc-950"
        )}>
          <div className={clsx("flex items-center gap-2 font-bold transition-all", isDraggingRight ? "opacity-100 text-sky-200 scale-110" : "opacity-40 text-zinc-400")}>
            {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            <span className="text-xs">{isExpanded ? 'Minimizar' : 'Expandir'}</span>
          </div>
          <div className={clsx("flex items-center gap-2 font-bold transition-all", isDraggingLeft ? "opacity-100 text-emerald-200 scale-110" : "opacity-40 text-zinc-400")}>
            <span className="text-xs">{isRecoveryRoute ? 'Corrigir rota' : 'Dar Baixa'}</span>
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div
          ref={swipeSurfaceRef}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (isSwiping || suppressCardClick.current || target.closest('button, a, input, textarea, select, [data-no-card-swipe="true"]')) return;
            void handleTriggerAction('expand');
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          style={{ touchAction: 'pan-y' }}
          className={clsx("relative z-10 flex w-full flex-col bg-zinc-900", !isSwiping && "transition-transform duration-200")}
        >
          <div className={clsx("flex flex-col", isExpanded ? "p-4" : "px-3 py-2.5")}>
            <div className="flex items-start gap-3">
              <div className="relative shrink-0 mt-0.5">
                <span className={clsx("flex items-center justify-center rounded-xl border", isExpanded ? "h-10 w-10" : "h-9 w-9", isIfood ? "bg-red-500/10 border-red-500/20 text-red-500" : isSiteOrder ? "bg-sky-500/10 border-sky-500/20 text-sky-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500")}>
                  {isIfood ? <Smartphone size={19} /> : isSiteOrder ? <Globe2 size={19} /> : <Store size={19} />}
                </span>
                {position !== undefined && (
                  <span className="absolute -left-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950 px-1 text-[9px] font-black text-zinc-200 shadow-lg">
                    {position}
                  </span>
                )}
              </div>

              <div className="flex flex-col flex-1 truncate">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <p className="font-heading text-sm font-black tracking-tight text-zinc-50 truncate flex items-center gap-1">
                      {isGroupedStop
                        ? `${groupedDeliveries.length} pedidos · 1 parada`
                        : customer?.name || delivery.customer_name || (isIfood ? 'Cliente iFood' : 'Sem Nome')}
                      {!isGroupedStop && isVIP && <Crown size={12} className="text-amber-500 shrink-0" />}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="block text-right text-[8px] font-bold uppercase tracking-wide text-zinc-500">{isGroupedStop ? 'Valor dos pedidos' : 'Valor do pedido'}</span>
                    <p className="text-sm font-black text-zinc-200 tracking-tight shrink-0">
                      {isPrivacyMode ? 'R$ •••••' : `R$ ${(isGroupedStop ? groupedTotal : deliveryEconomicValue(delivery)).toFixed(2).replace('.', ',')}`}
                    </p>
                    {(isGroupedStop ? groupedFinance.hasDifferentCustomerCharge : Math.abs(deliveryEconomicValue(delivery) - deliveryCustomerCharge(delivery)) >= 0.005) && (
                      <span className="mt-0.5 block text-right text-[9px] font-semibold text-amber-300">Cliente paga: {isPrivacyMode ? 'R$ •••' : `R$ ${(isGroupedStop ? groupedFinance.customerTotal : deliveryCustomerCharge(delivery)).toFixed(2).replace('.', ',')}`}</span>
                    )}
                  </div>
                </div>

                {/* Linha dos Identificadores com Press & Hold */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {isSiteOrder && <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-sky-300">Site</span>}
                  {isSiteAwaitingConfirmation && <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-300">Aguardando confirmação</span>}
                  {isGroupedStop && !isExpanded && groupedFinance.collectCount > 0 && <span className="rounded-md border border-amber-500/25 bg-amber-500/[.07] px-2 py-0.5 text-[9px] font-bold text-amber-300">{groupedFinance.collectCount} cobrar</span>}
                  {isGroupedStop && !isExpanded && groupedFinance.pendingCount > 0 && <span className="rounded-md border border-violet-500/25 bg-violet-500/[.07] px-2 py-0.5 text-[9px] font-bold text-violet-300">{groupedFinance.pendingCount} Pix/pendência</span>}
                  {!isGroupedStop && operationalContextLabel && <span className="rounded-md border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9px] font-black text-sky-300">{operationalContextLabel}</span>}
                  {!isGroupedStop && !isDeveloperTest && customerTier && <span className="rounded-md border border-amber-500/20 bg-amber-500/[.08] px-2 py-0.5 text-[9px] font-black text-amber-300">{customerTier === 'super' ? 'Supercliente' : 'Frequente'} · {recurrence.completedOrders} concluídos</span>}
                  {!isGroupedStop && recurrence.milestoneLabel && <button type="button" onClick={(event) => { event.stopPropagation(); toast.info('Marco de cliente direto', { description: recurrence.milestoneLabel || undefined }); }} className="rounded-md border border-violet-500/25 bg-violet-500/[.08] px-2 py-0.5 text-[9px] font-black text-violet-300">{recurrence.milestoneLabel}</button>}
                  {isGroupedStop ? (
                    <span className="bg-violet-500/15 border border-violet-500/30 text-violet-300 px-2 py-0.5 rounded-md text-[10px] font-black shrink-0">
                      {groupedDeliveries.length} pedidos · {groupedPending} pendente{groupedPending === 1 ? '' : 's'}
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
                  {!isGroupedStop && isIfood && (delivery.confirmation_code || customer?.last_confirmation_code) && (
                    <button
                      onClick={() => triggerCopyAndRedirect(delivery.confirmation_code || customer?.last_confirmation_code || '')}
                      onTouchStart={() => handleTouchStartLongPress(delivery.confirmation_code || customer?.last_confirmation_code || '')}
                      onTouchEnd={handleTouchEndLongPress}
                      className="bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 active:scale-95 text-amber-400 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 flex items-center gap-1 transition-all"
                    >
                      Cód: {delivery.confirmation_code || customer?.last_confirmation_code} <Copy size={9} />
                    </button>
                  )}
                </div>

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
                        const itemCode = item.confirmation_code?.replace(/\D/g, '').slice(0, 4);
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
                                {itemCode && groupedCodes.length > 1 && <span className="font-mono text-[9px] text-amber-400">Cód {itemCode}</span>}
                              </div>
                              <p className="mt-0.5 truncate text-[9px] font-bold text-zinc-500">
                                {paymentLabel}
                                {item.drinks?.trim() ? ` · ${item.drinks.trim()}` : ''}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] font-black text-emerald-400">{isPrivacyMode ? 'R$ •••' : `R$ ${charge.toFixed(2).replace('.', ',')}`}</span>
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

                {!delivery.completed && addressQuality.needsReview && (
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

                {/* VISUALIZAÇÃO COMPACTA */}
                {!isExpanded && (
                  <div className="mt-1.5 flex w-full flex-col gap-1.5 border-t border-zinc-800/50 pt-1.5">

                    <div className="flex items-center gap-2.5">
                      <a
                        href={mapTarget || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-emerald-500/20 bg-emerald-500/[0.07] flex items-center justify-center active:scale-95 transition-all group"
                        onClick={event=>{if(!mapTarget){event.preventDefault();toast.warning('Confira o endereço antes de abrir o mapa.');}}}
                        aria-label={mapTarget ? 'Abrir localização no Google Maps' : 'Endereço sem mapa válido'}
                        title={mapTarget ? 'Ver no Google Maps' : 'Revisar endereço'}
                      >
                        <div className="absolute inset-0 bg-emerald-500/10 opacity-60 group-hover:opacity-100" />
                        <MapIcon size={17} className="text-emerald-400 relative z-10" />
                      </a>

                      <div className="flex flex-col gap-1 truncate flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap truncate">
                          {isGroupedStop ? (
                            <>
                              {groupedToCollect.length > 0 && <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-300"><Banknote size={11}/> {groupedToCollect.length} cobrar · {isPrivacyMode ? 'R$ •••' : `R$ ${groupedCollectValue.toFixed(2).replace('.', ',')}`}</span>}
                              {groupedPixPending.length > 0 && <span className="inline-flex items-center gap-1 rounded-lg border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[10px] font-black text-violet-300"><QrCode size={11}/> {groupedPixPending.length} pagamento{groupedPixPending.length===1?'':'s'} pendente{groupedPixPending.length===1?'':'s'}</span>}
                              {groupedToCollect.length === 0 && groupedPixPending.length === 0 && <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300"><CheckCircle2 size={11}/> Todos pagos</span>}
                            </>
                          ) : paymentState === 'paid' ? (
                            <span className="flex items-center gap-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[10px] font-black shrink-0">
                              <CheckCircle2 size={10} /> Pago
                            </span>
                          ) : (
                            <span className={clsx("flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-black shrink-0", payment.className)}>
                              <PaymentIcon size={10} />
                              {paymentState === 'pending' ? 'Pix pendente' : payment.label === 'Dinheiro'
                                ? `Cobrar dinheiro ${delivery.change_for ? `(Troco p/ ${isPrivacyMode ? '•••' : `R$ ${delivery.change_for.toFixed(2).replace('.', ',')}`})` : ''}`
                                : 'Cobrar cartão'}
                            </span>
                          )}

                          {!isGroupedStop && delivery.drinks && (
                            <span className="flex items-center gap-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 px-1.5 py-0.5 text-[10px] font-black shrink-0 truncate max-w-[100px]">
                              <CupSoda size={10} /> {delivery.drinks}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {delivery.notify_whatsapp && (
                            <span className="flex items-center gap-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-1.5 py-0.5 text-[9px] font-black shrink-0">
                              <MessageCircle size={9} /> Avisar no Portão
                            </span>
                          )}

                          {isNeighbor && (
                            <span className="rounded bg-sky-500/15 border border-sky-500/30 text-sky-400 px-1.5 py-0.5 text-[9px] font-extrabold uppercase shrink-0">
                              Vizinhas {neighborPosition || 1}/{neighborTotal || 2}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 border-t border-zinc-800/40 pt-1.5 min-[390px]:grid-cols-[minmax(0,1fr)_auto] min-[390px]:items-center">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await copyStop();
                          }}
                          className="flex min-w-0 items-center gap-1.5 h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40 active:scale-95 text-[11px] font-bold transition-all shadow-sm"
                        >
                          <Copy size={13} className="text-emerald-500" /> Copiar Dados
                        </button>

                        {!isGroupedStop && normalizedWhatsappPhone && (
                          <a
                            href={`https://wa.me/${normalizedWhatsappPhone}?text=${encodeURIComponent('Olá! Sou o entregador da Da Família Lanches e já cheguei com seu pedido. Estou no portão.')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 active:scale-90 transition-transform"
                            title="Chamar cliente no WhatsApp"
                      aria-label="Chamar cliente no WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </div>

                      {!isExpanded && canReorder && (
                        <div className="flex min-w-0 items-center justify-end gap-1.5" aria-label="Reordenar parada">
                          <button type="button" disabled={reorderBusy} onClick={async(e)=>{e.stopPropagation();if(reorderBusyRef.current)return;reorderBusyRef.current=true;setReorderBusy(true);try{const nextLocked=!orderLocked;const changedAt=new Date().toISOString();for(const item of groupedDeliveries)await updateDelivery(item.id,{order_locked:nextLocked,order_source:'manual',order_updated_at:changedAt});toast.success(nextLocked?'Parada travada na sequência.':'Parada destravada.')}catch{toast.error('Não foi possível alterar a trava.')}finally{reorderBusyRef.current=false;setReorderBusy(false)}}} className={`flex h-9 items-center rounded-xl border px-2 text-[9px] font-black disabled:opacity-40 ${orderLocked?'border-amber-500/30 bg-amber-500/10 text-amber-300':'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{manualLocked?'Destravar':smartLocked?'Inteligente':'Fixar'}</button>
                          <button
                            type="button"
                            data-no-card-swipe="true"
                            disabled={reorderBusy}
                            onPointerDown={handleReorderPointerDown}
                            onPointerMove={handleReorderPointerMove}
                            onPointerUp={handleReorderPointerEnd}
                            onPointerCancel={clearReorderGesture}
                            onLostPointerCapture={clearReorderGesture}
                            onClick={(event) => event.stopPropagation()}
                            style={{ touchAction: 'none' }}
                            className={`flex h-9 min-w-9 items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-black active:scale-95 ${dropTargetPosition !== null ? 'border-sky-400/70 bg-sky-500/15 text-sky-200' : 'border-zinc-800 bg-zinc-950 text-zinc-400'}`}
                            aria-label={dropTargetPosition === null ? 'Segure e arraste para reposicionar a parada' : `Solte para mover até a parada ${dropTargetPosition}`}
                            title="Arrastar parada"
                          >
                            <GripVertical size={16}/>
                            {dropTargetPosition !== null && <span aria-live="polite">{dropTargetPosition}</span>}
                          </button>
                          <div className="flex items-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await moveStop(Math.max(0, (position || 1) - 2));
                              }}
                              className="flex h-9 w-9 items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-zinc-100 disabled:opacity-30"
                              disabled={reorderBusy || (position || 1) <= 1}
                              aria-label="Mover uma posição para cima"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <div className="h-4 w-px bg-zinc-800" />
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await moveStop(position || 1);
                              }}
                              className="flex h-9 w-9 items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-zinc-100 disabled:opacity-30"
                              disabled={reorderBusy || (position || 1) >= pendingCount}
                              aria-label="Mover uma posição para baixo"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>

                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VISUALIZAÇÃO EXPANDIDA */}
          {isExpanded && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="px-4 pb-3 flex flex-col gap-2.5">
                <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/45 p-3" aria-label="Resumo da parada">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[.12em] text-zinc-500">Detalhes da parada</span>
                    <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${delivery.completed ? 'bg-emerald-500/10 text-emerald-300' : 'bg-sky-500/10 text-sky-300'}`}>{delivery.completed ? 'Concluída' : isGroupedStop ? `${groupedPending} pedidos pendentes` : 'Pendente'}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-zinc-200">{shortAddress || 'Endereço não informado'}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    {position !== undefined && <span className="rounded-lg bg-zinc-900 px-2 py-1 text-zinc-300">Parada {position}</span>}
                    <span className="rounded-lg bg-zinc-900 px-2 py-1 text-zinc-300">{isGroupedStop ? `${groupedDeliveries.length} pedidos` : isSiteOrder ? 'Pedido do Site' : isIfood ? 'Pedido iFood' : 'Pedido direto'}</span>
                    {!delivery.completed && groupedCodeDeliveries.length > 0 && <span className="rounded-lg bg-amber-500/10 px-2 py-1 font-bold text-amber-300">{groupedCodeDeliveries.length} código{groupedCodeDeliveries.length===1?'':'s'} para conferir</span>}
                    {activePhone && <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-emerald-300">Contato disponível</span>}
                  </div>
                </div>
                {(delivery.completed || route.status === 'fechada') && (
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[.04] px-3 py-2 text-[10px] font-semibold text-emerald-300">
                    {delivery.completed ? 'Entrega concluída · reordenação indisponível' : 'Rota fechada · ordem preservada'}
                  </div>
                )}
                <div className="flex items-center gap-2 pl-1 flex-wrap">
                  {hasCoordinatesOrLink ? (
                    <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                      <Navigation size={10} /> Ponto Preciso Ativo
                    </span>
                  ) : !hasStreetNumber ? (
                    <span className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-400 border border-amber-500/30">
                      Sem número residencial
                    </span>
                  ) : null}
                </div>

                <div className="mt-1">
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
                    {mapOpen ? 'Ocultar mapa' : 'Ver mapa'}
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

      <SiteOrderSnapshot delivery={delivery} privacy={isPrivacyMode} />

              {delivery.observation && (
                <div className="ml-14 mr-4 mb-3 rounded-2xl bg-amber-500/5 border border-amber-500/15 px-3.5 py-2.5">
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
                    onClick={() => { void copyStop(); }}
                    disabled={copyBusy}
                    aria-busy={copyBusy}
                    aria-label={copyBusy ? "Copiando mensagem da entrega" : "Copiar mensagem da entrega"}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 active:scale-90 transition-all"
                  >
                    {copyBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Share2 size={16} strokeWidth={2.5} />}
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
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      autoFocus={index === 0}
                      disabled={completionBusy}
                      aria-label={`Código de confirmação de ${itemName}`}
                      placeholder="0000"
                      value={value}
                      onChange={(event) => {
                        const nextCode = event.target.value.replace(/\D/g, '').slice(0, 4);
                        if (groupedCodeMode) {
                          setGroupedCodeDrafts((current) => ({ ...current, [item.id]: nextCode }));
                        } else {
                          setInputCode(nextCode);
                          setGroupedCodeDrafts({ [item.id]: nextCode });
                        }
                      }}
                      onKeyDown={(event) => {
                        const drafts = groupedCodeMode ? groupedCodeDrafts : { [item.id]: inputCode };
                        const allValid = groupedCodeDeliveries.every((codeItem) => (drafts[codeItem.id] || '').length === 4);
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
              disabled={groupedCodeDeliveries.some((item) => (groupedCodeMode ? groupedCodeDrafts[item.id] : inputCode).length !== 4) || completionBusy}
              onClick={async () => {
                const drafts = groupedCodeMode
                  ? groupedCodeDrafts
                  : { [groupedCodeDeliveries[0]?.id || delivery.id]: inputCode };
                if (groupedCodeDeliveries.some((item) => (drafts[item.id] || '').length !== 4)) return;
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
