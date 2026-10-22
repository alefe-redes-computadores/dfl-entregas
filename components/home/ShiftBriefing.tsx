'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bike, GlassWater, PackageSearch, Play, Store } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { dateKey, operationalDaySchedule } from '@/lib/operational-time';
import { firstValidTimestamp } from '@/lib/reports/time';
import { buildOperationalReadiness } from '@/lib/operational-readiness';
import { stockLevel } from '@/lib/stock';
import { buildBeverageStockSuggestions } from '@/lib/stock-beverage-reconciliation';

export function ShiftBriefing() {
  const router = useRouter();
  const settings = useAppStore((state) => state.storeSettings);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const updateStoreSettings = useAppStore((state) => state.updateStoreSettings);
  const motoboys = useAppStore((state) => state.motoboys);
  const deliveries = useAppStore((state) => state.deliveries);
  const products = useAppStore((state) => state.stockProducts);
  const movements = useAppStore((state) => state.stockMovements);
  const customers = useAppStore((state) => state.customers);
  const routes = useAppStore((state) => state.routes);

  const today = dateKey(new Date());
  const selectedKey = dateKey(selectedDate);
  const storageKey = 'dfl-shift-started:' + today;
  const dismissed = (settings as any).dismissedBeverageStockSuggestions || [];

  const [seen, setSeen] = useState(true);
  const [busy, setBusy] = useState(false);
  const openLock = useRef(false);

  useEffect(() => {
    try { setSeen(localStorage.getItem(storageKey) === '1'); }
    catch { setSeen(false); } // Storage desabilitado não impede abrir a loja.
  }, [storageKey]);

  const activeMotoboys = useMemo(
    () => motoboys.filter((item) => item.active),
    [motoboys],
  );
  const beverageReview = useMemo(
    () => buildBeverageStockSuggestions(deliveries, products, movements, dismissed),
    [deliveries, dismissed, movements, products],
  );
  const stockAttention = useMemo(
    () => products.filter((item) => item.active && stockLevel(item) !== 'ok').length,
    [products],
  );

  // Mesma agenda canônica usada na operação: inclui exceções e pausas.
  const activeDay = useMemo(
    () => operationalDaySchedule(today, settings.schedule, settings.pauses, settings.holidaysOverrides),
    [today, settings.schedule, settings.pauses, settings.holidaysOverrides],
  );
  const isScheduledToday = Boolean(activeDay?.active && activeDay.shifts?.length);
  const pausedToday = !activeDay;

  // Somente dados locais do dia; nunca varrer Firestore ou bloquear a abertura.
  const addressReview = useMemo(() => {
    const dayRouteIds = new Set(routes.filter(route => {
      const timestamp = firstValidTimestamp(route.created_at, route.started_at, route.departure_time);
      return timestamp && dateKey(timestamp) === today;
    }).map(route => route.id));
    const todays = deliveries.filter(delivery => {
      if (delivery.route_id && dayRouteIds.has(delivery.route_id)) return true;
      const timestamp = firstValidTimestamp(delivery.created_at, delivery.createdAt);
      return Boolean(timestamp && dateKey(timestamp) === today);
    });
    return buildOperationalReadiness({ deliveries: todays, routes, customers }).missingAddress.length;
  }, [customers, deliveries, routes, today]);

  if (seen || settings.isOpen || selectedKey !== today || !isScheduledToday || pausedToday) return null;

  const start = async () => {
    if (openLock.current) return;
    openLock.current = true;
    setBusy(true);
    try {
      await updateStoreSettings({ isOpen: true });
      try { localStorage.setItem(storageKey, '1'); } catch { /* Sem storage: abertura ainda foi salva. */ }
      setSeen(true);
      if (Capacitor.isNativePlatform()) {
        try { await Haptics.notification({ type: NotificationType.Success }); } catch {}
      }
      toast.success('Operação aberta.', {
        description: beverageReview.length
          ? 'A revisão de bebidas continua disponível no Estoque.'
          : 'Conferência inicial registrada.',
      });
    } catch {
      toast.error('Não foi possível abrir a operação.');
    } finally {
      openLock.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[22px] border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[.09] to-sky-500/[.035] p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/12 text-emerald-400"><Store size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-400">Operação de hoje</p>
          <h2 className="font-heading text-base font-black text-zinc-100">Conferência de abertura</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
            <Bike size={12} className="text-sky-400" />
            {activeMotoboys.length
              ? activeMotoboys.length + ' entregador' + (activeMotoboys.length === 1 ? '' : 'es') + ' ativo' + (activeMotoboys.length === 1 ? '' : 's')
              : 'Nenhum entregador ativo'}
            {' · '}{stockAttention} alerta{stockAttention === 1 ? '' : 's'} de estoque
          </p>
        </div>
        <button type="button" disabled={busy} onClick={start} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-[11px] font-black text-zinc-950 shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-50">
          <Play size={14} />{busy ? 'Abrindo...' : 'Abrir'}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-500/10 pt-3">
        <button type="button" onClick={() => router.push('/estoque?review=beverages')} className="flex min-h-11 items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[.06] px-3 text-left active:scale-[.98]">
          <GlassWater size={15} className="shrink-0 text-sky-400" />
          <span className="text-[9px] font-black text-zinc-300">{beverageReview.length ? beverageReview.length + ' bebida' + (beverageReview.length === 1 ? '' : 's') + ' para revisar' : 'Bebidas conferidas'}</span>
        </button>
        <div className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/30 px-3">
          <PackageSearch size={15} className="shrink-0 text-amber-400" />
          <span className="text-[9px] font-black text-zinc-400">{stockAttention ? stockAttention + ' saldo' + (stockAttention === 1 ? '' : 's') + ' em atenção' : 'Saldos sem alerta'}</span>
        </div>
        {addressReview > 0 && <button type="button" onClick={() => router.push(`/entregas?date=${encodeURIComponent(today)}`)} className="col-span-2 flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[.07] px-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
          <PackageSearch size={15} className="shrink-0 text-amber-300" />
          <span className="text-[10px] font-bold text-amber-200">{addressReview} entrega{addressReview === 1 ? '' : 's'} de hoje sem endereço · conferir antes da saída</span>
        </button>}
      </div>
    </section>
  );
}
