// lib/stock-quantity.ts
import type { StockSupplyUnit } from '@/types';

export type QuantityDisplayUnit = StockSupplyUnit;

export const quantityChoices = (
  base: StockSupplyUnit,
): QuantityDisplayUnit[] =>
  base === 'kg'
    ? ['kg', 'g']
    : base === 'l'
      ? ['l', 'ml']
      : [base];

export const toBaseQuantity = (
  value: number,
  display: QuantityDisplayUnit,
  base: StockSupplyUnit,
) =>
  display === 'g' && base === 'kg'
    ? value / 1000
    : display === 'ml' && base === 'l'
      ? value / 1000
      : value;

export const fromBaseQuantity = (
  value: number,
  display: QuantityDisplayUnit,
  base: StockSupplyUnit,
) =>
  display === 'g' && base === 'kg'
    ? value * 1000
    : display === 'ml' && base === 'l'
      ? value * 1000
      : value;

export const quantityUnitLabel = (unit: QuantityDisplayUnit) =>
  ({
    un: 'un',
    kg: 'kg',
    g: 'g',
    l: 'L',
    ml: 'ml',
    cx: 'cx',
    pct: 'pct',
    fardo: 'fardo',
  })[unit];

export const parseStockQuantityInput = (raw: string): number => {
  const value = raw.trim().replace(/\s+/g, '');

  if (!value) return 0;

  const cleaned = value.replace(/[^0-9.,-]/g, '');
  const negative = cleaned.startsWith('-');
  const unsigned = cleaned.replace(/-/g, '');

  if (!unsigned) return 0;

  const hasComma = unsigned.includes(',');
  const hasDot = unsigned.includes('.');

  if (hasComma && hasDot) {
    const comma = unsigned.lastIndexOf(',');
    const dot = unsigned.lastIndexOf('.');
    const decimalIndex = Math.max(comma, dot);

    const integerPart = unsigned
      .slice(0, decimalIndex)
      .replace(/[.,]/g, '');

    const decimalPart = unsigned
      .slice(decimalIndex + 1)
      .replace(/[.,]/g, '');

    const parsed = Number(
      `${negative ? '-' : ''}${integerPart || '0'}.${decimalPart || '0'}`,
    );

    return Number.isFinite(parsed) ? parsed : 0;
  }

  const separator = hasComma ? ',' : hasDot ? '.' : '';

  if (separator) {
    const parts = unsigned.split(separator);

    if (parts.length === 2) {
      const parsed = Number(
        `${negative ? '-' : ''}${parts[0] || '0'}.${parts[1] || '0'}`,
      );

      return Number.isFinite(parsed) ? parsed : 0;
    }

    const decimalPart = parts.pop() || '0';
    const integerPart = parts.join('');

    const parsed = Number(
      `${negative ? '-' : ''}${integerPart || '0'}.${decimalPart}`,
    );

    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(
    `${negative ? '-' : ''}${unsigned}`,
  );

  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeStockQuantityInput = (
  raw: string,
): string => {
  const value = parseStockQuantityInput(raw);

  return value.toLocaleString('pt-BR', {
    useGrouping: false,
    maximumFractionDigits: 3,
  });
};

export const quantityInputHint = (
  unit: StockSupplyUnit,
) =>
  unit === 'kg'
    ? '1 = 1 kg · 0,1 ou 0.1 = 100 g'
    : unit === 'l'
      ? '1 = 1 L · 0,1 ou 0.1 = 100 ml'
      : 'Aceita ponto ou vírgula como decimal';

export const formatStockQuantity = (
  value: number,
  unit: StockSupplyUnit,
) => {
  const display =
    unit === 'kg' && value > 0 && value < 1
      ? 'g'
      : unit === 'l' && value > 0 && value < 1
        ? 'ml'
        : unit;

  return `${fromBaseQuantity(
    value,
    display,
    unit,
  ).toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
  })} ${quantityUnitLabel(display)}`;
};
