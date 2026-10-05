import type { StockSupplyUnit } from '@/types';

export const stockQuantityTolerance = (unit: StockSupplyUnit) =>
  unit === 'kg' || unit === 'l'
    ? 0.0011
    : unit === 'g' || unit === 'ml'
      ? 0.01
      : 1e-7;

export const roundStockQuantity = (value: number) => {
  const rounded = Number(Number(value || 0).toFixed(4));
  return Math.abs(rounded) < 1e-7 ? 0 : rounded;
};

export const stockExitExceeds = (
  requested: number,
  available: number,
  unit: StockSupplyUnit,
) => requested - available > stockQuantityTolerance(unit);

export const clampStockExit = (
  requested: number,
  available: number,
  unit: StockSupplyUnit,
) => {
  if (requested > available && !stockExitExceeds(requested, available, unit)) {
    return Math.max(0, roundStockQuantity(available));
  }
  return Math.max(0, roundStockQuantity(requested));
};
