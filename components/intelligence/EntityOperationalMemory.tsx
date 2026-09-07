// components/intelligence/EntityOperationalMemory.tsx
'use client';

import type { ReactNode } from 'react';
import {
  Bike,
  BrainCircuit,
  Clock3,
  Database,
  MapPin,
  Route as RouteIcon,
  UserRound,
} from 'lucide-react';
import { useDeliveryIntelligence } from '@/hooks/useDeliveryIntelligence';
import { isOperationalCustomer } from '@/lib/customer-analytics';
import { useAppStore } from '@/store/useAppStore';

const WINDOW_DAYS = 365;
const MINIMUM_SAMPLE = 3;

function minutes(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value)} min`;
}

function MemoryShell({
  eyebrow,
  title,
  icon,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-indigo-500/15 bg-indigo-500/[.035] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-indigo-400">
            {eyebrow}
          </p>
          <h2 className="mt-1 font-heading text-sm font-black text-zinc-100">
            {title}
          </h2>
        </div>
      </div>

      <div className="mt-4">{children}</div>

      <p className="mt-3 text-[9px] leading-relaxed text-zinc-700">
        Janela contextual de até 12 meses. A memória descreve padrões do
        histórico; não atribui causa nem cria ranking.
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/45 p-3">
      <p className="text-[8px] font-black uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <p className="mt-1 text-xs font-black text-zinc-200">{value}</p>
    </div>
  );
}

function FormationState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 p-3">
      <Database size={16} className="mt-0.5 shrink-0 text-zinc-600" />
      <p className="text-[10px] leading-relaxed text-zinc-500">{text}</p>
    </div>
  );
}

export function CustomerOperationalMemory({
  customerId,
}: {
  customerId: string;
}) {
  const customer = useAppStore((state) =>
    state.customers.find((item) => item.id === customerId),
  );
  const intelligence = useDeliveryIntelligence({
    lookbackDays: WINDOW_DAYS,
    minimumSample: MINIMUM_SAMPLE,
    highlightLimit: 1,
  });

  if (!customer || isOperationalCustomer(customer)) return null;

  const memory = intelligence.memory.recurringCustomers.find(
    (item) => item.customerId === customerId,
  );

  return (
    <MemoryShell
      eyebrow="Memória operacional"
      title="Padrão recente deste cliente"
      icon={<UserRound size={18} />}
    >
      {memory ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Entregas" value={String(memory.deliveries)} />
            <Metric
              label="Endereços"
              value={String(memory.distinctAddresses)}
            />
            <Metric
              label="Consistência"
              value={`${Math.round(memory.addressConsistency)}%`}
            />
          </div>

          {memory.dominantAddress && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 p-3">
              <MapPin size={14} className="mt-0.5 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-wide text-zinc-600">
                  Endereço mais recorrente
                </p>
                <p className="mt-1 text-[10px] font-bold leading-relaxed text-zinc-300">
                  {memory.dominantAddress}
                </p>
                <p className="mt-1 text-[9px] text-zinc-600">
                  {memory.dominantAddressCount} ocorrência
                  {memory.dominantAddressCount === 1 ? '' : 's'} na amostra
                </p>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric
              label="Bairro estruturado"
              value={memory.hasStructuredNeighborhood ? 'Sim' : 'Não'}
            />
            <Metric
              label="Maps salvo"
              value={memory.hasMapsLink ? 'Sim' : 'Não'}
            />
          </div>
        </>
      ) : (
        <FormationState text="Ainda não há amostra mínima de entregas suficientes para formar uma memória individual confiável deste cliente." />
      )}
    </MemoryShell>
  );
}

export function MotoboyOperationalMemory({
  motoboyId,
}: {
  motoboyId: string;
}) {
  const motoboy = useAppStore((state) =>
    state.motoboys.find((item) => item.id === motoboyId),
  );
  const intelligence = useDeliveryIntelligence({
    lookbackDays: WINDOW_DAYS,
    minimumSample: MINIMUM_SAMPLE,
    highlightLimit: 1,
  });

  if (!motoboy) return null;

  const memory = intelligence.memory.motoboyContexts.find(
    (item) => item.motoboyId === motoboyId,
  );

  return (
    <MemoryShell
      eyebrow="Memória operacional"
      title="Contexto recente do entregador"
      icon={<Bike size={18} />}
    >
      {memory ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Rotas válidas" value={String(memory.routeCount)} />
            <Metric
              label="Entregas"
              value={String(memory.deliveryCount)}
            />
            <Metric
              label="Mediana rota"
              value={minutes(memory.medianRouteDurationMinutes)}
            />
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 p-3">
            <BrainCircuit
              size={14}
              className="mt-0.5 shrink-0 text-indigo-400"
            />
            <p className="text-[10px] leading-relaxed text-zinc-500">
              Este histórico serve como referência do próprio contexto do
              entregador. Não é comparação de velocidade entre pessoas.
            </p>
          </div>
        </>
      ) : (
        <FormationState text="Ainda não existem rotas fechadas com duração confiável suficientes para formar o contexto deste entregador." />
      )}
    </MemoryShell>
  );
}

export function RouteOperationalMemory({
  routeId,
}: {
  routeId: string;
}) {
  const route = useAppStore((state) =>
    state.routes.find((item) => item.id === routeId),
  );
  const intelligence = useDeliveryIntelligence({
    lookbackDays: WINDOW_DAYS,
    minimumSample: MINIMUM_SAMPLE,
    highlightLimit: 1,
  });

  if (!route) return null;

  const memory = intelligence.memory.routeContexts.find(
    (item) => item.routeId === routeId,
  );

  return (
    <MemoryShell
      eyebrow="Contexto da rota"
      title="Comparação com rotas de tamanho parecido"
      icon={<RouteIcon size={18} />}
    >
      {memory ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Metric
              label="Duração"
              value={minutes(memory.durationMinutes)}
            />
            <Metric label="Grupo" value={memory.sizeBand} />
            <Metric
              label="Amostra"
              value={String(memory.comparisonSample)}
            />
          </div>

          {memory.contextStatus === 'insufficient' ? (
            <div className="mt-3">
              <FormationState text="A duração desta rota é confiável, mas ainda faltam rotas de quantidade de paradas semelhante para formar uma linha de base." />
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric
                label="Mediana do grupo"
                value={minutes(memory.baselineMinutes)}
              />
              <Metric
                label="Leitura"
                value={
                  memory.contextStatus === 'above'
                    ? 'Acima do contexto'
                    : 'Dentro do contexto'
                }
              />
            </div>
          )}

          {memory.departureHour != null && (
            <div className="mt-3 flex items-center gap-2 text-[9px] font-bold text-zinc-600">
              <Clock3 size={12} />
              Saída registrada perto de{' '}
              {String(memory.departureHour).padStart(2, '0')}h
            </div>
          )}
        </>
      ) : (
        <FormationState
          text={
            route.status === 'fechada'
              ? 'Esta rota ainda não possui duração operacional confiável para comparação.'
              : 'A comparação aparece depois que a rota é finalizada com horário de saída e encerramento válidos.'
          }
        />
      )}
    </MemoryShell>
  );
}
