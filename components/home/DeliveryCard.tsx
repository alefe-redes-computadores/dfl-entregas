'use client';

import Link from 'next/link';
import { Copy, Banknote, CreditCard, QrCode, CupSoda, CheckCircle2, Pencil, Smartphone, Store, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';
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
  const isPrivacyMode = useAppStore((state) => state.isPrivacyMode); // <-- MODO PRIVACIDADE IMPORTADO
  
  const payment = PAYMENT_CONFIG[delivery.payment_method as keyof typeof PAYMENT_CONFIG] || PAYMENT_CONFIG.dinheiro;
  const PaymentIcon = payment.icon;
  const isIfood = delivery.origin === 'ifood' || !delivery.origin; 

  async function handleCopy() {
    const success = await copyDeliveryToClipboard(delivery);
    if (success) {
      toast.success('Entrega copiada!', { description: 'Pronto pra colar no WhatsApp.' });
    } else {
      toast.error('Não foi possível copiar', { description: 'Tenta novamente ou copia manualmente.' });
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
        "overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm transition-all duration-500",
        delivery.completed && "opacity-50 grayscale"
      )}
    >
      <div className="flex flex-col p-4">
        <div className="flex justify-between items-center mb-3">
          {isIfood ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider">
              <Smartphone size={12} /> iFood
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider">
              <Store size={12} /> Loja Própria
            </span>
          )}

          <div className="flex items-center gap-2">
            {delivery.completed && (
              <span className="flex items-center gap-1 rounded-full bg-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-300">
                <CheckCircle size={12} /> Entregue
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              {isIfood ? (
                <>
                  <p className="font-heading text-3xl font-bold tracking-tight text-zinc-50">
                    #{delivery.order_id}
                  </p>
                  {delivery.confirmation_code && (
                    <p className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono tracking-wider text-zinc-400">
                      Conf: {delivery.confirmation_code}
                    </p>
                  )}
                </>
              ) : (
                <p className="font-heading text-2xl font-bold tracking-tight text-zinc-50 truncate max-w-[200px]">
                  {customer?.name || 'Sem Nome'}
                </p>
              )}
            </div>
            {/* VALOR DA ENTREGA OCULTADO */}
            <p className="mt-1 text-sm font-bold text-emerald-400">
              {isPrivacyMode 
                ? 'R$ •••••' 
                : `R$ ${delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00'}`
              }
            </p>
          </div>
        </div>

        {customer && isIfood && (
          <div className="mt-2 flex items-center gap-2">
            <p className="truncate text-sm font-medium text-zinc-300">{customer.name}</p>
            {customer.neighborhood && (
              <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                {customer.neighborhood}
              </span>
            )}
          </div>
        )}

        <p className={`truncate text-xs text-zinc-500 ${!isIfood ? 'mt-2' : 'mt-1'}`}>{delivery.address_string}</p>

        <MiniMap address={delivery.address_string} mapsLink={delivery.maps_link} />
      </div>

      {delivery.observation && (
        <div className="mx-4 mb-3 rounded-[14px] bg-zinc-800/60 px-3 py-2">
          <p className="text-xs text-zinc-400">
            <span className="font-semibold text-zinc-300">OBS: </span>
            {delivery.observation}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          {delivery.is_paid ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500">
              <CheckCircle2 size={13} />
              Pago
            </span>
          ) : (
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${payment.className}`}>
              <PaymentIcon size={13} />
              {/* VALOR DO TROCO OCULTADO */}
              {payment.label === 'Dinheiro' && delivery.change_for 
                ? `Troco p/ R$ ${isPrivacyMode ? '•••••' : delivery.change_for.toFixed(2).replace('.', ',')}` 
                : payment.label}
            </span>
          )}

          {delivery.drinks && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
              <CupSoda size={13} />
              {delivery.drinks}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button 
            onClick={handleToggleCompleted} 
            className={clsx(
              "flex-1 flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all active:scale-95",
              delivery.completed 
                ? "bg-zinc-800 text-zinc-400 border border-zinc-700" 
                : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
            )}
          >
            <CheckCircle2 size={16} />
            {delivery.completed ? 'Desfazer' : 'Concluída'}
          </button>

          {!delivery.completed && (
            <div className="flex bg-zinc-800/60 border border-zinc-700/50 rounded-xl overflow-hidden shrink-0">
              <button onClick={() => reorderDelivery(delivery.route_id, delivery.id, 'up')} className="flex h-10 w-9 items-center justify-center text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors active:bg-zinc-600">
                <ArrowUp size={16} />
              </button>
              <div className="w-[1px] bg-zinc-700/50" />
              <button onClick={() => reorderDelivery(delivery.route_id, delivery.id, 'down')} className="flex h-10 w-9 items-center justify-center text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors active:bg-zinc-600">
                <ArrowDown size={16} />
              </button>
            </div>
          )}

          <Link href={`/entregas/details?id=${delivery.id}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300 transition-transform hover:bg-zinc-700 active:scale-90">
            <Pencil size={15} />
          </Link>
          <button onClick={handleCopy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 transition-transform active:scale-90 shadow-lg shadow-emerald-500/20">
            <Copy size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
