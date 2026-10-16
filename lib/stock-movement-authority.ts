import type { StockMovement } from '@/types';

const DAY = 86_400_000;

export const normalizedStockMovementReason = (reason?: string) =>
  (reason || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

export const isOperationalStockConsumption = (movement: StockMovement) => {
  if (movement.type !== 'saida' || movement.supply_id) return false;
  if (!Number.isFinite(movement.quantity) || movement.quantity <= 0) return false;
  return !/estorno|revers|correc|ajuste|contagem|saldo inicial/.test(
    normalizedStockMovementReason(movement.reason),
  );
};

export const stockDayKey = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

export const stockObservedDays = (first: Date, now: Date, windowDays: number) =>
  Math.max(1, Math.min(windowDays, Math.ceil((now.getTime() - first.getTime()) / DAY) + 1));
