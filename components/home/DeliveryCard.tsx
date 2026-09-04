'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Share2, Banknote, CreditCard, QrCode, CupSoda, CheckCircle2, Pencil, 
  Smartphone, Store, ArrowUp, ArrowDown, MapPin, ShieldCheck, X, Maximize2, Minimize2, Navigation, MessageCircle, AlertTriangle, Copy, Crown, ExternalLink, Map as MapIcon, CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { Delivery, Customer, Route } from '@/types';
import { copyDeliveryToClipboard } from '@/lib/whatsapp';
import { MiniMap } from '@/components/deliveries/MiniMap';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface DeliveryCardProps {
  delivery: Delivery & { is_expanded?: boolean };
  customer?: Customer;
  route: Route;
  isNeighbor?: boolean;
}

const PAYMENT_CONFIG = {
  dinheiro: { label: 'Dinheiro', icon: Banknote, className: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  pix: { label: 'Pix', icon: QrCode, className: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  cartao: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  cartao_credito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  cartao_debito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
} as const;

export function DeliveryCard({ delivery, customer, route, isNeighbor = false }: DeliveryCardProps) {
  const router = useRouter();
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const reorderDelivery = useAppStore((state) => state.reorderDelivery);
  const toggleDeliveryExpansion = useAppStore((state) => state.toggleDeliveryExpansion);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode); 
  const closeRoute = useAppStore((state) => state.closeRoute);
  const getDeliveriesByRoute = useAppStore((state) => state.getDeliveriesByRoute);
  const findOrCreateCustomer = useAppStore((state) => state.findOrCreateCustomer);
  
  const isExpanded = delivery.is_expanded || false;

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const [isIfoodModalOpen, setIsIfoodModalOpen] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [confirmRedirectModal, setConfirmRedirectModal] = useState<{isOpen: boolean, copiedText: string}>({ isOpen: false, copiedText: '' });
  const [isDrinkCheckOpen, setIsDrinkCheckOpen] = useState(false);

  const payment = PAYMENT_CONFIG[delivery.payment_method as keyof typeof PAYMENT_CONFIG] || PAYMENT_CONFIG.dinheiro;
  const PaymentIcon = payment.icon;
  const isIfood = delivery.origin === 'ifood' || !delivery.origin; 
  const isUrgent = delivery.is_urgent; 
  const isVIP = (customer?.orderCount || 0) >= 5;

  const shortAddress = delivery.address_string.split('-')[0].trim();
  const hasCoordinatesOrLink = !!(customer?.maps_link || delivery.maps_link);
  const hasStreetNumber = /\d/.test(delivery.address_string);
  const activePhone = delivery.phone || customer?.phone;

  const triggerCopyAndRedirect = async (textToCopy: string) => {
    if (!textToCopy) return;
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
    await navigator.clipboard.writeText(textToCopy);
    toast.success('Copiado para a área de transferência!');
    setConfirmRedirectModal({ isOpen: true, copiedText: textToCopy });
  };

  const handleTouchStartLongPress = (text: string) => {
    longPressTimer.current = setTimeout(() => {
      triggerCopyAndRedirect(text);
    }, 450);
  };

  const handleTouchEndLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const executeCompletion = async (codeToSave?: string) => {
    const updatePayload: Partial<Delivery> = { completed: true };
    if (codeToSave) {
      updatePayload.confirmation_code = codeToSave;
    }

    await updateDelivery(delivery.id, updatePayload);

    if (codeToSave && delivery.customer_id) {
      await findOrCreateCustomer(customer?.name || 'Cliente', { confirmationCode: codeToSave } as any);
    }

    toggleDeliveryExpansion(delivery.id, false);
    setIsIfoodModalOpen(false);
    setIsDrinkCheckOpen(false);
    setInputCode('');
    
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    toast.success('Baixa Realizada! ✅', { duration: 1500 });

    const routeDeliveries = getDeliveriesByRoute(route.id);
    const remainingPending = routeDeliveries.filter(d => d.id !== delivery.id && !d.completed).length;
    if (remainingPending === 0) {
      closeRoute(route.id);
      toast.success('🎉 Todas entregas concluídas! Rota fechada automaticamente.');
    }
  };

  async function handleTriggerAction(actionType: 'complete' | 'expand') {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });

    if (actionType === 'complete') {
      if (route.status === 'fechada') {
        toast.error('Rota já está fechada!');
        return;
      }
      if (!route.started_at) {
        toast.error('Inicie a rota antes de dar baixa!');
        return;
      }

      const newStatus = !delivery.completed;
      if (!newStatus) {
        await updateDelivery(delivery.id, { completed: false });
        toast.success('Baixa desfeita!');
        return;
      }

      // Trava de segurança para bebidas não conferidas
      if (delivery.drinks && !delivery.completed && !isDrinkCheckOpen) {
        setIsDrinkCheckOpen(true);
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    if (diff > 120) setSwipeOffset(120);
    else if (diff < -120) setSwipeOffset(-120);
    else setSwipeOffset(diff);
  };

  const handleTouchEnd = async () => {
    const diff = touchCurrentX.current - touchStartX.current;
    const finalOffset = swipeOffset;
    setSwipeOffset(0);
    setIsSwiping(false);

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
          "relative overflow-hidden rounded-[26px] transition-all duration-300",
          delivery.completed ? "opacity-50 grayscale" : "shadow-sm",
          isUrgent && !delivery.completed && "shadow-[0_0_15px_rgba(239,68,68,0.15)] border border-red-500/40",
          isNeighbor && !delivery.completed && "border-sky-500/30",
          isExpanded ? "bg-zinc-900/90 border border-zinc-700/80" : "bg-zinc-900/45 border border-zinc-800/80"
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
            <span className="text-xs">Dar Baixa</span>
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
          <div className="flex flex-col p-4">
            <div className="flex items-start gap-3">
              <span className={clsx("flex items-center justify-center h-11 w-11 rounded-full shrink-0 border mt-0.5", isIfood ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500")}>
                {isIfood ? <Smartphone size={19} /> : <Store size={19} />}
              </span>

              <div className="flex flex-col flex-1 truncate">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                    <p className="font-heading text-base font-bold tracking-tight text-zinc-50 truncate flex items-center gap-1">
                      {customer?.name || (isIfood ? 'Cliente iFood' : 'Sem Nome')}
                      {isVIP && <Crown size={12} className="text-amber-500 shrink-0" />}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="text-[15px] font-black text-emerald-400 tracking-tight shrink-0">
                      {isPrivacyMode ? 'R$ •••••' : `R$ ${delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00'}`}
                    </p>
                  </div>
                </div>
                
                {/* Linha dos Identificadores com Press & Hold */}
                <div className="flex items-center gap-1.5 mt-1 mb-1.5 flex-wrap">
                  {isIfood && delivery.order_id && (
                    <span className="bg-red-500/15 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0">
                      #{delivery.order_id}
                    </span>
                  )}
                  {isIfood && delivery.ifood_id && (
                    <button 
                      onClick={() => triggerCopyAndRedirect(delivery.ifood_id!)}
                      onTouchStart={() => handleTouchStartLongPress(delivery.ifood_id!)}
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
                  <span className="truncate">{shortAddress} {customer?.neighborhood ? `- ${customer.neighborhood}` : ''}</span>
                  {isUrgent && <span className="ml-1 rounded bg-red-500/20 text-red-400 text-[9px] px-1 font-bold uppercase">Urgente</span>}
                </div>

                {/* VISUALIZAÇÃO COMPACTA */}
                {!isExpanded && (
                  <div className="flex flex-col gap-2.5 mt-2.5 pt-2.5 border-t border-zinc-800/60 w-full">
                    
                    <div className="flex items-center gap-2.5">
                      <a
                        href={delivery.maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(delivery.address_string)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative h-12 w-20 shrink-0 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center active:scale-95 transition-all shadow-inner group"
                        title="Ver no Google Maps"
                      >
                        <div className="absolute inset-0 bg-emerald-500/10 opacity-60 group-hover:opacity-100" />
                        <MapIcon size={14} className="text-emerald-400 relative z-10" />
                        <span className="absolute bottom-1 text-[8px] font-black tracking-tighter text-zinc-400 z-10 uppercase">MAPS ↗</span>
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
                              Vizinho / Mesmo Local
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/40">
                      <div className="flex items-center gap-1.5">
                        <button 
                          type="button"
                          onClick={async (e) => { 
                            e.stopPropagation(); 
                            if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light }); 
                            copyDeliveryToClipboard(delivery, customer?.name, customer?.last_confirmation_code); 
                            toast.success('Entrega copiada com sucesso!');
                          }} 
                          className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 hover:text-emerald-400 hover:border-emerald-500/40 active:scale-95 text-xs font-bold transition-all shadow-sm"
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

                      {!delivery.completed && (
                        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shrink-0 shadow-sm">
                          <button 
                            type="button"
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light }); 
                              reorderDelivery(delivery.route_id, delivery.id, 'up'); 
                            }} 
                            className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-zinc-100 active:bg-zinc-800 transition-colors"
                            title="Mover para cima"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <div className="w-[1px] h-4 bg-zinc-800" />
                          <button 
                            type="button"
                            onClick={async (e) => { 
                              e.stopPropagation(); 
                              if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light }); 
                              reorderDelivery(delivery.route_id, delivery.id, 'down'); 
                            }} 
                            className="flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-zinc-100 active:bg-zinc-800 transition-colors"
                            title="Mover para baixo"
                          >
                            <ArrowDown size={13} />
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
                      ⚠️ Sem número residencial
                    </span>
                  ) : null}
                </div>

                <div className="ml-12 mt-1">
                  <MiniMap address={delivery.address_string} mapsLink={delivery.maps_link} />
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
                    className={clsx(
                      "flex-1 flex h-12 items-center justify-center gap-2 rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-lg", 
                      delivery.completed ? "bg-zinc-800 text-zinc-400 border border-zinc-700 shadow-none" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-emerald-500/5"
                    )}
                  >
                    <CheckCircle2 size={16} />{delivery.completed ? 'Desfazer Baixa' : 'Dar Baixa'}
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
                    href={`/entregas/details?id=${delivery.id}`} 
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
          <div className="w-full max-w-sm rounded-[32px] border border-zinc-800 bg-zinc-900 p-6 shadow-2xl flex flex-col gap-4">
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
                  setConfirmRedirectModal({ isOpen: false, copiedText: '' });
                  router.push(`/confirmar?orderId=${encodeURIComponent(targetId)}&code=${encodeURIComponent(targetCode)}`); 
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

      {/* Trava de Conferência de Bebidas antes de Dar Baixa */}
      {isDrinkCheckOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[32px] border border-sky-500/30 bg-zinc-900 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex flex-col items-center justify-center text-center gap-2">
              <div className="h-14 w-14 bg-sky-500/10 text-sky-400 rounded-full flex items-center justify-center border border-sky-500/20 mb-1">
                <CupSoda size={26} />
              </div>
              <h3 className="font-bold text-lg text-zinc-50">Conferência de Bebida</h3>
              <p className="text-xs text-zinc-400">Esta entrega inclui itens de geladeira:</p>
              <div className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl font-bold text-sm text-sky-400">
                🥤 {delivery.drinks}
              </div>
            </div>

            <div className="flex flex-col gap-2 mt-2">
              <button 
                onClick={async () => {
                  if (isIfood && !delivery.confirmation_code && !customer?.last_confirmation_code) {
                    setIsDrinkCheckOpen(false);
                    setIsIfoodModalOpen(true);
                  } else {
                    const code = delivery.confirmation_code || customer?.last_confirmation_code;
                    await executeCompletion(code);
                  }
                }}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black rounded-xl active:scale-95 transition-all shadow-lg"
              >
                Bebida Entregue / Conferida
              </button>
              <button 
                onClick={() => setIsDrinkCheckOpen(false)}
                className="w-full h-11 bg-zinc-800 text-zinc-400 font-semibold rounded-xl active:scale-95 transition-all text-xs"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Digitar Código Manual iFood na Baixa */}
      {isIfoodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-[32px] border border-zinc-700 bg-zinc-900 p-6 shadow-2xl flex flex-col gap-5">
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