// app/confirmar/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useAppStore } from '@/store/useAppStore';

const onlyDigits = (value: string, max: number) =>
  value.replace(/\D/g, '').slice(0, max);

const safeInternalReturnTo = (value: string | null) =>
  value && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/confirmacoes';

const IFOOD_CONFIRMATION_URL =
  'https://confirmacao-entrega-propria.ifood.com.br';

function ConfirmarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialOrderId = useMemo(
    () => onlyDigits(searchParams.get('orderId') || '', 8),
    [searchParams]
  );
  const initialCode = useMemo(
    () => onlyDigits(searchParams.get('code') || '', 4),
    [searchParams]
  );
  const returnTo = safeInternalReturnTo(searchParams.get('returnTo'));
  const pendingId = searchParams.get('pendingId') || '';

  const updatePendingConfirmation = useAppStore(
    (state) => state.updateIfoodPendingConfirmation,
  );
  const updateDelivery = useAppStore((state) => state.updateDelivery);
  const updateCustomer = useAppStore((state) => state.updateCustomer);
  const deliveries = useAppStore((state) => state.deliveries);
  const customers = useAppStore((state) => state.customers);

  const pendingConfirmations = useAppStore(
    (state) => state.ifoodPendingConfirmations,
  );

  const [orderId, setOrderId] = useState(initialOrderId);
  const [code, setCode] = useState(initialCode);
  const [copiedFirstValue, setCopiedFirstValue] = useState(false);

  useEffect(() => {
    setOrderId(initialOrderId);
    setCode(initialCode);
    setCopiedFirstValue(false);
  }, [initialOrderId, initialCode]);

  useEffect(() => {
    if (initialOrderId.length !== 8 || copiedFirstValue) return;

    const copyInitialId = async () => {
      try {
        await navigator.clipboard.writeText(initialOrderId);
        setCopiedFirstValue(true);
        toast.success('ID do pedido copiado', {
          description: 'Cole os 8 dígitos no portal do iFood.',
          duration: 2200,
        });
      } catch {
        // O botão manual permanece disponível caso o navegador negue clipboard.
      }
    };

    void copyInitialId();
  }, [copiedFirstValue, initialOrderId]);

  const vibrate = async (style: ImpactStyle) => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style });
    }
  };

  const copyToClipboard = async (value: string, label: string) => {
    if (!value) {
      toast.error(`${label} não informado.`);
      return;
    }

    await vibrate(ImpactStyle.Light);
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado.`);
  };

  const leaveConfirmation = async () => {
    await vibrate(ImpactStyle.Light);
    router.replace(returnTo);
  };

  const CODE_REVIEW_MARKER =
    '[iFood] Último código informado não funcionou. Conferir novamente com o cliente.';

  const readyPending = (excludeId = '') => {
    const current = pendingConfirmations.find((item) => item.id === pendingId);
    return pendingConfirmations
      .filter((item) => {
        if (item.id === excludeId || (item.status || 'pending') !== 'pending') return false;
        if (current?.route_id && item.route_id !== current.route_id) return false;
        const id = (item.ifood_id || '').replace(/\D/g, '').slice(0, 8);
        const itemCode = (item.confirmation_code || '').replace(/\D/g, '').slice(0, 4);
        return id.length === 8 && itemCode.length === 4;
      })
      .sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  const goNextOrLeave = (resolvedId: string, message: string) => {
    const next = readyPending(resolvedId)[0];
    if (!next) {
      toast.success(message);
      router.replace(returnTo);
      return;
    }

    const nextId = (next.ifood_id || '').replace(/\D/g, '').slice(0, 8);
    const nextCode = (next.confirmation_code || '').replace(/\D/g, '').slice(0, 4);
    const remaining = readyPending(resolvedId).length;

    toast.success(message, {
      description: `${remaining} confirmação${remaining === 1 ? '' : 'ões'} pronta${remaining === 1 ? '' : 's'} na sequência.`,
    });

    router.replace(
      `/confirmar?orderId=${encodeURIComponent(nextId)}&code=${encodeURIComponent(nextCode)}&pendingId=${encodeURIComponent(next.id)}&returnTo=${encodeURIComponent(returnTo)}`,
    );
  };

  const confirmExternalAndLeave = async () => {
    if (!pendingId) {
      await leaveConfirmation();
      return;
    }

    try {
      await vibrate(ImpactStyle.Medium);
      const currentPending = pendingConfirmations.find((item) => item.id === pendingId);
      const delivery = currentPending?.delivery_id
        ? deliveries.find((item) => item.id === currentPending.delivery_id)
        : undefined;
      const customer = delivery?.customer_id
        ? customers.find((item) => item.id === delivery.customer_id)
        : undefined;
      const validCode = (currentPending?.confirmation_code || code).replace(/\D/g, '').slice(0,4);

      if (customer && validCode.length === 4) {
        const cleanObservation = (customer.observation || '')
          .replace(CODE_REVIEW_MARKER, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
        await updateCustomer(customer.id, {
          last_confirmation_code: validCode,
          observation: cleanObservation || undefined,
        });
      }

      await updatePendingConfirmation(pendingId, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        note: 'Confirmado externamente no iFood.',
      });

      goNextOrLeave(pendingId, 'Confirmado no iFood. Próximo pedido preparado.');
    } catch {
      toast.error('Não foi possível concluir a pendência.');
    }
  };

  const invalidCodeAndContinue = async () => {
    if (!pendingId) {
      toast.error('Esta confirmação não está vinculada a uma pendência.');
      return;
    }

    try {
      await vibrate(ImpactStyle.Heavy);
      const currentPending = pendingConfirmations.find((item) => item.id === pendingId);
      const delivery = currentPending?.delivery_id
        ? deliveries.find((item) => item.id === currentPending.delivery_id)
        : undefined;
      const customer = delivery?.customer_id
        ? customers.find((item) => item.id === delivery.customer_id)
        : undefined;

      if (delivery?.confirmation_code) {
        await updateDelivery(delivery.id, { confirmation_code: undefined });
      }

      if (customer) {
        const currentObservation = (customer.observation || '').trim();
        const observation = currentObservation.includes(CODE_REVIEW_MARKER)
          ? currentObservation
          : [currentObservation, CODE_REVIEW_MARKER].filter(Boolean).join(' · ');

        await updateCustomer(customer.id, {
          last_confirmation_code: undefined,
          observation,
        });
      }

      await updatePendingConfirmation(pendingId, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        confirmation_code: undefined,
        note: 'Código não funcionou no portal; conferir novamente com o cliente na próxima entrega.',
      });

      goNextOrLeave(pendingId, 'Código inválido registrado. Próximo pedido preparado.');
    } catch {
      toast.error('Não foi possível registrar o código inválido.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="safe-top border-b border-zinc-800 bg-zinc-950/95 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={leaveConfirmation}
            aria-label="Voltar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 active:scale-95"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
              Confirmação iFood
            </p>
            <h1 className="truncate font-heading text-base font-black text-zinc-50">
              Portal do entregador
            </h1>
          </div>

          {(orderId || code) && (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-400">
              <ShieldCheck size={12} />
              Dados carregados
            </span>
          )}
        </div>

        {(orderId || code) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => copyToClipboard(orderId, 'ID do pedido')}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 text-left active:scale-[0.98]"
            >
              <span className="block text-[9px] font-black uppercase tracking-wide text-zinc-500">
                ID do pedido
              </span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <strong className="truncate font-mono text-sm text-zinc-100">
                  {orderId || 'Não informado'}
                </strong>
                <Copy size={14} className="shrink-0 text-sky-400" />
              </span>
            </button>

            <button
              onClick={() => copyToClipboard(code, 'Código do cliente')}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 text-left active:scale-[0.98]"
            >
              <span className="block text-[9px] font-black uppercase tracking-wide text-zinc-500">
                Código do cliente
              </span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <strong className="truncate font-mono text-sm text-amber-400">
                  {code || 'Pendente'}
                </strong>
                <Copy size={14} className="shrink-0 text-amber-400" />
              </span>
            </button>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/45 px-3 py-2">
          <p className="text-[10px] leading-relaxed text-zinc-500">
            O ID de 8 dígitos é preparado e copiado ao abrir. O código também fica pronto acima.
            Como o portal do iFood roda em outro domínio, o navegador não permite que o DFL
            preencha os campos internos sozinho.
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => window.open(IFOOD_CONFIRMATION_URL, '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-1.5 text-[10px] font-black text-zinc-300 active:scale-95"
              title="Abrir fora do DFL caso o portal não carregue incorporado"
            >
              <ExternalLink size={12} />
              Externo
            </button>
            <button
              onClick={leaveConfirmation}
              className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black text-emerald-400 active:scale-95"
            >
              <CheckCircle2 size={12} />
              Voltar
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 bg-white">
        {pendingId && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[9px] font-black uppercase tracking-[.14em] text-zinc-500">Resultado no portal</p>
            {readyPending(pendingId).length > 0 && (
              <span className="flex items-center gap-1 text-[9px] font-black text-sky-400">
                +{readyPending(pendingId).length} na sequência <ChevronRight size={11}/>
              </span>
            )}
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={confirmExternalAndLeave}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 text-xs font-black text-zinc-950 active:scale-[0.98]"
            >
              <CheckCircle2 size={15} />
              Funcionou · próximo
            </button>
            <button
              type="button"
              onClick={invalidCodeAndContinue}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-[10px] font-black text-amber-300 active:scale-[0.98]"
              title="Código não funcionou"
              aria-label="Código não funcionou"
            >
              <AlertTriangle size={15}/>
              Código errado
            </button>
          </div>
        </div>
      )}

      <iframe
          src={IFOOD_CONFIRMATION_URL}
          className="absolute inset-0 h-full w-full border-none"
          title="Confirmação iFood"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  );
}

export default function ConfirmarEntregasPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-sm text-zinc-500">
          Abrindo confirmação...
        </div>
      }
    >
      <ConfirmarContent />
    </Suspense>
  );
}
