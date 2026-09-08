'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPin,
  PackageOpen,
  QrCode,
  Route as RouteIcon,
  X,
} from 'lucide-react';
import type {
  DataQualityIssue,
  DrilldownSelection,
  ReportBucket,
  ReportDelivery,
  ReportModel,
} from '@/lib/reports/types';

interface ReportDrilldownSheetProps {
  selection: DrilldownSelection | null;
  model: ReportModel;
  onClose: () => void;
}

const money = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

function paymentIcon(method: string) {
  const normalized = method.toLowerCase();
  if (normalized.includes('pix')) return <QrCode size={12} />;
  if (normalized.includes('dinheiro')) return <Banknote size={12} />;
  return <CreditCard size={12} />;
}

function deliveryMatches(
  delivery: ReportDelivery,
  selection: DrilldownSelection,
): boolean {
  if (!selection.key) return true;

  switch (selection.kind) {
    case 'daily':
      return delivery.reportDateKey === selection.key;
    case 'payment':
      return delivery.paymentLabel === selection.key;
    case 'origin':
      return delivery.originLabel === selection.key;
    case 'hour':
      return String(delivery.reportHour) === selection.key;
    case 'weekday':
      return delivery.reportDateKey
        ? String(new Date(`${delivery.reportDateKey}T12:00:00-03:00`).getDay()) ===
            selection.key
        : false;
    case 'neighborhood':
      return delivery.neighborhood === selection.key;
    case 'motoboy':
      return (delivery.route?.motoboy_name || 'Não atribuído') === selection.key;
    default:
      return true;
  }
}

function bucketSource(
  selection: DrilldownSelection,
  model: ReportModel,
): ReportBucket[] {
  switch (selection.kind) {
    case 'daily':
      return model.dailyVolume;
    case 'payment':
      return model.payments;
    case 'origin':
      return model.origins;
    case 'hour':
      return model.hours;
    case 'weekday':
      return model.weekdays;
    case 'neighborhood':
      return model.neighborhoods;
    case 'motoboy':
      return model.motoboys;
    default:
      return [];
  }
}

export function ReportDrilldownSheet({
  selection,
  model,
  onClose,
}: ReportDrilldownSheetProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(selection?.key ?? null);

  useEffect(() => {
    setSelectedKey(selection?.key ?? null);
  }, [selection]);

  const effectiveSelection = selection
    ? { ...selection, key: selectedKey ?? selection.key }
    : null;

  const deliveries = useMemo(() => {
    if (!effectiveSelection) return [];
    return model.deliveries.filter((delivery) =>
      deliveryMatches(delivery, effectiveSelection),
    );
  }, [effectiveSelection, model.deliveries]);

  if (!selection || !effectiveSelection) return null;

  const buckets = bucketSource(selection, model);
  const qualityIssues =
    selection.kind === 'quality'
      ? model.quality
      : ([] as DataQualityIssue[]);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col justify-end bg-black/80 backdrop-blur-sm">
      <section className="max-h-[92vh] overflow-hidden rounded-t-[34px] border-t border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-zinc-800" />

        <header className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-5 pb-4 pt-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-zinc-50">
              {selection.title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {selection.subtitle ??
                'Histórico e evidências usadas para montar esta análise.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[calc(92vh-100px)] overflow-y-auto px-5 pb-10 pt-4">
          {buckets.length > 0 && (
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${
                  selectedKey == null
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                }`}
              >
                Todos
              </button>
              {buckets.map((bucket) => (
                <button
                  key={bucket.key}
                  type="button"
                  onClick={() => setSelectedKey(bucket.key)}
                  className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${
                    selectedKey === bucket.key
                      ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                  }`}
                >
                  {bucket.label} · {bucket.count}
                </button>
              ))}
            </div>
          )}

          {selection.kind === 'route' && (
            <div className="space-y-3">
              {model.routeTimings
                .filter((route) => !effectiveSelection.key || route.routeId === effectiveSelection.key)
                .map((route) => (
                <article
                  key={route.routeId}
                  className="rounded-[20px] border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 font-bold text-zinc-100">
                        <RouteIcon size={15} className="text-sky-400" />
                        {route.routeName}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {route.motoboyName} · {route.deliveryCount}{' '}
                        {route.deliveryCount === 1 ? 'entrega' : 'entregas'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-black text-sky-300">
                      <Clock3 size={14} />
                      {route.durationMinutes.toFixed(1)} min
                    </div>
                  </div>
                </article>
              ))}

              {model.routeTimings.filter(
                (route) => !effectiveSelection.key || route.routeId === effectiveSelection.key,
              ).length === 0 && (
                <Empty label="Nenhuma rota com duração confiável neste recorte." />
              )}
            </div>
          )}

          {selection.kind === 'quality' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Tipos de ocorrência"
                  value={String(qualityIssues.filter((issue) => issue.count > 0).length)}
                  icon={<PackageOpen size={14} />}
                />
                <MiniStat
                  label="Ocorrências"
                  value={String(
                    qualityIssues.reduce((sum, issue) => sum + issue.count, 0),
                  )}
                  icon={<Clock3 size={14} />}
                />
              </div>

              {qualityIssues.filter((issue) => issue.count > 0).map((issue) => (
                <article
                  key={issue.key}
                  className="rounded-[20px] border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-bold text-zinc-100">{issue.label}</div>
                    <div className="text-lg font-black text-amber-300">{issue.count}</div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                    {issue.description}
                  </p>
                </article>
              ))}
            </div>
          )}

          {selection.kind !== 'route' && selection.kind !== 'quality' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat
                  label="Entregas"
                  value={String(deliveries.length)}
                  icon={<PackageOpen size={14} />}
                />
                <MiniStat
                  label="Faturamento"
                  value={money(
                    deliveries.reduce(
                      (sum, delivery) => sum + (delivery.value || 0),
                      0,
                    ),
                  )}
                  icon={<Banknote size={14} />}
                />
              </div>

              {deliveries.map((delivery) => (
                <article
                  key={delivery.id}
                  className="rounded-[20px] border border-zinc-800 bg-zinc-900/60 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-zinc-100">
                          #{delivery.order_id || 'Sem código'}
                        </span>
                        {delivery.completed && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                            <CheckCircle2 size={10} />
                            Concluída
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 truncate text-xs text-zinc-500">
                        <MapPin size={12} className="shrink-0" />
                        <span className="truncate">
                          {delivery.address_string || 'Endereço não informado'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold text-zinc-500">
                        <span className="rounded-full bg-zinc-950 px-2 py-1">
                          {delivery.originLabel}
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-zinc-950 px-2 py-1">
                          {paymentIcon(delivery.paymentLabel)}
                          {delivery.paymentLabel}
                        </span>
                        <span className="rounded-full bg-zinc-950 px-2 py-1">
                          {delivery.reportDateKey || 'Sem data confiável'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-sm font-black text-emerald-300">
                      {money(delivery.value || 0)}
                    </div>
                  </div>
                </article>
              ))}

              {deliveries.length === 0 && (
                <Empty label="Nenhum registro corresponde a este recorte." />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-black text-zinc-100">{value}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-600">
      {label}
    </div>
  );
}
