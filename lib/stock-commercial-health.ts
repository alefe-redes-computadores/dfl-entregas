import type { StockProduct, StockProductPresentation, StockSupplyItem, StockSupplyUnit } from '@/types';

const FRACTIONAL_BASE = new Set<StockSupplyUnit>(['kg', 'g', 'l', 'ml']);
const DISCRETE_PURCHASE = new Set<StockSupplyUnit>(['un', 'cx', 'pct', 'fardo']);

export type CommercialProductStatus =
  | 'configured'
  | 'fractional_without_presentation'
  | 'discrete_without_presentation'
  | 'invalid_presentation';

const validPresentation = (p: StockProductPresentation) =>
  Boolean(p?.label?.trim()) &&
  Number.isFinite(Number(p?.conversion_quantity)) &&
  Number(p.conversion_quantity) > 0;

export function commercialProductStatus(product: StockProduct): CommercialProductStatus {
  const presentations = product.presentations || [];
  if (presentations.some((p) => !validPresentation(p))) return 'invalid_presentation';
  if (presentations.some(validPresentation)) return 'configured';
  if (FRACTIONAL_BASE.has(product.unit)) return 'fractional_without_presentation';
  return 'discrete_without_presentation';
}

export function commercialCoverage(products: StockProduct[]) {
  const active = products.filter((p) => p.active);
  const configured = active.filter((p) => commercialProductStatus(p) === 'configured').length;
  const attention = active.filter((p) => {
    const status = commercialProductStatus(p);
    return status === 'fractional_without_presentation' || status === 'invalid_presentation';
  }).length;
  return {
    total: active.length,
    configured,
    attention,
    percent: active.length ? Math.round((configured / active.length) * 100) : 100,
  };
}

export function commercialOperationalHint(product: StockProduct): string {
  const status = commercialProductStatus(product);
  if (status === 'configured') return 'Compra comercial configurada.';
  if (status === 'invalid_presentation') return 'Revise a embalagem: existe apresentação sem conversão válida.';
  if (status === 'fractional_without_presentation') {
    return 'Estoque fracionável sem embalagem de compra. Cadastre a forma real de compra antes de automatizar arredondamentos.';
  }
  return 'Sem embalagem cadastrada: a compra segue a unidade de controle.';
}

export function commercialUnitPolicy(unit: StockSupplyUnit): 'fractional' | 'discrete' {
  return FRACTIONAL_BASE.has(unit) ? 'fractional' : 'discrete';
}

export function purchaseUnitPolicy(unit: StockSupplyUnit): 'fractional' | 'discrete' {
  return DISCRETE_PURCHASE.has(unit) ? 'discrete' : 'fractional';
}

export function comparableBaseUnitCost(item: StockSupplyItem): number | null {
  const quantity = Number(item.quantity);
  const total = Number(item.total_price);
  const unitPrice = Number(item.unit_price);
  if (quantity > 0 && total > 0) return total / quantity;
  if (unitPrice > 0) return unitPrice;
  const purchaseQuantity = Number(item.purchase_quantity);
  const purchaseUnitPrice = Number(item.purchase_unit_price);
  const conversion = Number(item.conversion_quantity);
  if (purchaseQuantity > 0 && purchaseUnitPrice > 0 && conversion > 0) {
    return purchaseUnitPrice / conversion;
  }
  return null;
}


export const commercialContractSummary = {
  stockUnitIsHistorical: true,
  purchasePresentationIsIndependent: true,
  openPurchasesDiscountBaseQuantity: true,
  discretePurchasesRoundUp: true,
  fractionalPurchasesNeverRoundBelowNeed: true,
} as const;
