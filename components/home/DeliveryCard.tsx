'use client';

import Link from 'next/link';
import { Share2, Banknote, CreditCard, QrCode, CupSoda, CheckCircle2, Pencil, Smartphone, Store, CheckCircle, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import type { Delivery, Customer } from '@/types';
import { copyDeliveryToClipboard } from '@/lib/whatsapp';
import { MiniMap } from '@/components/deliveries/MiniMap';
import { useAppStore } from '@/store/useAppStore';

interface DeliveryCardProps {
  delivery: Delivery;
  customer?: Customer;
}

const PAYMENT_CONFIG = {
  dinheiro: { label: 'Dinheiro', icon: Banknote, className: 'text-amber-500 bg-amber-500/10' },
  pix: { label: 'Pix', icon: QrCode, className: 'text-emerald-500 bg-emerald-500/10' },
  cartao: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10' },
  cartao_credito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10' },
  cartao_debito: { label: 'Cartão', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10' },
} as const;

export function DeliveryCard({ delivery, customer }: DeliveryCardProps) {
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const reorderDelivery = useAppStore((state) => state.reorderDelivery);
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode); 
  
  const payment = PAYMENT_CONFIG[delivery.payment_method as keyof typeof PAYMENT_CONFIG] || PAYMENT_CONFIG.dinheiro;
  const PaymentIcon = payment.icon;
  const isIfood = delivery.origin === 'ifood' || !delivery.origin; 
  const isUrgent = (delivery as any).is_urgent; 

  async function handleCopy() {
    const success = await copyDeliveryToClipboard(delivery, customer?.name);
    if (success) {
      toast.success('Dados copiados!', { description: 'Pronto para enviar ao cliente.' });
    } else {
      toast.error('Não foi possível copiar', { description: 'Tente novamente ou copie manualmente.' });
    }
  }

  async function handleToggleCompleted() {
    await updateDelivery(delivery.id, { completed: !delivery.completed });
    if (!delivery.completed) {
      toast.success('Entrega concluída! ✅', { description: 'Enviada para o fim da fila.' });
    }
  }

  return (
    <div 
      className={clsx(
        "overflow-hidden rounded-[20px] border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm transition-all duration-500",
        delivery.completed && "opacity-50 grayscale",
        isUrgent && !delivery.completed && "border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]"
      )}
    >
      <div className="flex flex-col p-3">
        <div className="flex justify-between items-center mb-2">
          
          <div className="flex items-center gap-1.5">
            {isIfood ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[9px] font-bold uppercase tracking-wider">
                <Smartphone size={10} /> iFood
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-bold uppercase tracking-wider">
                <Store size={10} /> Loja Própria
              </span>
            )}

            {isUrgent && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black uppercase tracking-wider shadow-md shadow-red-500/30">
                <AlertTriangle size={10} /> Urgente
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {delivery.completed && (
              <span className="flex items-center gap-1 rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                <CheckCircle size={10} /> Entregue
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              {isIfood ? (
                <>
                  <p className="font-heading text-xl font-bold tracking-tight text-zinc-50">
                    #{delivery.order_id}
                  </p>
                  {delivery.confirmation_code && (
                    <p className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-mono tracking-wider text-zinc-400">
                      Conf: {delivery.confirmation_code}
                    </p>
                  )}
                </>
              ) : (
                <p className="font-heading text-lg font-bold tracking-tight text-zinc-50 truncate max-w-[200px]">
                  {customer?.name || 'Sem Nome'}
                </p>
              )}
            </div>
            
            <p className="mt-0.5 text-xs font-bold text-emerald-400">
              {isPrivacyMode 
                ? 'R$ •••••' 
                : `R$ ${delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00'}`
              }
            </p>
          </div>
        </div>

        {customer && isIfood && (
          <div className="mt-1.5 flex items-center gap-2">
            <p className="truncate text-xs font-medium text-zinc-300">{customer.name}</p>
            {customer.neighborhood && (
              <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-400">
                {customer.neighborhood}
              </span>
            )}
          </div>
        )}

        <p className={`truncate text-[11px] text-zinc-500 ${!isIfood ? 'mt-1.5' : 'mt-1'}`}>
          {delivery.address_string}
        </p>

        <div className="mt-2">
          <MiniMap address={delivery.address_string} mapsLink={delivery.maps_link} />
        </div>
      </div>

      {delivery.observation && (
        <div className="mx-3 mb-2 rounded-[12px] bg-zinc-800/60 px-2.5 py-1.5">
          <p className="text-[11px] text-zinc-400">
            <span className="font-semibold text-zinc-300">OBS: </span>
            {delivery.observation}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-zinc-800/80 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {delivery.is_paid ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-500">
              <CheckCircle2 size={12} />
              Pago
            </span>
          ) : (
            <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${payment.className}`}>
              <PaymentIcon size={12} />
              {payment.label === 'Dinheiro' && delivery.change_for 
                ? `Troco p/ R$ ${isPrivacyMode ? '•••••' : delivery.change_for.toFixed(2).replace('.', ',')}` 
                : payment.label}
            </span>
          )}

          {delivery.drinks && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
              <CupSoda size={12} />
              {delivery.drinks}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5">
          <button 
            onClick={handleToggleCompleted} 
            className={clsx(
              "flex-1 flex h-9 items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold transition-all active:scale-95",
              delivery.completed 
                ? "bg-zinc-800 text-zinc-400 border border-zinc-700" 
                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
            )}
          >
            <CheckCircle2 size={14} />
            {delivery.completed ? 'Desfazer' : 'Concluída'}
          </button>

          {!delivery.completed && (
            <div className="flex bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden shrink-0">
              <button onClick={() => reorderDelivery(delivery.route_id, delivery.id, 'up')} className="flex h-9 w-8 items-center justify-center text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors active:bg-zinc-600">
                <ArrowUp size={14} />
              </button>
              <div className="w-[1px] bg-zinc-700/50" />
              <button onClick={() => reorderDelivery(delivery.route_id, delivery.id, 'down')} className="flex h-9 w-8 items-center justify-center text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors active:bg-zinc-600">
                <ArrowDown size={14} />
              </button>
            </div>
          )}

          <Link href={`/entregas/details?id=${delivery.id}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 transition-transform hover:bg-zinc-700 active:scale-90">
            <Pencil size={14} />
          </Link>
          <button onClick={handleCopy} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 transition-transform hover:bg-zinc-700 active:scale-90">
            <Share2 size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
