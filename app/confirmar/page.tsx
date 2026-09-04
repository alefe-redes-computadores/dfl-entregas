
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Copy, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

function ConfirmarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialOrderId = searchParams.get('orderId') || '';
  const initialCode = searchParams.get('code') || '';

  const [orderId, setOrderId] = useState(initialOrderId);
  const [code, setCode] = useState(initialCode);

  useEffect(() => {
    if (initialOrderId) setOrderId(initialOrderId);
    if (initialCode) setCode(initialCode);
  }, [initialOrderId, initialCode]);

  const copyToClipboard = async (val: string, label: string) => {
    if (!val) return;
    if (Capacitor.isNativePlatform()) await Haptics.impact({ style: ImpactStyle.Light });
    await navigator.clipboard.writeText(val);
    toast.success(`${label} copiado!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      {/* Header com os dados prontos para colar */}
      <div className="safe-top flex flex-col border-b border-zinc-800 bg-zinc-950 px-4 py-3 gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95"
            >
              <ChevronLeft size={22} />
            </button>
            <div className="flex flex-col">
              <h1 className="font-heading text-base font-bold text-zinc-50">
                DFL Confirmar Entregas
              </h1>
              <p className="text-[11px] text-zinc-500">Portal do Entregador iFood</p>
            </div>
          </div>

          {(orderId || code) && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
              <ShieldCheck size={12} /> Dados Prontos
            </span>
          )}
        </div>

        {(orderId || code) && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => copyToClipboard(orderId, 'ID do Pedido')}
              className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-left active:scale-95 transition-all shadow-sm"
            >
              <div className="flex flex-col truncate pr-1">
                <span className="text-[9px] text-zinc-500 uppercase font-black">ID Pedido (8 dígitos)</span>
                <span className="text-xs font-mono font-bold text-zinc-100 truncate">{orderId || 'Não informado'}</span>
              </div>
              <Copy size={13} className="text-sky-400 shrink-0" />
            </button>

            <button
              onClick={() => copyToClipboard(code, 'Código de Confirmação')}
              className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-left active:scale-95 transition-all shadow-sm"
            >
              <div className="flex flex-col truncate pr-1">
                <span className="text-[9px] text-zinc-500 uppercase font-black">Código (4 dígitos)</span>
                <span className="text-xs font-mono font-bold text-amber-400 truncate">{code || 'Pendente'}</span>
              </div>
              <Copy size={13} className="text-amber-400 shrink-0" />
            </button>
          </div>
        )}
      </div>

      {/* Iframe oficial de Confirmação */}
      <div className="relative flex-1 bg-white">
        <iframe 
          src="https://confirmacao-entrega-propria.ifood.com.br"
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
    <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">Carregando portal...</div>}>
      <ConfirmarContent />
    </Suspense>
  );
}