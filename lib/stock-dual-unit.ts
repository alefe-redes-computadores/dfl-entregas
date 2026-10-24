import type { StockProduct, StockProductPresentation, StockSupplyUnit } from '@/types';
import { formatStockQuantity } from '@/lib/stock-quantity';

const CONTAINERS = new Set<StockSupplyUnit>(['pct', 'cx', 'fardo']);
const compact = (number: number) => number.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const unitName = (unit: StockSupplyUnit) => unit === 'pct' ? 'pacote' : unit === 'cx' ? 'caixa' : 'fardo';
export type DualStockView = {
  primary: string;
  secondary: string;
  countPerPackage: number;
  looseBaseFactor: number;
  presentationId: string;
  packageLabel: string;
  mode: 'base_units' | 'legacy_package';
};

/**
 * R98 - leitura das embalagens EXISTENTES, sem alterar a unidade contábil.
 * Padrão: produto controla un, compra pct/cx/fardo com fator 20/30.
 * Legado: produto controla pct/cx/fardo, apresentação un com fator 20/30.
 * Nenhuma conversão é inferida somente do nome ou do preço do produto.
 */
export function dualStockView(product: Pick<StockProduct, 'unit' | 'current_quantity' | 'presentations' | 'loose_units_per_package'>): DualStockView | null {
  const current = Number(product.current_quantity);
  if (!Number.isFinite(current) || current < 0) return null;
  const presentations = (product.presentations || []).filter(
    (entry): entry is StockProductPresentation => entry.active && Number.isFinite(Number(entry.conversion_quantity)) && Number(entry.conversion_quantity) > 1 && Number.isInteger(Number(entry.conversion_quantity)) && Number(entry.conversion_quantity) <= 1000,
  );
  const standard = product.unit === 'un' ? presentations.find(entry => CONTAINERS.has(entry.purchase_unit)) : undefined;
  if (standard) {
    const count = Number(standard.conversion_quantity);
    return {
      primary: formatStockQuantity(current, 'un'),
      secondary: `≈ ${compact(current / count)} ${standard.label?.trim() || unitName(standard.purchase_unit)}`,
      countPerPackage: count,
      looseBaseFactor: 1,
      presentationId: standard.id,
      packageLabel: standard.label?.trim() || unitName(standard.purchase_unit),
      mode: 'base_units',
    };
  }
  const legacy = CONTAINERS.has(product.unit) ? presentations.find(entry => entry.purchase_unit === 'un') : undefined;
  const configured = Number(product.loose_units_per_package);
  const explicit = Number.isInteger(configured) && configured > 1 && configured <= 1000 ? configured : 0;
  // A apresentação antiga 'un' pode significar 1 unidade de compra = N pacotes.
  // Só invertê-la quando o rótulo comprova N unidades CONTIDAS no pacote.
  const provedByLabel = legacy && new RegExp(`\\b${legacy.conversion_quantity}\\s*(?:ovos?|unidades?|un|itens?|pecas?)\\b`, 'i').test(legacy.label || '');
  const count = explicit || (provedByLabel && legacy ? Number(legacy.conversion_quantity) : 0);
  if (!CONTAINERS.has(product.unit) || !count) return null;
  const label = /cartela/i.test(legacy?.label || '') ? 'cartela' : unitName(product.unit);
  return {
    primary: `${current.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${label}${current > 1 ? 's' : ''}`,
    secondary: `≈ ${compact(current * count)} unidades avulsas`,
    countPerPackage: count,
    looseBaseFactor: 1 / count,
    presentationId: legacy?.id || '__configured',
    packageLabel: label,
    mode: 'legacy_package',
  };
}

/**
 * Legado fracionário: registrar 1/30 como 0,0333 deixa ~0,001 cartela
 * residual após 30 baixas. Só zera esse resíduo quando a diferença equivale
 * a menos de 0,05 unidade e a quantidade solicitada cabe no saldo atual.
 * Fora desse caso o arredondamento de quatro casas existente é soberano.
 */
export function stockMovementBaseQuantity(
  entered: number, conversion: number, currentBalance: number,
  options: { loose: boolean; direction: 'remove' | 'set' | 'add' },
): number {
  const typed = Number(entered);
  const factor = Number(conversion);
  if (!Number.isFinite(typed) || typed < 0 || !Number.isFinite(factor) || factor <= 0) return NaN;
  const rounded = Number((typed * factor).toFixed(4));
  if (options.loose && options.direction === 'remove' && rounded > 0 && currentBalance >= rounded) {
    const remaining = currentBalance - rounded;
    if (remaining >= 0 && remaining * (1 / factor) < 0.05) return currentBalance;
  }
  return rounded;
}

/** Selector de unidade avulsa somente quando a base legada está em embalagem. */
export function looseMovementPresentation(product: StockProduct | undefined) {
  if (!product) return null;
  const view = dualStockView(product);
  if (!view || view.mode !== 'legacy_package') return null;
  return {
    id: '__loose-unit', label: `Unidades avulsas (1 ${view.packageLabel} = ${compact(view.countPerPackage)} un)`,
    purchase_unit: 'un' as const, conversion_quantity: view.looseBaseFactor, active: true,
  };
}
