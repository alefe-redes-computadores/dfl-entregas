'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bike, LoaderCircle, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

function ResolverContent() {
  const router = useRouter();
  const params = useSearchParams();
  const id = String(params.get('id') || '').trim();

  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const isSyncing = useAppStore((state) => state.isSyncing);
  const deliveries = useAppStore((state) => state.deliveries);
  const initData = useAppStore((state) => state.initData);

  const [attemptedRefresh, setAttemptedRefresh] = useState(false);
  const [failed, setFailed] = useState(false);

  const delivery = useMemo(
    () => deliveries.find((item) => item.id === id),
    [deliveries, id],
  );

  useEffect(() => {
    if (!id) {
      router.replace('/entregas');
      return;
    }

    if (!hasHydrated) return;

    if (delivery) {
      router.replace(`/entregas/details?id=${encodeURIComponent(delivery.id)}`);
      return;
    }

    if (!attemptedRefresh && !isSyncing) {
      setAttemptedRefresh(true);
      void initData().catch(() => {
        setFailed(true);
      });
      return;
    }

    if (attemptedRefresh && !isSyncing && !delivery) {
      const timer = window.setTimeout(() => {
        setFailed(true);
      }, 900);

      return () => window.clearTimeout(timer);
    }
  }, [
    attemptedRefresh,
    delivery,
    hasHydrated,
    id,
    initData,
    isSyncing,
    router,
  ]);

  if (failed) {
    return (
      <div className="flex min-h-[58vh] flex-col items-center justify-center gap-4 px-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
          <Bike size={26} />
        </div>
        <div>
          <h1 className="text-lg font-black text-zinc-100">
            Entrega ainda não apareceu neste aparelho
          </h1>
          <p className="mt-1 max-w-sm text-sm text-zinc-500">
            Atualizamos os dados, mas não localizamos esta entrega no cache atual.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttemptedRefresh(false);
          }}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-black text-zinc-950"
        >
          <RefreshCw size={16} />
          Tentar novamente
        </button>
        <button
          type="button"
          onClick={() => router.replace('/entregas')}
          className="text-sm font-bold text-zinc-400"
        >
          Abrir lista de entregas
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[58vh] flex-col items-center justify-center gap-3 text-center">
      <LoaderCircle className="animate-spin text-amber-400" size={32} />
      <strong className="text-sm text-zinc-200">Abrindo entrega…</strong>
      <span className="text-xs text-zinc-500">
        Sincronizando o vínculo com o DFL Admin.
      </span>
    </div>
  );
}

export default function DeliveryBridgeResolverPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[58vh] items-center justify-center">
          <LoaderCircle className="animate-spin text-amber-400" size={32} />
        </div>
      }
    >
      <ResolverContent />
    </Suspense>
  );
}
