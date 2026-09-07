// app/entregas/details/page.tsx
'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Banknote,
  Bike,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  CreditCard,
  Edit3,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  QrCode,
  ShoppingBag,
  Smartphone,
  Store,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import {
  fulfillmentLabel,
  getFulfillmentMode,
  isDeliveryFulfillment,
} from '@/lib/delivery-mode';

const money = (value = 0) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const dateTime = (value?: string) =>
  value ? new Date(value).toLocaleString('pt-BR') : 'Não registrado';

function DeliveryDetailsContent() {
  const router = useRouter();
  const id = useSearchParams().get('id');
  const delivery = useAppStore((state) => state.deliveries.find((item) => item.id === id));
  const route = useAppStore((state) =>
    state.routes.find((item) => item.id === delivery?.route_id),
  );
  const customer = useAppStore((state) =>
    state.customers.find((item) => item.id === delivery?.customer_id),
  );
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const [isCompleting, setIsCompleting] = useState(false);

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
          onClick={() => router.replace('/entregas')}
          className="rounded-xl bg-zinc-800 px-4 py-3 text-sm font-bold text-zinc-200"
        >
          Voltar aos pedidos
        </button>
      </div>
    );
  }

  const name = customer?.name || delivery.customer_name || 'Cliente não informado';
  const phone = delivery.phone || customer?.phone;
  const mode = getFulfillmentMode(delivery);
  const logistics = isDeliveryFulfillment(delivery);
  const modeLabel = fulfillmentLabel(delivery);
  const ModeIcon = mode === 'pickup' ? ShoppingBag : mode === 'counter' ? Store : Bike;

  const mapsUrl = logistics
    ? delivery.maps_link ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        delivery.address_string,
      )}`
    : '';

  const paymentIcon =
    delivery.payment_method === 'dinheiro'
      ? Banknote
      : delivery.payment_method === 'pix'
        ? QrCode
        : CreditCard;

  const PaymentIcon = paymentIcon;

  const openWhatsApp = () => {
    if (!phone) {
      toast.error('Este cliente não possui telefone cadastrado.');
      return;
    }

    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}`, '_blank');
  };

  const completeOrder = async () => {
    if (delivery.completed || isCompleting) return;

    setIsCompleting(true);
    try {
      await updateDelivery(delivery.id, { completed: true });
      toast.success(
        mode === 'pickup'
          ? 'Retirada concluída.'
          : mode === 'counter'
            ? 'Pedido de balcão concluído.'
            : 'Entrega concluída com sucesso.',
      );
    } catch {
      toast.error('Não foi possível concluir o pedido.', {
        description: 'Confira a conexão e tente novamente.',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-28 animate-in fade-in duration-300">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.replace('/entregas')}
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
          onClick={() => router.push(`/entregas/editar?id=${delivery.id}`)}
          className="flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-xs font-black text-zinc-950"
        >
          <Edit3 size={15} />
          Editar
        </button>
      </header>

      <section
        className={`rounded-[26px] border p-5 ${
          delivery.completed
            ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
            : 'border-amber-500/25 bg-amber-500/[0.05]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                delivery.origin === 'ifood'
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {delivery.origin === 'ifood' ? <Smartphone /> : <Store />}
            </div>

            <div>
              <p className="text-xs font-bold uppercase text-zinc-500">
                {delivery.origin === 'ifood' ? 'Pedido iFood' : 'Pedido da loja'}
              </p>
              <p className="mt-0.5 text-lg font-black text-zinc-100">
                {delivery.order_id ? `#${delivery.order_id}` : 'Sem número'}
              </p>
            </div>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
              delivery.completed
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {delivery.completed ? 'Concluído' : 'Pendente'}
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

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase text-zinc-500">Valor</p>
            <p className="text-xl font-black text-emerald-400">{money(delivery.value)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-zinc-500">Pagamento</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold capitalize text-zinc-200">
              <PaymentIcon size={15} />
              {delivery.is_paid ? 'Pago no app' : delivery.payment_method}
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-900/40">
        <InfoRow icon={UserRound} label="Cliente" value={name} />
        <InfoRow icon={Phone} label="Contato" value={phone || 'Não informado'} />

        {logistics && (
          <InfoRow
            icon={MapPin}
            label="Endereço"
            value={delivery.address_string || 'Não informado'}
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

        {delivery.observation && (
          <InfoRow icon={AlertTriangle} label="Observações" value={delivery.observation} />
        )}
      </section>

      {!delivery.completed && (
        <button
          onClick={completeOrder}
          disabled={isCompleting}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950 shadow-lg shadow-emerald-500/15 active:scale-[0.98] disabled:opacity-60"
        >
          <CheckCircle2 size={19} />
          {isCompleting
            ? 'Concluindo...'
            : mode === 'pickup'
              ? 'Concluir retirada'
              : mode === 'counter'
                ? 'Concluir pedido'
                : 'Concluir entrega'}
        </button>
      )}

      <div className={`grid gap-3 ${logistics ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {logistics && (
          <button
            onClick={() => window.open(mapsUrl, '_blank')}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-sky-500 font-black text-white"
          >
            <Navigation size={18} />
            Abrir Maps
          </button>
        )}

        <button
          onClick={openWhatsApp}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-500 font-black text-zinc-950"
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
          label="Criado em"
          value={dateTime(delivery.created_at || delivery.createdAt)}
        />

        <InfoRow
          icon={CheckCircle2}
          label="Conclusão"
          value={delivery.completed ? dateTime(delivery.completed_at) : 'Ainda pendente'}
        />

        {delivery.confirmation_code && (
          <InfoRow
            icon={Smartphone}
            label="Código de confirmação"
            value={delivery.confirmation_code}
          />
        )}
      </section>
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
