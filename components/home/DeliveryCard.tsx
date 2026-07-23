'use client';

import Link from 'next/link';
import { Copy, Banknote, CreditCard, QrCode, CupSoda, CheckCircle2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import type { Delivery, Customer } from '@/types';
import { copyDeliveryToClipboard } from '@/lib/whatsapp';
import { MiniMap } from '@/components/deliveries/MiniMap'; // Ajuste o caminho se necessário

interface DeliveryCardProps {
  delivery: Delivery;
  customer?: Customer;
}

const PAYMENT_CONFIG = {
  dinheiro: { label: 'Dinheiro', icon: Banknote, className: 'text-amber-500 bg-amber-500/10' },
  pix: { label: 'Pix', icon: QrCode, className: 'text-emerald-500 bg-emerald-500/10' },
  cartao_credito: { label: 'Cartão Crédito', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10' },
  cartao_debito: { label: 'Cartão Débito', icon: CreditCard, className: 'text-sky-400 bg-sky-400/10' },
} as const;

export function DeliveryCard({ delivery, customer }: DeliveryCardProps) {
  const payment = PAYMENT_CONFIG[delivery.payment_method] || PAYMENT_CONFIG.dinheiro;
  const PaymentIcon = payment.icon;

  async function handleCopy() {
    const success = await copyDeliveryToClipboard(delivery);
    if (success) {
      toast.success('Entrega copiada!', {
        description: `Pedido #${delivery.order_id} pronto pra colar no WhatsApp.`,
      });
    } else {
      toast.error('Não foi possível copiar', {
        description: 'Tenta novamente ou copia manualmente.',
      });
    }
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm">
      <div className="flex flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">

            {/* Número do Pedido */}
            <div className="flex items-baseline gap-2">
              <p className="font-heading text-3xl font-bold tracking-tight text-zinc-50">
                #{delivery.order_id}
              </p>
              {delivery.confirmation_code && (
                <p className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono tracking-wider text-zinc-400">
                  Conf: {delivery.confirmation_code}
                </p>
              )}
            </div>

            {/* Valor do Pedido */}
            <p className="mt-1 text-sm font-bold text-emerald-400">
              R$ {delivery.value ? delivery.value.toFixed(2).replace('.', ',') : '0,00'}
            </p>

          </div>
          {delivery.is_paid && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-500">
              <CheckCircle2 size={12} />
              Pago
            </span>
          )}
        </div>

        {customer && (
          <div className="mt-2 flex items-center gap-2">
            <p className="truncate text-sm font-medium text-zinc-300">{customer.name}</p>
            {customer.neighborhood && (
              <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                {customer.neighborhood}
              </span>
            )}
          </div>
        )}
        <p className="mt-1 truncate text-xs text-zinc-500">{delivery.address_string}</p>

        {/* Mini-mapa integrado ao card */}
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

      <div className="flex items-center justify-between gap-2 border-t border-zinc-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${payment.className}`}
          >
            <PaymentIcon size={13} />
            {payment.label === 'Dinheiro' && delivery.change_for
              ? `Troco p/ R$ ${delivery.change_for.toFixed(2).replace('.', ',')}`
              : payment.label}
          </span>

          {delivery.drinks && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
              <CupSoda size={13} />
              {delivery.drinks}
            </span>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2">
          {/* Navegação por query param (?id=), sem rota dinâmica [id] — compatível com build estático do Capacitor */}
          <Link
            href={`/entregas/details?id=${delivery.id}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition-transform hover:bg-zinc-700 active:scale-90"
          >
            <Pencil size={15} />
          </Link>

          <button
            onClick={handleCopy}
            aria-label="Copiar dados da entrega"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 transition-transform active:scale-90"
          >
            <Copy size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
