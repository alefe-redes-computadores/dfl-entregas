'use client';

import { useMemo, useState } from 'react';
import {
  BrainCircuit,
  ChevronDown,
  Route as RouteIcon,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Customer, Delivery, Route } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';

const normalize = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

function neighborhoodOf(
  delivery: Delivery,
  customers: Customer[],
): string {
  const customer = customers.find(
    (item) => item.id === delivery.customer_id,
  );

  if (customer?.neighborhood?.trim()) {
    return customer.neighborhood.trim();
  }

  const address =
    delivery.address_string ||
    customer?.address ||
    '';

  const parts = address
    .split(' - ')
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function RouteSequenceAdvisor({
  route,
  deliveries,
  customers,
}: {
  route: Route;
  deliveries: Delivery[];
  customers: Customer[];
}) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const setDeliveryOrder = useAppStore(
    (state) => state.setDeliveryOrder,
  );

  const intelligence = useDeliveryIntelligence({
    lookbackDays: 90,
    minimumSample: 3,
    highlightLimit: 3,
  });

  const suggestion = useMemo(() => {
    if (
      route.status !== 'aberta' ||
      route.started_at ||
      route.departure_time ||
      deliveries.length < 3
    ) {
      return null;
    }

    const current = [...deliveries].sort((a, b) => {
      const aOrder = a.order_index ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.order_index ?? Number.MAX_SAFE_INTEGER;

      if (aOrder !== bOrder) return aOrder - bOrder;

      return a.id.localeCompare(b.id);
    });

    const patterns =
      intelligence.memory.routeSequences.patterns
        .filter(
          (pattern) =>
            pattern.occurrences >= 3 &&
            pattern.fromNeighborhood &&
            pattern.toNeighborhood,
        );

    if (!patterns.length) return null;

    for (let index = 0; index < current.length - 1; index += 1) {
      const from = current[index];
      const immediate = current[index + 1];

      if (
        from.is_urgent ||
        immediate.is_urgent ||
        from.order_locked ||
        immediate.order_locked
      ) {
        continue;
      }

      const fromNeighborhood = neighborhoodOf(from, customers);
      const immediateNeighborhood = neighborhoodOf(immediate, customers);

      if (!fromNeighborhood || !immediateNeighborhood) continue;

      const candidates = patterns
        .filter(
          (pattern) =>
            normalize(pattern.fromNeighborhood) ===
            normalize(fromNeighborhood),
        )
        .sort((a, b) => b.occurrences - a.occurrences);

      if (!candidates.length) continue;

      const strongest = candidates[0];

      if (
        normalize(strongest.toNeighborhood) ===
        normalize(immediateNeighborhood)
      ) {
        continue;
      }

      const currentPattern = candidates.find(
        (pattern) =>
          normalize(pattern.toNeighborhood) ===
          normalize(immediateNeighborhood),
      );

      const supportGap =
        strongest.occurrences -
        (currentPattern?.occurrences || 0);

      if (
        strongest.occurrences < 4 ||
        supportGap < 2
      ) {
        continue;
      }

      const candidateIndex = current.findIndex(
        (candidate, candidateIndex) => {
          if (candidateIndex <= index + 1) return false;
          if (candidate.is_urgent || candidate.order_locked) return false;

          return (
            normalize(neighborhoodOf(candidate, customers)) ===
            normalize(strongest.toNeighborhood)
          );
        },
      );

      if (candidateIndex < 0) continue;

      if (
        candidateIndex === index + 2 &&
        strongest.occurrences < 6
      ) {
        continue;
      }

      const proposed = [...current];
      const [candidate] = proposed.splice(candidateIndex, 1);
      proposed.splice(index + 1, 0, candidate);

      const sample = strongest.occurrences;
      const confidence =
        sample >= 8
          ? 'Alta'
          : sample >= 5
            ? 'Média'
            : 'Baixa';

      return {
        fromNeighborhood,
        currentNeighborhood: immediateNeighborhood,
        candidateNeighborhood: strongest.toNeighborhood,
        occurrences: strongest.occurrences,
        currentOccurrences: currentPattern?.occurrences || 0,
        timingSample: strongest.timingSample,
        medianMinutes: strongest.medianCompletionIntervalMinutes,
        confidence,
        proposedIds: proposed.map((item) => item.id),
      };
    }

    return null;
  }, [
    customers,
    deliveries,
    intelligence.memory.routeSequences.patterns,
    route.departure_time,
    route.started_at,
    route.status,
  ]);

  if (!suggestion) return null;

  const apply = async () => {
    if (applying) return;

    setApplying(true);

    try {
      await setDeliveryOrder(
        route.id,
        suggestion.proposedIds,
        {
          metadata: {
            /*
             * A sugestão só vira sequência operacional depois da
             * confirmação do usuário. Nesse momento persistimos a
             * mesma trava usada pelo Organizador principal.
             */
            order_locked: true,
            order_source: 'smart',
            order_updated_at: new Date().toISOString(),
          },
        },
      );

      toast.success('Sugestão aplicada.', {
        description:
          'A sequência foi alterada sem tocar em urgências ou paradas travadas.',
      });
    } catch (error) {
      toast.error('Não foi possível aplicar a sugestão.', {
        description:
          error instanceof Error ? error.message : undefined,
      });
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[18px] border border-violet-500/15 bg-violet-500/[0.035]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-400">
          <BrainCircuit size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-violet-400">
            Sugestão de sequência
          </p>
          <p className="mt-0.5 truncate text-[11px] font-black text-zinc-200">
            {suggestion.fromNeighborhood} → {suggestion.candidateNeighborhood}
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-zinc-950/45 px-2 py-1 text-[8px] font-black text-zinc-500">
          {suggestion.confidence}
        </span>

        <ChevronDown
          size={14}
          className={`text-zinc-700 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-violet-500/10 px-3.5 pb-3.5 pt-3">
          <p className="text-[11px] leading-relaxed text-zinc-400">
            Depois de{' '}
            <strong className="text-zinc-200">
              {suggestion.fromNeighborhood}
            </strong>
            , o histórico aponta{' '}
            <strong className="text-violet-300">
              {suggestion.candidateNeighborhood}
            </strong>{' '}
            como sequência mais recorrente que{' '}
            <strong className="text-zinc-300">
              {suggestion.currentNeighborhood}
            </strong>
            .
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-zinc-950/45 p-2.5">
              <p className="text-[8px] font-black uppercase text-zinc-700">
                Amostra
              </p>
              <p className="mt-1 text-xs font-black text-zinc-300">
                {suggestion.occurrences}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-950/45 p-2.5">
              <p className="text-[8px] font-black uppercase text-zinc-700">
                Atual
              </p>
              <p className="mt-1 text-xs font-black text-zinc-300">
                {suggestion.currentOccurrences}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-950/45 p-2.5">
              <p className="text-[8px] font-black uppercase text-zinc-700">
                Confiança
              </p>
              <p className="mt-1 text-xs font-black text-violet-300">
                {suggestion.confidence}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-zinc-800/70 bg-zinc-950/30 p-2.5">
            <div className="flex items-start gap-2">
              <Sparkles size={13} className="mt-0.5 shrink-0 text-violet-400" />
              <p className="text-[9px] leading-relaxed text-zinc-600">
                É uma recomendação baseada em rotas concluídas, não uma promessa
                de menor distância ou menor tempo. Trânsito e percurso rodoviário
                não são inferidos.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={applying}
            onClick={apply}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 text-[10px] font-black text-white active:scale-[0.98] disabled:opacity-50"
          >
            <RouteIcon size={14} />
            {applying ? 'Aplicando...' : 'Aplicar sugestão'}
          </button>
        </div>
      )}
    </section>
  );
}
