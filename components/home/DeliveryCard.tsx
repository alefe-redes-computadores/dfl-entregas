'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { 
  Share2, Banknote, CreditCard, QrCode, CupSoda, CheckCircle2, Pencil, 
  Smartphone, Store, ArrowUp, ArrowDown, AlertTriangle, 
  User, UserRound, Star, Crown, Maximize2, Minimize2, MapPin, ShieldCheck, X
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
  delivery: Delivery;
  customer?: Customer;
  route: Route;
  isNeighbor?: boolean;
}

const PAYMENT_CONFIG = {
  dinheiro: { label: 'Dinheiro', icon: Banknote, className: 'text-amber-500 bg-amber-500/10' },
  pix: { label: 'Pix', icon: QrCode, className: 'text-emerald-500 bg-emerald-500/10' },
  cartao: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10' },
  cartao_credito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10' },
  cartao_debito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10' },
} as const;

export function DeliveryCard({ delivery, customer, route, isNeighbor = false }: DeliveryCardProps) {
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const reorderDelivery = useAppStore((state) => state.reorderDelivery);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode); 
  const closeRoute = useAppStore((state) => state.closeRoute);
  const getDeliveriesByRoute = useAppStore((state) => state.getDeliveriesByRoute);
  const findOrCreateCustomer = useAppStore((state) => state.findOrCreateCustomer);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  // ESTADOS DO MODAL DO IFOOD
  const [isIfoodModalOpen, setIsIfoodModalOpen] = useState(false);
  const [inputCode, setInputCode] = useState('');

  const payment = PAYMENT_CONFIG[delivery.payment_method as keyof typeof PAYMENT_CONFIG] || PAYMENT_CONFIG.dinheiro;
  const PaymentIcon = payment.icon;
  const isIfood = delivery.origin === 'ifood' || !delivery.origin; 
  const isUrgent = (delivery as any).is_urgent; 

  // Função interna que executa a baixa de fato
  const executeCompletion = async (codeToSave?: string) => {
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
    
    const updatePayload: Partial<Delivery> = { completed: true };
    if (codeToSave) {
      updatePayload.confirmation_code = codeToSave;
    }

    await updateDelivery(delivery.id, updatePayload);

    // Se houver código e cliente, atualiza o código no cadastro do cliente também
    if (codeToSave && delivery.customer_id) {
      await findOrCreateCustomer(customer?.name || 'Cliente', { confirmationCode: codeToSave });
    }

    setIsExpanded(false);
    setIsIfoodModalOpen(false);
    setInputCode('');
    toast.success('Baixa Realizada! ✅', { duration: 1500 });

    // Auto-fechamento da rota se for a última pendente
    const routeDeliveries = getDeliveriesByRoute(route.id);
    const remainingPending = routeDeliveries.filter(d => d.id !== delivery.id && !d.completed).length;
    if (remainingPending === 0) {
      closeRoute(route.id);
      toast.success('🎉 Todas entregas concluídas! Rota fechada automaticamente.');
    }
  };

  async function handleToggleCompleted() {
    if (route.status === 'fechada') {
      toast.error('Rota já está fechada!');
      return;
    }
    if (!route.started_at) {
      toast.error('Inicie a rota (Cronômetro) antes de dar baixa!');
      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Heavy });
      return;
    }

    const newStatus = !delivery.completed;

    // Se está desfazendo a baixa, apenas executa
    if (!newStatus) {
      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Medium });
      await updateDelivery(delivery.id, { completed: false });
      toast.success('Baixa desfeita!');
      return;
    }

    // REGRA DO IFOOD: Se for iFood, não tiver código ainda e estiver concluindo, abre o modal bonito
    if (isIfood && !delivery.confirmation_code) {
      setInputCode('');
      setIsIfoodModalOpen(true);
      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
      return;
    }

    // Caso contrário (Loja própria ou iFood que já tem código), conclui direto
    await executeCompletion();
  }

  const SWIPE_THRESHOLD = 75;

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
    setSwipeOffset(0);
    setIsSwiping(false);

    if (diff > SWIPE_THRESHOLD) {
      if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
      setIsExpanded(!isExpanded);
    } else if (diff < -SWIPE_THRESHOLD) {
      handleToggleCompleted();
    }
  };

  const isDraggingRight = swipeOffset > 15;
  const isDraggingLeft = swipeOffset < -15;

  return (
    <>
      <div className={clsx(
          "relative overflow-hidden rounded-[20px] transition-all duration-300",
          delivery.completed ? "opacity-50 grayscale" : "shadow-sm",
          isUrgent && !delivery.completed && "shadow-[0_0_15px_rgba(239,68,68,0.15)] border border-red-500/40",
          isExpanded ? "bg-zinc-900/80 border border-zinc-700/80" : "bg-zinc-900/40 border border-zinc-800/80"
        )}
      >
        {/* BACKGROUND DINÂMICO AO ARRASTAR */}
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

        {/* CONTAINER PRINCIPAL DO CARD */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ transform: `translateX(${swipeOffset}px)` }}
          className={clsx(
            "relative z-10 flex flex-col bg-zinc-900 h-full w-full",
            !isSwiping && "transition-transform duration-200"
          )}
        >
          <div className="flex flex-col p-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className={clsx("flex items-center justify-center h-6 w-6 rounded-full shrink-0 border", isIfood ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500")}>
                  {isIfood ? <Smartphone size={12} /> : <Store size={12} />}
                </span>

                <div className="flex flex-col truncate">
                  <p className="font-heading text-sm font-bold tracking-tight text-zinc-50 truncate max-w-[160px]">
                    {isIfood ? `#${delivery.order_id}` : customer?.name || 'Sem Nome'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate">
                    {delivery.completed && <span className="text-emerald-500 font-bold">Entregue •</span>}
                    <span className="truncate">{customer?.neighborhood || 'Sem bairro'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0 gap-0.5">
                <p className="text-sm font-bold text-emerald-400">
                  {isPrivacyMode ? 'R$ •••••' : `R$ ${delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00'}`}
                </p>
                <div className="flex items-center gap-1">
                  {isUrgent && <span className="rounded bg-red-500/20 text-red-400 text-[9px] px-1 font-bold uppercase">Urgente</span>}
                  {isNeighbor && <MapPin size={10} className="text-sky-400" />}
                </div>
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="px-3 pb-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {isIfood && delivery.confirmation_code && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono tracking-wider text-amber-500 font-bold border border-amber-500/20">
                      Conf: {delivery.confirmation_code}
                    </span>
                  )}
                  {isNeighbor && (
                    <span className="flex items-center gap-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-400 uppercase">
                      <MapPin size={10} /> Vizinho
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400">{delivery.address_string}</p>
                <div className="mt-1">
                  <MiniMap address={delivery.address_string} mapsLink={delivery.maps_link} />
                </div>
              </div>

              {delivery.observation && (
                <div className="mx-3 mb-2 rounded-[12px] bg-amber-500/5 border border-amber-500/10 px-2.5 py-1.5">
                  <p className="text-[11px] text-zinc-300">
                    <span className="font-bold text-amber-500">OBS: </span>
                    {delivery.observation}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-zinc-800/80 px-3 py-2.5 bg-zinc-950/30">
                <div className="flex items-center gap-1.5">
                  {delivery.is_paid ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-500"><CheckCircle2 size={12} /> Pago</span>
                  ) : (
                    <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${payment.className}`}>
                      <PaymentIcon size={12} />{payment.label === 'Dinheiro' && delivery.change_for ? `Troco p/ R$ ${isPrivacyMode ? '•••••' : delivery.change_for.toFixed(2).replace('.', ',')}` : payment.label}
                    </span>
                  )}
                  {delivery.drinks && <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400"><CupSoda size={12} />{delivery.drinks}</span>}
                </div>

                <div className="flex items-center gap-1.5 mt-0.5">
                  <button onClick={handleToggleCompleted} className={clsx("flex-1 flex h-9 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold transition-all active:scale-95", delivery.completed ? "bg-zinc-800 text-zinc-400 border border-zinc-700" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20")}>
                    <CheckCircle2 size={14} />{delivery.completed ? 'Desfazer' : 'Dar Baixa'}
                  </button>

                  {!delivery.completed && (
                    <div className="flex bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden shrink-0">
                      <button onClick={() => reorderDelivery(delivery.route_id, delivery.id, 'up')} className="flex h-9 w-8 items-center justify-center text-zinc-400 hover:text-zinc-200 active:bg-zinc-600"><ArrowUp size={14} /></button>
                      <div className="w-[1px] bg-zinc-700/50" />
                      <button onClick={() => reorderDelivery(delivery.route_id, delivery.id, 'down')} className="flex h-9 w-8 items-center justify-center text-zinc-400 hover:text-zinc-200 active:bg-zinc-600"><ArrowDown size={14} /></button>
                    </div>
                  )}

                  <Link href={`/entregas/details?id=${delivery.id}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:scale-90"><Pencil size={14} /></Link>
                  <button onClick={() => copyDeliveryToClipboard(delivery, customer?.name)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 hover:bg-zinc-700 active:scale-90"><Share2 size={14} strokeWidth={2.5} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL BONITO PARA DIGITAR O CÓDIGO DE CONFIRMAÇÃO DO IFOOD */}
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
              <button 
                onClick={async () => {
                  if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
                  setIsIfoodModalOpen(false);
                }} 
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-400">Digite os 4 dígitos informados pelo cliente</label>
              <input 
                type="text"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                placeholder="Ex: 5821"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                className="h-16 w-full rounded-2xl border-2 border-red-500/50 bg-zinc-950 px-4 text-center font-mono text-2xl font-bold tracking-widest text-zinc-50 focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-2.5">
              <button 
                type="button"
                onClick={async () => {
                  if (inputCode.length < 4) {
                    toast.error('Digite os 4 dígitos ou clique em Pular.');
                    return;
                  }
                  if (Capacitor.isNativePlatform()) await Haptics.notification({ type: 'SUCCESS' as any });
                  await executeCompletion(inputCode);
                }}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <ShieldCheck size={18} /> Concluir com Código
              </button>

              <button 
                type="button"
                onClick={async () => {
                  if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
                  await executeCompletion(); // Pula sem código e conclui
                }}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-zinc-800/80 font-semibold text-zinc-300 hover:bg-zinc-800 active:scale-95 transition-all text-sm"
              >
                Pular (Sem Código)
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
