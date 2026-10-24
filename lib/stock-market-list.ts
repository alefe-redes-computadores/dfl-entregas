import type { StockProduct, StockSupplyItem } from '@/types';
import { commercialPurchasePlan } from '@/lib/stock-shopping';
import { validateStockPurchaseQuantity } from '@/lib/stock-purchase-draft';
import { humanPurchasePlan } from '@/lib/stock-commercial-display-v2';
import { stockCategoryOrder, stockProductCategory } from '@/lib/stock-categories';

/** R96: lista de mercado é planejamento, NÃO recebimento nem movimento de estoque. */
export type StockMarketRow = {
  id: string;
  productId: string;
  name: string;
  category: string;
  purchaseText: string;
  purchaseQuantity: number;
  baseQuantity: number;
  signature: string;
  supplyItem: StockSupplyItem;
};

export const STOCK_MARKET_CHECKLIST_KEY = 'dfl-stock-market-list-v1';
const MAX_DRAFT_AGE = 7 * 86400_000;

export function buildStockMarketRows(
  products: readonly StockProduct[],
  selected: Readonly<Record<string, boolean>>,
  quantities: Readonly<Record<string, string>>,
  presentationIds: Readonly<Record<string, string>>,
) {
  const rows: StockMarketRow[] = [];
  const invalid: string[] = [];
  for (const product of products) {
    if (!selected[product.id]) continue;
    const presentation = commercialPurchasePlan(product, 1, 0, presentationIds[product.id]).presentation;
    const purchaseUnit = presentation?.purchase_unit || product.unit;
    const validated = validateStockPurchaseQuantity(quantities[product.id], purchaseUnit);
    const factor = presentation?.conversion_quantity || 1;
    const purchaseQuantity = validated.value;
    const baseQuantity = Number((purchaseQuantity * factor).toFixed(4));
    if (!validated.valid || !Number.isFinite(baseQuantity) || baseQuantity <= 0) {
      invalid.push(product.name);
      continue;
    }
    const category = stockProductCategory(product.name, product.category);
    const purchaseText = humanPurchasePlan({
      purchaseQuantity, baseQuantity, baseUnit: product.unit, presentation,
    });
    const id = `item-${product.id}`;
    const signature = JSON.stringify([product.id, purchaseQuantity, presentation?.id || '', factor, category]);
    rows.push({
      id, productId: product.id, name: product.name, category, purchaseText,
      purchaseQuantity, baseQuantity, signature,
      supplyItem: {
        id, name: product.name, quantity: baseQuantity, unit: product.unit,
        stock_product_id: product.id, presentation_id: presentation?.id,
        presentation_label: presentation?.label, purchase_quantity: purchaseQuantity,
        purchase_unit: purchaseUnit, conversion_quantity: factor,
      },
    });
  }
  rows.sort((a, b) =>
    stockCategoryOrder(a.category) - stockCategoryOrder(b.category) ||
    a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
  return { rows, invalid };
}

export function readStockMarketChecks(
  raw: string | null,
  rows: readonly StockMarketRow[],
  now = Date.now(),
): Record<string, string> {
  if (!raw) return {};
  try {
    const source: unknown = JSON.parse(raw);
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    const value = source as { version?: unknown; updatedAt?: unknown; checked?: unknown };
    const time = Date.parse(String(value.updatedAt || ''));
    if (value.version !== 1 || !Number.isFinite(time) || time > now + 300_000 ||
        now - time > MAX_DRAFT_AGE || !value.checked || typeof value.checked !== 'object' || Array.isArray(value.checked)) return {};
    const map = value.checked as Record<string, unknown>;
    return Object.fromEntries(rows.filter(row => map[row.id] === row.signature).slice(0, 300).map(row => [row.id, row.signature]));
  } catch { return {}; }
}

export function serializeStockMarketChecks(
  rows: readonly StockMarketRow[],
  checked: Readonly<Record<string, string>>,
  now = new Date(),
) {
  return JSON.stringify({
    version: 1,
    updatedAt: now.toISOString(),
    checked: Object.fromEntries(rows.filter(row => checked[row.id] === row.signature).slice(0, 300).map(row => [row.id, row.signature])),
  });
}

export function stockMarketChecked(row: StockMarketRow, checked: Readonly<Record<string, string>>) {
  return checked[row.id] === row.signature;
}

export function stockMarketText(
  rows: readonly StockMarketRow[],
  checked: Readonly<Record<string, string>>,
  date = new Date(),
): string {
  const out = [
    `DA FAMILIA LANCHES - LISTA DE MERCADO`,
    `Data: ${date.toLocaleDateString('pt-BR')} | ${rows.length} produto(s)`,
    `Planejamento: conferir quantidades no mercado. Nao registra entrada no estoque.`,
  ];
  let category = '';
  for (const row of rows) {
    if (category !== row.category) { category = row.category; out.push('', category.toLocaleUpperCase('pt-BR')); }
    out.push(`${stockMarketChecked(row, checked) ? '[x]' : '[ ]'} ${row.name} - ${row.purchaseText}`);
  }
  out.push('', 'Conferencia e recebimento da compra devem ser registrados no DFL.');
  return out.join('\n');
}
