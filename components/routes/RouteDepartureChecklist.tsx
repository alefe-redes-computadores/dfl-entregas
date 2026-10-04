// components/routes/RouteDepartureChecklist.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, Wallet, X } from 'lucide-react';
import type { Customer, Delivery, Route } from '@/types';
import { deliveryCustomerCharge } from '@/lib/delivery-finance';
import { routeCashFlow } from '@/lib/route-cash-flow';
import { groupDeliveriesByStop } from '@/lib/route-stops';

type Props = {
  route: Route;
  deliveries: Delivery[];
  getCustomerById: (id?: string) => Customer | undefined;
  isPrivacyMode?: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function RouteDepartureChecklist({
  route,
  deliveries,
  getCustomerById,
  isPrivacyMode = false,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const [busySeconds, setBusySeconds] = useState(0);

  useEffect(() => {
    if (!busy) {
      setBusySeconds(0);
      return;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setBusySeconds(Math.floor((Date.now() - startedAt) / 1000)),
      500,
    );
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const physicalStops = useMemo(
    () => groupDeliveriesByStop(deliveries).length,
    [deliveries],
  );
  const checklist = useMemo(() => deliveries.map((delivery) => {
    const customer = getCustomerById(delivery.customer_id);
    return {
      id: delivery.id,
      name: customer?.name || delivery.customer_name || 'Cliente',
      drinks: delivery.drinks?.trim() || '',
      change:
        !delivery.is_paid &&
        delivery.payment_method === 'dinheiro' &&
        delivery.change_for &&
        delivery.change_for > deliveryCustomerCharge(delivery)
          ? Math.max(0, delivery.change_for - deliveryCustomerCharge(delivery))
          : 0,
      missingAddress: !(delivery.address_string || customer?.address)?.trim(),
      missingConfirmation:
        delivery.origin === 'ifood' &&
        !delivery.confirmation_code?.trim() &&
        !customer?.last_confirmation_code?.trim(),
    };
  }), [deliveries, getCustomerById]);

  const drinks = checklist.filter((item) => item.drinks);
  const change = checklist.filter((item) => item.change > 0);
  const warnings = checklist.filter(
    (item) => item.missingAddress || item.missingConfirmation,
  );
  const cashFlow = useMemo(
    () => routeCashFlow(deliveries, route.change_money),
    [deliveries, route.change_money],
  );
  const requiredChange = cashFlow.requiredChange;
  const routeCash = cashFlow.initialCash;
  const routeCashShortage = cashFlow.plannedPixChange;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end bg-black/80 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
      role="dialog"
      aria-modal="true"
      aria-busy={busy}
      aria-labelledby="route-departure-title"
    >
      <div
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-[32px] border-t border-zinc-700 bg-[#151515] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-zinc-700" />

        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
              Expedição
            </p>
            <h3 id="route-departure-title" className="mt-1 font-heading text-xl font-black text-zinc-50">
              Checklist de saída
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Confira o que precisa sair da loja antes de colocar {route.name} na rua.
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 disabled:opacity-40"
            aria-label="Fechar checklist"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-lg font-black text-zinc-100">{physicalStops}</p>
            <p className="text-[9px] font-bold uppercase text-zinc-500">Paradas</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-lg font-black text-sky-300">{drinks.length}</p>
            <p className="text-[9px] font-bold uppercase text-zinc-500">Bebidas</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-lg font-black text-amber-300">{change.length}</p>
            <p className="text-[9px] font-bold uppercase text-zinc-500">Trocos</p>
          </div>
        </div>

        {drinks.length > 0 && (
          <section className="mt-4 rounded-2xl border border-sky-500/20 bg-sky-500/[.06] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-400">
              Bebidas para pegar
            </p>
            <div className="mt-3 space-y-2">
              {drinks.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-xl bg-zinc-950/50 px-3 py-2.5">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-sky-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-zinc-200">{item.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{item.drinks}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {(change.length > 0 || routeCash > 0) && (
          <section className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/[.06] p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-400">Caixa da rota</p><p className="mt-1 text-[10px] leading-relaxed text-zinc-500">Necessidade dos pedidos é referência; “na bag” é o dinheiro físico realmente separado.</p></div><Wallet size={17} className="shrink-0 text-amber-400" /></div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-zinc-950/50 p-3"><p className="text-[9px] font-bold uppercase text-zinc-600">Troco pedido</p><p className="mt-1 text-sm font-black text-zinc-200">{isPrivacyMode ? 'R$ •••••' : `R$ ${requiredChange.toFixed(2).replace('.', ',')}`}</p></div>
              <div className="rounded-xl bg-zinc-950/50 p-3"><p className="text-[9px] font-bold uppercase text-zinc-600">Dinheiro</p><p className="mt-1 text-sm font-black text-amber-300">{isPrivacyMode ? 'R$ •••••' : `R$ ${cashFlow.plannedCashChange.toFixed(2).replace('.', ',')}`}</p></div>
              <div className="rounded-xl bg-zinc-950/50 p-3"><p className="text-[9px] font-bold uppercase text-zinc-600">Pix previsto</p><p className="mt-1 text-sm font-black text-emerald-300">{isPrivacyMode ? 'R$ •••••' : `R$ ${cashFlow.plannedPixChange.toFixed(2).replace('.', ',')}`}</p></div>
            </div>
            {routeCashShortage > 0 && <div className="mt-3 flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[.06] p-3"><AlertTriangle size={15} className="shrink-0 text-emerald-400"/><p className="text-[10px] text-emerald-300">Faltam {isPrivacyMode ? 'parte do troco em espécie' : `R$ ${routeCashShortage.toFixed(2).replace('.', ',')} em espécie`}. Planejamento: devolver essa parte via Pix. Ajuste o troco inicial se quiser levar mais dinheiro.</p></div>}
            {cashFlow.expectedPhysicalReturn > 0 && <p className="mt-3 text-[10px] text-zinc-500">Retorno físico previsto para o caixa: <strong className="text-zinc-300">{isPrivacyMode?'R$ •••••':`R$ ${cashFlow.expectedPhysicalReturn.toFixed(2).replace('.', ',')}`}</strong>. É previsão de saída; o fechamento continua sendo o realizado.</p>}
            {change.length > 0 && <p className="mt-4 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Pedidos que pedem troco</p>}
            <div className="mt-3 space-y-2">
              {change.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-bold text-zinc-300">{item.name}</span>
                  <span className="shrink-0 font-black text-amber-300">
                    {isPrivacyMode
                      ? 'R$ •••••'
                      : `R$ ${item.change.toFixed(2).replace('.', ',')}`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {warnings.length > 0 && (
          <section className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/[.05] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-red-400">
              Atenção antes da saída
            </p>
            <div className="mt-3 space-y-2">
              {warnings.map((item) => (
                <div key={item.id} className="rounded-xl bg-zinc-950/50 px-3 py-2.5 text-xs">
                  <p className="font-black text-zinc-200">{item.name}</p>
                  <p className="mt-1 text-zinc-500">
                    {[
                      item.missingAddress ? 'endereço ausente' : '',
                      item.missingConfirmation ? 'código iFood pendente' : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {drinks.length === 0 && change.length === 0 && warnings.length === 0 && (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.06] p-4">
            <p className="text-sm font-black text-emerald-300">Saída sem pendências especiais</p>
            <p className="mt-1 text-xs text-zinc-500">
              Nenhuma bebida, troco ou alerta crítico registrado nesta rota.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void onConfirm()}
          className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 text-sm font-black text-zinc-950 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {busy
            ? busySeconds >= 4
              ? 'Rota salva · sincronizando em segundo plano'
              : 'Registrando saída...'
            : 'Tudo conferido · Iniciar rota'}
        </button>
        {busy && (
          <div className="mt-3" aria-live="polite">
            <div className="h-1 overflow-hidden rounded-full bg-zinc-900">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-400" />
            </div>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-zinc-500">
              {busySeconds >= 4
                ? 'A saída já está sendo protegida. Não toque novamente nem feche o aplicativo.'
                : 'Salvando horário, responsável e estado operacional da rota.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
