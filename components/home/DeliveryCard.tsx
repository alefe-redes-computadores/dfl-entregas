'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Share2, Banknote, CreditCard, QrCode, CupSoda, CheckCircle2, Pencil,
  Smartphone, Store, ArrowUp, ArrowDown, GripVertical, MapPin, ShieldCheck, X, Maximize2, Minimize2, Navigation, MessageCircle, AlertTriangle, Copy, Crown, ExternalLink, Map as MapIcon, CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { Delivery, Customer, Route } from '@/types';
import { copyDeliveryToClipboard } from '@/lib/whatsapp';
import { MiniMap } from '@/components/deliveries/MiniMap';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { dateKey, deliveryDate, routeStartedAt } from '@/lib/operational-time';
import { compactAddressForCard, hasHouseNumber } from "@/lib/operational-address";

interface DeliveryCardProps {
  delivery: Delivery & { is_expanded?: boolean };
  customer?: Customer;
  route: Route;
  isNeighbor?: boolean;
  position?: number;
  pendingCount?: number;
  neighborPosition?: number;
  neighborTotal?: number;
}

const PAYMENT_CONFIG = {
  dinheiro: { label: 'Dinheiro', icon: Banknote, className: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  pix: { label: 'Pix', icon: QrCode, className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  cartao: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  cartao_credito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  cartao_debito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
} as const;

export function DeliveryCard({ delivery, customer, route, isNeighbor = false, position, pendingCount = 0, neighborPosition, neighborTotal }: DeliveryCardProps) {
  const router = useRouter();
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const reorderDelivery = useAppStore((state) => state.reorderDelivery);
  const moveDeliveryToIndex = useAppStore((state) => state.moveDeliveryToIndex);
  const toggleDeliveryExpansion = useAppStore((state) => state.toggleDeliveryExpansion);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode);
  const getDeliveriesByRoute = useAppStore((state) => state.getDeliveriesByRoute);

  const isExpanded = delivery.is_expanded || false;

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isHandleDragging, setIsHandleDragging] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);

  const [isIfoodModalOpen, setIsIfoodModalOpen] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [confirmRedirectModal, setConfirmRedirectModal] = useState<{isOpen: boolean, copiedText: string}>({ isOpen: false, copiedText: '' });

  const payment = PAYMENT_CONFIG[delivery.payment_method as keyof typeof PAYMENT_CONFIG] || PAYMENT_CONFIG.dinheiro;
  const PaymentIcon = payment.icon;
  const isIfood = delivery.origin === 'ifood' || !delivery.origin;
  const isUrgent = delivery.is_urgent;
  const isVIP = (customer?.orderCount || 0) >= 5;

  const shortAddress = compactAddressForCard(delivery.address_string, customer?.address, customer?.neighborhood);
  const hasCoordinatesOrLink = !!(customer?.maps_link || delivery.maps_link);
  const hasStreetNumber = hasHouseNumber(shortAddress);
  const activePhone = delivery.phone || customer?.phone;
  const isRecoveryRoute = route.id === 'rota-resgate-recuperada';
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

    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }

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

    if (
      options.offerIfoodPortal &&
      delivery.completed &&
      normalizedId.length === 8 &&
      copiedDigits === normalizedId
    ) {
      window.setTimeout(() => {
        setConfirmRedirectModal({ isOpen: true, copiedText: normalizedId });
      }, 320);
    }
  };

  const handleTouchStartLongPress = (text: string, offerIfoodPortal = false) => {
    longPressTimer.current = setTimeout(() => {
      void triggerCopyAndRedirect(text, { offerIfoodPortal });
    }, 450);
  };

  const handleTouchEndLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const executeCompletion = async (codeToSave?: string) => {
    if (delivery.completed) return;

    const updatePayload: Partial<Delivery> = { completed: true };
    if (codeToSave) {
      updatePayload.confirmation_code = codeToSave;
    }

    try {
      await updateDelivery(delivery.id, updatePayload);

      toggleDeliveryExpansion(delivery.id, false);
      setIsIfoodModalOpen(false);
      setInputCode('');

      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
      toast.success('Entrega concluída.', { duration: 1500 });

      const routeDeliveries = getDeliveriesByRoute(route.id);
      const remainingPending = routeDeliveries.filter(d => d.id !== delivery.id && !d.completed).length;
      if (remainingPending === 0) {
        toast.success('Todas as entregas foram concluídas. A rota foi fechada automaticamente.');
      }
    } catch (error) {
      console.error('Erro ao concluir entrega:', error);
      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
      toast.error('Não foi possível dar baixa na entrega.', {
        description: 'O estado anterior foi restaurado. Tente novamente.',
      });
    }
  };

  async function handleTriggerAction(actionType: 'complete' | 'expand') {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });

    if (actionType === 'complete') {
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

      if (isIfood && !delivery.confirmation_code && !customer?.last_confirmation_code) {
        setInputCode('');
        setIsIfoodModalOpen(true);
        return;
      }

      const code = delivery.confirmation_code || customer?.last_confirmation_code;
      await executeCompletion(code);
    } else {
      toggleDeliveryExpansion(delivery.id, !isExpanded);
    }
  }

  const orderLocked = delivery.order_locked === true;
  const canReorder =
    !isRecoveryRoute &&
    route.status === 'aberta' &&
    !delivery.completed &&
    position !== undefined &&
    pendingCount > 1 &&
    !orderLocked;

  const handleDragStart = async (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!canReorder) return;
    e.stopPropagation();
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = e.touches[0].clientY;
    setDragOffsetY(0);
    setIsHandleDragging(true);
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
  };

  const handleDragMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (!isHandleDragging || !canReorder) return;
    e.stopPropagation();
    dragCurrentY.current = e.touches[0].clientY;
    const diff = dragCurrentY.current - dragStartY.current;
    setDragOffsetY(Math.max(-150, Math.min(150, diff * 0.72)));
  };

  const handleDragEnd = async (e: React.TouchEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isHandleDragging || !canReorder || position === undefined) {
      setDragOffsetY(0);
      setIsHandleDragging(false);
      return;
    }

    const diff = dragCurrentY.current - dragStartY.current;
    // Touch V2: o primeiro salto exige intenção clara e cada posição
    // adicional consome aproximadamente a altura útil de um card.
    const absDiff = Math.abs(diff);
    const requestedSteps =
      absDiff < 64
        ? 0
        : Math.sign(diff) * Math.min(4, 1 + Math.floor((absDiff - 64) / 104));
    setDragOffsetY(0);
    setIsHandleDragging(false);
    dragStartY.current = 0;
    dragCurrentY.current = 0;

    if (requestedSteps === 0) return;

    const currentIndex = position - 1;
    const targetIndex = Math.max(0, Math.min(currentIndex + requestedSteps, pendingCount - 1));
    if (targetIndex === currentIndex) return;

    try {
      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
      await moveDeliveryToIndex(delivery.route_id, delivery.id, targetIndex);
      toast.success(`Parada movida para a posição ${targetIndex + 1}.`, { duration: 1300 });
    } catch {
      toast.error('Não foi possível salvar a nova posição.');
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [data-no-card-swipe="true"]')) {
      setIsSwiping(false);
      touchStartX.current = 0;
      touchCurrentX.current = 0;
      return;
    }

    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || touchStartX.current === 0) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    if (diff > 120) setSwipeOffset(120);
    else if (diff < -120) setSwipeOffset(-120);
    else setSwipeOffset(diff);
  };

  const handleTouchEnd = async () => {
    if (!isSwiping || touchStartX.current === 0) {
      setSwipeOffset(0);
      setIsSwiping(false);
      return;
    }

    const diff = touchCurrentX.current - touchStartX.current;
    const finalOffset = swipeOffset;
    setSwipeOffset(0);
    setIsSwiping(false);
    touchStartX.current = 0;
    touchCurrentX.current = 0;

    if (diff < -60 || finalOffset < -50) {
      handleTriggerAction('complete');
    } else if (diff > 60 || finalOffset > 50) {
      handleTriggerAction('expand');
    }
  };

  const isDraggingRight = swipeOffset > 15;
  const isDraggingLeft = swipeOffset < -15;

  return (
    <>
      <div className={clsx(
          "relative overflow-hidden rounded-[22px] transition-all duration-200",
          delivery.completed ? "opacity-65" : "shadow-sm",
          isUrgent && !delivery.completed && "shadow-[0_0_15px_rgba(239,68,68,0.15)] border border-red-500/40",
          isNeighbor && !delivery.completed && "border-sky-500/30",
          isHandleDragging && "z-20 scale-[1.015] border-sky-400/60 shadow-[0_18px_45px_rgba(0,0,0,0.45)]",
          isExpanded ? "bg-zinc-900 border border-sky-500/25 shadow-[0_12px_30px_rgba(0,0,0,0.28)]" : "bg-zinc-900/35 border border-zinc-800/70"
        )}
        style={{ transform: isHandleDragging ? `translateY(${dragOffsetY}px)` : undefined }}
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ transform: `translateX(${swipeOffset}px)` }}
          className={clsx("relative z-10 flex flex-col bg-zinc-900 h-full w-full", !isSwiping && "transition-transform duration-200")}
        >
          <div className={clsx("flex flex-col", isExpanded ? "p-4" : "p-3")}>
            <div className="flex items-start gap-3">
              <div className="relative shrink-0 mt-0.5">
                <span className={clsx("flex items-center justify-center h-10 w-10 rounded-xl border", isIfood ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500")}>
                  {isIfood ? <Smartphone size={19} /> : <Store size={19} />}
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
                      {customer?.name || (isIfood ? 'Cliente iFood' : 'Sem Nome')}
                      {isVIP && <Crown size={12} className="text-amber-500 shrink-0" />}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="text-sm font-black text-emerald-400 tracking-tight shrink-0">
                      {isPrivacyMode ? 'R$ •••••' : `R$ ${delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00'}`}
                    </p>
                  </div>
                </div>

                {/* Linha dos Identificadores com Press & Hold */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {isIfood && delivery.order_id && (
                    <span className="bg-red-500/15 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0">
                      #{delivery.order_id}
                    </span>
                  )}
                  {isIfood && delivery.ifood_id && (
                    <button
                      onClick={() => triggerCopyAndRedirect(delivery.ifood_id!, { offerIfoodPortal: true })}
                      onTouchStart={() => handleTouchStartLongPress(delivery.ifood_id!, true)}
                      onTouchEnd={handleTouchEndLongPress}
                      className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 active:scale-95 text-zinc-300 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 flex items-center gap-1 transition-all"
                    >
                      ID: {delivery.ifood_id} <Copy size={9} className="text-sky-400"/>
                    </button>
                  )}
                  {isIfood && (delivery.confirmation_code || customer?.last_confirmation_code) && (
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

                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 truncate w-full">
                  <MapPin size={12} className="shrink-0 text-zinc-500" />
                  <span className="truncate">{shortAddress}</span>
                  {isUrgent && <span className="ml-1 rounded bg-red-500/20 text-red-400 text-[9px] px-1 font-bold uppercase">Urgente</span>}
                </div>

                {/* VISUALIZAÇÃO COMPACTA */}
                {!isExpanded && (
                  <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-zinc-800/60 w-full">

                    <div className="flex items-center gap-2.5">
                      <a
                        href={delivery.maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.address_string)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-emerald-500/20 bg-emerald-500/[0.07] flex items-center justify-center active:scale-95 transition-all group"
                        title="Ver no Google Maps"
                      >
                        <div className="absolute inset-0 bg-emerald-500/10 opacity-60 group-hover:opacity-100" />
                        <MapIcon size={17} className="text-emerald-400 relative z-10" />
                      </a>

                      <div className="flex flex-col gap-1 truncate flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap truncate">
                          {delivery.is_paid ? (
                            <span className="flex items-center gap-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[10px] font-black shrink-0">
                              <CheckCircle2 size={10} /> Pago App
                            </span>
                          ) : (
                            <span className={clsx("flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-black shrink-0", payment.className)}>
                              <PaymentIcon size={10} />
                              {payment.label === 'Dinheiro'
                                ? `Dinheiro ${delivery.change_for ? `(Troco p/ R$ ${delivery.change_for.toFixed(2).replace('.', ',')})` : ''}`
                                : payment.label === 'Pix' ? 'QR Code Maquininha' : 'Cartão Maquininha'}
                            </span>
                          )}

                          {delivery.drinks && (
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

                    {(delivery.completed || route.status === 'fechada') && (
                      <div className="flex items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-[10px] font-bold text-zinc-500">
                        <GripVertical size={13} />
                        {delivery.completed ? 'Entrega concluída — posição preservada' : 'Rota fechada — ordem bloqueada'}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-2 pt-2 border-t border-zinc-800/40 min-[390px]:grid-cols-[minmax(0,1fr)_auto] min-[390px]:items-center">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
                            copyDeliveryToClipboard(delivery, customer?.name, customer?.last_confirmation_code);
                            toast.success('Entrega copiada com sucesso!');
                          }}
                          className="flex min-w-0 items-center gap-1.5 h-8 px-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40 active:scale-95 text-[11px] font-bold transition-all shadow-sm"
                        >
                          <Copy size={13} className="text-emerald-500" /> Copiar Dados
                        </button>

                        {activePhone && (
                          <a
                            href={`https://wa.me/55${activePhone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Sou o entregador da Da Família Lanches e cheguei no portão com seu pedido.')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 active:scale-90 transition-transform"
                            title="Chamar cliente no WhatsApp"
                          >
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </div>

                      {!delivery.completed && route.status === 'aberta' && (
                        <div className="flex min-w-0 items-center justify-end gap-1.5">
                          <button type="button" onClick={async(e)=>{e.stopPropagation();try{await updateDelivery(delivery.id,{order_locked:!orderLocked,order_source:'manual',order_updated_at:new Date().toISOString()});toast.success(orderLocked?'Parada destravada.':'Parada travada na sequência.')}catch{toast.error('Não foi possível alterar a trava.')}}} className={`flex h-9 items-center rounded-xl border px-2 text-[9px] font-black ${orderLocked?'border-amber-500/30 bg-amber-500/10 text-amber-300':'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{orderLocked?'Destravar':'Travar'}</button>
                          <div className="hidden sm:flex items-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                            <button
                              type="button"
                              disabled={orderLocked}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
                                try { await reorderDelivery(delivery.route_id, delivery.id, 'up'); }
                                catch { toast.error('Não foi possível salvar a nova posição.'); }
                              }}
                              className="flex h-9 w-9 items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-zinc-100 disabled:opacity-30"
                              aria-label="Mover uma posição para cima"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <div className="h-4 w-px bg-zinc-800" />
                            <button
                              type="button"
                              disabled={orderLocked}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
                                try { await reorderDelivery(delivery.route_id, delivery.id, 'down'); }
                                catch { toast.error('Não foi possível salvar a nova posição.'); }
                              }}
                              className="flex h-9 w-9 items-center justify-center text-zinc-500 active:bg-zinc-800 active:text-zinc-100 disabled:opacity-30"
                              aria-label="Mover uma posição para baixo"
                            >
                              <ArrowDown size={13} />
                            </button>
                          </div>

                          <button
                            type="button"
                            data-no-card-swipe="true"
                            disabled={!canReorder || orderLocked}
                            onTouchStart={handleDragStart}
                            onTouchMove={handleDragMove}
                            onTouchEnd={handleDragEnd}
                            onTouchCancel={handleDragEnd}
                            style={{ touchAction: 'none' }}
                            className={clsx(
                              "flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[10px] font-black transition-all",
                              isHandleDragging ? "border-sky-400/60 bg-sky-500/15 text-sky-300" : "border-zinc-800 bg-zinc-950 text-zinc-400",
                              (!canReorder || orderLocked) && "opacity-40"
                            )}
                            aria-label={position ? `Arrastar parada ${position}` : 'Arrastar parada'}
                            title="Segure e arraste para reordenar"
                          >
                            <GripVertical size={14} />
                            <span className="sm:hidden">Mover</span>
                          </button>
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
                <div className="flex items-center gap-2 pl-12 flex-wrap">
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

                <div className="ml-12 mt-1">
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

              {delivery.observation && (
                <div className="ml-14 mr-4 mb-3 rounded-2xl bg-amber-500/5 border border-amber-500/15 px-3.5 py-2.5">
                  <p className="text-xs text-zinc-300">
                    <span className="font-bold text-amber-500">OBS: </span>
                    {delivery.observation}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-zinc-800/80 px-4 py-3 bg-zinc-950/40">
                <div className="flex items-center gap-2 flex-wrap">
                  {delivery.is_paid ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500">
                      <CheckCircle2 size={14} /> Pago no App
                    </span>
                  ) : (
                    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${payment.className}`}>
                      <PaymentIcon size={14} />
                      {payment.label === 'Dinheiro' && delivery.change_for ? `Troco p/ R$ ${isPrivacyMode ? '•••••' : delivery.change_for.toFixed(2).replace('.', ',')}` : payment.label}
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
                      "flex-1 flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg disabled:active:scale-100",
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
                        : 'Dar Baixa'}
                  </button>

                  {activePhone && (
                    <a
                      href={`https://wa.me/55${activePhone.replace(/\D/g, '')}?text=${encodeURIComponent('Olá! Sou o entregador da Da Família Lanches e cheguei com seu pedido no portão.')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 active:scale-90 transition-all"
                      title="Chamar cliente no WhatsApp"
                    >
                      <MessageCircle size={18} />
                    </a>
                  )}

                  <Link
                    href={`/entregas/editar?id=${delivery.id}${operationalDateQuery}`}
                    onClick={async () => { if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light }); }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 active:scale-90 transition-all"
                  >
                    <Pencil size={16} />
                  </Link>

                  <button
                    onClick={async () => {
                      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
                      copyDeliveryToClipboard(delivery, customer?.name, customer?.last_confirmation_code);
                      toast.success('Entrega copiada!');
                    }}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 active:scale-90 transition-all"
                  >
                    <Share2 size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Redirecionamento Direto para o Portal iFood */}
      {confirmRedirectModal.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[28px] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="h-16 w-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center border border-red-500/20 mb-2">
                <CheckSquare size={28} />
              </div>
              <h3 className="font-bold text-lg text-zinc-50">Confirmar no iFood?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed px-2">
                O identificador <strong className="text-zinc-200">"{confirmRedirectModal.copiedText}"</strong> foi copiado. Deseja abrir o portal de confirmações com esses dados?
              </p>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={async () => {
                  if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
                  const targetCode = delivery.confirmation_code || customer?.last_confirmation_code || '';
                  const targetId = delivery.ifood_id || '';
                  const returnTo = confirmationReturn;
                  setConfirmRedirectModal({ isOpen: false, copiedText: '' });
                  router.replace(`/confirmar?orderId=${encodeURIComponent(targetId)}&code=${encodeURIComponent(targetCode)}&returnTo=${encodeURIComponent(returnTo)}`);
                }}
                className="w-full h-12 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <ExternalLink size={16} /> Sim, abrir portal de confirmação
              </button>
              <button
                onClick={() => setConfirmRedirectModal({ isOpen: false, copiedText: '' })}
                className="w-full h-12 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl active:scale-95 transition-all"
              >
                Não, apenas copiar
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal Digitar Código Manual iFood na Baixa */}
      {isIfoodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[28px] border border-zinc-700 bg-zinc-900 p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold text-zinc-50">Código iFood</h3>
                  <p className="text-xs text-zinc-400">Pedido #{delivery.order_id}</p>
                </div>
              </div>
              <button onClick={async () => { if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light }); setIsIfoodModalOpen(false); }} className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-400">Digite os 4 dígitos informados pelo cliente</label>
              <input type="text" inputMode="numeric" maxLength={4} autoFocus placeholder="Ex: 5821" value={inputCode} onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))} className="h-16 w-full rounded-2xl border-2 border-red-500/50 bg-zinc-950 px-4 text-center font-mono text-2xl font-bold tracking-widest text-zinc-50 focus:border-red-500 focus:outline-none transition-colors" />
            </div>

            <div className="flex flex-col gap-2.5">
              <button type="button" onClick={async () => { if (inputCode.length < 4) { if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy }); toast.error('Digite os 4 dígitos ou clique em Pular.'); return; } await executeCompletion(inputCode); }} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                <ShieldCheck size={18} /> Concluir com Código
              </button>
              <button type="button" onClick={async () => { if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light }); await executeCompletion(); }} className="flex h-12 w-full items-center justify-center rounded-2xl bg-zinc-800/80 font-semibold text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all text-sm">
                Pular (Sem Código)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
