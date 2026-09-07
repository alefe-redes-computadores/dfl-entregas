// lib/fueling-analytics.ts
import type { Fueling, FuelType } from '@/types';

export const FUEL_LABELS: Record<FuelType, string> = {
  gasolina_comum: 'Gasolina comum',
  gasolina_aditivada: 'Gasolina aditivada',
  etanol: 'Etanol',
  diesel: 'Diesel',
  outro: 'Outro',
};

export const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

export const money = (value = 0) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export const numberPt = (value = 0, digits = 2) =>
  value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export function operationalMonthKey(value: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  return `${year}-${month}`;
}

export function fuelingDate(value: Pick<Fueling, 'occurred_at' | 'created_at'>): Date {
  return new Date(value.occurred_at || value.created_at || 0);
}

export function buildFuelingMetrics(items: Fueling[]) {
  const totalAmount = items.reduce((sum, item) => sum + (item.total_amount || 0), 0);
  const liters = items.reduce((sum, item) => sum + (item.liters || 0), 0);

  const pricedItems = items.filter(
    (item) => (item.liters || 0) > 0 && (item.total_amount || 0) > 0,
  );
  const pricedLiters = pricedItems.reduce((sum, item) => sum + (item.liters || 0), 0);
  const pricedAmount = pricedItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);

  const avgPricePerLiter = pricedLiters > 0 ? pricedAmount / pricedLiters : 0;

  const ordered = [...items].sort(
    (a, b) => fuelingDate(b).getTime() - fuelingDate(a).getTime(),
  );

  return {
    count: items.length,
    totalAmount,
    liters,
    avgPricePerLiter,
    last: ordered[0],
  };
}
