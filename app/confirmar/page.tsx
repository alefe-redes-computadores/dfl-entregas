// app/confirmar/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

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
