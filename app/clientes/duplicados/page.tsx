// app/clientes/duplicados/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ChevronLeft,
  GitMerge,
  MapPin,
  PackageOpen,
  Phone,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { customerDuplicateCandidates } from '@/lib/customer-duplicates';
import type { Customer } from '@/types';

const address = (customer: Customer) =>
  customer.address || customer.neighborhood || 'Sem endereço';

export default function CustomerDuplicatesPage() {
  const router = useRouter();
  const customers = useAppStore((state) => state.customers);
  const deliveries = useAppStore((state) => state.deliveries);
  const mergeCustomers = useAppStore((state) => state.mergeCustomers);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingMerge, setPendingMerge] = useState<{
    source: Customer;
    target: Customer;
    key: string;
  } | null>(null);

  const candidates = useMemo(
    () => customerDuplicateCandidates(customers, deliveries),
    [customers, deliveries],
  );

  const requestMerge = (
    source: Customer,
    target: Customer,
    key: string,
  ) => {
    setPendingMerge({ source, target, key });
  };

  const confirmMerge = async () => {
    if (!pendingMerge) return;

    const { source, target, key } = pendingMerge;
    setBusy(key);

    try {
      const result = await mergeCustomers(source.id, target.id);
      setPendingMerge(null);
      toast.success('Clientes unificados com segurança.', {
        description: `${result.deliveriesMoved} entrega(s) transferida(s).`,
      });
    } catch (error) {
      toast.error('Não foi possível unificar os clientes.', {
        description:
          error instanceof Error ? error.message : 'Tente novamente.',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.replace('/clientes')}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-400">
            Higiene de dados
          </p>
          <h1 className="font-heading text-xl font-bold text-zinc-50">
            Possíveis duplicados
          </h1>
        </div>
      </header>

      <section className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/[.06] p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 shrink-0 text-emerald-400" size={20} />
          <div>
            <p className="text-sm font-black text-zinc-100">
              Nada é apagado automaticamente
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              O app apenas sugere pares. Você escolhe qual cadastro permanece.
              As entregas são repontadas antes da remoção do duplicado.
            </p>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-zinc-500">
          {candidates.length} par(es) para revisar
        </p>
        <UsersRound size={17} className="text-zinc-600" />
      </div>

      <div className="space-y-3">
        {candidates.map((candidate) => {
          const key = `${candidate.left.id}:${candidate.right.id}`;
          return (
            <section
              key={key}
              className="rounded-[26px] border border-zinc-800 bg-zinc-900/45 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                    {candidate.score}% de semelhança
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-600">
                    {candidate.reasons.join(' · ')}
                  </p>
                </div>
                <GitMerge size={19} className="text-amber-400" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[candidate.left, candidate.right].map((customer) => {
                  const orders =
                    customer.id === candidate.left.id
                      ? candidate.leftOrders
                      : candidate.rightOrders;
                  return (
                    <div
                      key={customer.id}
                      className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3"
                    >
                      <p className="truncate text-sm font-black text-zinc-100">
                        {customer.name}
                      </p>
                      <p className="mt-2 flex items-center gap-1 truncate text-[10px] text-zinc-500">
                        <MapPin size={10} />
                        {address(customer)}
                      </p>
                      <p className="mt-1 flex items-center gap-1 truncate text-[10px] text-zinc-500">
                        <Phone size={10} />
                        {customer.phone || 'Sem telefone'}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-zinc-400">
                        <PackageOpen size={10} />
                        {orders} pedido(s)
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy === key}
                  onClick={() => requestMerge(candidate.right, candidate.left, key)}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl bg-zinc-100 px-2 text-[10px] font-black text-zinc-950 disabled:opacity-50"
                >
                  Manter {candidate.left.name}
                  <ArrowRight size={12} />
                </button>
                <button
                  type="button"
                  disabled={busy === key}
                  onClick={() => requestMerge(candidate.left, candidate.right, key)}
                  className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-2 text-[10px] font-black text-zinc-200 disabled:opacity-50"
                >
                  Manter {candidate.right.name}
                  <ArrowRight size={12} />
                </button>
              </div>
            </section>
          );
        })}

        {!candidates.length && (
          <div className="rounded-[26px] border border-dashed border-zinc-800 py-16 text-center">
            <ShieldCheck className="mx-auto text-emerald-500" size={30} />
            <p className="mt-3 font-bold text-zinc-200">
              Nenhum duplicado provável
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              A base de clientes está limpa pelas regras atuais.
            </p>
          </div>
        )}
      </div>

      {pendingMerge && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 px-3 pb-4 backdrop-blur-sm sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setPendingMerge(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-customer-title"
            className="w-full max-w-md rounded-[30px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-zinc-800 sm:hidden" />

            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
                <GitMerge size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-400">
                  Confirmar consolidação
                </p>
                <h2
                  id="merge-customer-title"
                  className="mt-1 text-lg font-black text-zinc-50"
                >
                  Manter {pendingMerge.target.name}?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  O cadastro {pendingMerge.source.name} será incorporado ao principal.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
                    Sai
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-zinc-400">
                    {pendingMerge.source.name}
                  </p>
                </div>
                <ArrowRight size={16} className="text-amber-400" />
                <div className="min-w-0 text-right">
                  <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500/70">
                    Fica
                  </p>
                  <p className="mt-1 truncate text-sm font-black text-zinc-100">
                    {pendingMerge.target.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-xs leading-relaxed text-zinc-500">
              <p>• Todas as entregas serão transferidas para o cadastro mantido.</p>
              <p>• Histórico e totais serão recalculados.</p>
              <p>• O duplicado só será removido no mesmo lote após atualizar as referências.</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => setPendingMerge(null)}
                className="h-12 rounded-2xl border border-zinc-800 bg-zinc-900 text-sm font-black text-zinc-300 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={confirmMerge}
                className="h-12 rounded-2xl bg-amber-500 text-sm font-black text-zinc-950 disabled:opacity-50"
              >
                {busy ? 'Unificando...' : 'Unificar clientes'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
