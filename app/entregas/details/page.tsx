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
  CupSoda,
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
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAppStore } from '@/store/useAppStore';
import {
  fulfillmentLabel,
  getFulfillmentMode,
  isDeliveryFulfillment,
} from '@/lib/delivery-mode';
import { firstValidTimestamp, type TimestampLike } from '@/lib/reports/time';

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
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDrinkCheckOpen, setIsDrinkCheckOpen] = useState(false);
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
  const isIfood = delivery.origin === 'ifood' || !delivery.origin;
  const savedConfirmationCode =
    delivery.confirmation_code || customer?.last_confirmation_code || '';
  const routeIsClosed = logistics && route?.status === 'fechada';
  const routeNotStarted = logistics && route?.status === 'aberta' && !route.started_at;

  const vibrate = async (style: ImpactStyle) => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style });
    }
  };

  const openWhatsApp = () => {
    if (!phone) {
      toast.error('Este cliente não possui telefone cadastrado.');
      return;
    }

    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}`, '_blank');
  };

  const executeCompletion = async (codeToSave?: string) => {
    if (delivery.completed || isCompleting) return;

    setIsCompleting(true);
    const payload = {
      completed: true,
      ...(codeToSave ? { confirmation_code: codeToSave } : {}),
    };

    try {
      await updateDelivery(delivery.id, payload);
      await vibrate(ImpactStyle.Medium);
      setIsDrinkCheckOpen(false);
      setIsIfoodModalOpen(false);
      setInputCode('');
      toast.success(
        mode === 'pickup'
          ? 'Retirada concluída.'
          : mode === 'counter'
            ? 'Pedido de balcão concluído.'
            : 'Entrega concluída com sucesso.',
      );
    } catch {
      await vibrate(ImpactStyle.Heavy);
      toast.error('Não foi possível concluir o pedido.', {
        description: 'O estado anterior foi restaurado. Tente novamente.',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const handleCompletionAction = async () => {
    if (isCompleting) return;
    await vibrate(ImpactStyle.Light);

    if (delivery.completed) {
      if (routeIsClosed) {
        toast.error('Reabra a rota antes de desfazer esta baixa.', {
          description: 'Isso evita deixar uma rota fechada com entrega pendente.',
        });
        return;
      }

      setIsCompleting(true);
      try {
        await updateDelivery(delivery.id, { completed: false });
        toast.success('Baixa desfeita.');
      } catch {
        toast.error('Não foi possível desfazer a baixa.');
      } finally {
        setIsCompleting(false);
      }
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
      if (!route.started_at) {
        toast.error('Inicie a rota antes de dar baixa nesta entrega.');
        return;
      }
    }

    if (delivery.drinks) {
      setIsDrinkCheckOpen(true);
      return;
    }

    if (isIfood && !savedConfirmationCode) {
      setInputCode('');
      setIsIfoodModalOpen(true);
      return;
    }

    await executeCompletion(savedConfirmationCode);
  };

  const continueAfterDrinkCheck = async () => {
    if (isIfood && !savedConfirmationCode) {
      setIsDrinkCheckOpen(false);
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
          onClick={() => router.push(`/entregas/editar?id=${delivery.id}${dateSuffix}`)}
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

        {delivery.drinks && (
          <InfoRow icon={CupSoda} label="Bebidas" value={delivery.drinks} />
        )}

        {delivery.observation && (
          <InfoRow icon={AlertTriangle} label="Observações" value={delivery.observation} />
        )}
      </section>

      <section className={`rounded-[24px] border p-4 ${
        delivery.completed
          ? 'border-emerald-500/20 bg-emerald-500/[.045]'
          : 'border-zinc-800 bg-zinc-900/35'
      }`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
              Baixa operacional
            </p>
            <p className="mt-1 text-sm font-black text-zinc-100">
              {delivery.completed ? 'Pedido já concluído' : 'Finalizar atendimento'}
            </p>
          </div>
          {logistics && (
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${
              routeIsClosed
                ? 'bg-emerald-500/10 text-emerald-400'
                : routeNotStarted
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-sky-500/10 text-sky-400'
            }`}>
              {routeIsClosed ? 'Rota fechada' : routeNotStarted ? 'Rota não iniciada' : 'Rota ativa'}
            </span>
          )}
        </div>

        <button
          onClick={handleCompletionAction}
          disabled={isCompleting}
          className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-black active:scale-[0.98] disabled:opacity-60 ${
            delivery.completed
              ? 'border border-zinc-700 bg-zinc-900 text-zinc-300'
              : 'bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/15'
          }`}
        >
          <CheckCircle2 size={19} />
          {isCompleting
            ? 'Salvando...'
            : delivery.completed
              ? 'Desfazer baixa'
              : mode === 'pickup'
                ? 'Concluir retirada'
                : mode === 'counter'
                  ? 'Concluir pedido'
                  : 'Concluir entrega'}
        </button>

        {delivery.completed && routeIsClosed && (
          <p className="mt-2 text-center text-[10px] leading-relaxed text-zinc-600">
            Para desfazer esta baixa, reabra a rota primeiro.
          </p>
        )}
      </section>

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
          value={dateTime(delivery.created_at, delivery.createdAt)}
        />

        <InfoRow
          icon={CheckCircle2}
          label="Conclusão"
          value={delivery.completed ? dateTime(delivery.completed_at) : 'Ainda pendente'}
        />

        {delivery.ifood_id && (
          <InfoRow
            icon={Smartphone}
            label="ID iFood"
            value={delivery.ifood_id}
          />
        )}

        {(delivery.confirmation_code || customer?.last_confirmation_code) && (
          <InfoRow
            icon={ShieldCheck}
            label="Código de confirmação"
            value={delivery.confirmation_code || customer?.last_confirmation_code || ''}
          />
        )}
      </section>

      {isDrinkCheckOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-[32px] border border-sky-500/30 bg-zinc-900 p-6 shadow-2xl">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-sky-500/20 bg-sky-500/10 text-sky-400">
                <CupSoda size={26} />
              </div>
              <h3 className="mt-3 font-heading text-lg font-black text-zinc-50">
                Conferir bebidas
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Confirme os itens de geladeira antes de concluir o atendimento.
              </p>
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-sm font-black text-sky-400">
                {delivery.drinks}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={continueAfterDrinkCheck}
                disabled={isCompleting}
                className="rounded-2xl bg-emerald-500 px-4 py-3.5 font-black text-zinc-950 active:scale-95 disabled:opacity-60"
              >
                Bebidas conferidas
              </button>
              <button
                type="button"
                onClick={() => setIsDrinkCheckOpen(false)}
                className="h-12 rounded-2xl bg-zinc-800 font-bold text-zinc-400 active:scale-95"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

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
