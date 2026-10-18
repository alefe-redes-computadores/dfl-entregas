import type { StockProduct, StockProductPresentation, StockSupply } from '@/types';
import { normalizeCommercialPurchaseQuantity } from '@/lib/stock-commercial';
import { comparableBaseUnitCost } from '@/lib/stock-commercial-health';

export interface StockCommittedQuantity { productId: string; quantity: number; }

const OPEN_SUPPLY_STATUSES = new Set<StockSupply['status']>(['solicitado', 'em_compra']);

export function committedStockQuantityMap(supplies: StockSupply[], options: { excludeSupplyId?: string } = {}) {
  const committed = new Map<string, number>();
  supplies.forEach((supply) => {
    if (options.excludeSupplyId && supply.id === options.excludeSupplyId) return;
    if (!OPEN_SUPPLY_STATUSES.has(supply.status) || supply.stock_reversed_at) return;
    supply.items.forEach((item) => {
      if (!item.stock_product_id) return;
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) return;
      committed.set(item.stock_product_id, (committed.get(item.stock_product_id) || 0) + quantity);
    });
  });
  return committed;
}

export function netStockPurchaseQuantity(recommendedQuantity: number, committedQuantity: number) {
  return Math.max(0, Number((Math.max(0, recommendedQuantity) - Math.max(0, committedQuantity)).toFixed(4)));
}

export interface CommercialPurchasePlan {
  rawNeed: number;
  committedQuantity: number;
  netNeed: number;
  purchaseQuantity: number;
  baseQuantity: number;
  surplusQuantity: number;
  presentation?: StockProductPresentation;
}

export function activeStockPresentation(product: StockProduct, presentationId?: string, needInBaseUnit = 0) {
  const active = (product.presentations || []).filter((item) => item.active && item.conversion_quantity > 0);
  const explicit = active.find((item) => item.id === presentationId);
  if (explicit || active.length < 2 || !(needInBaseUnit > 0)) return explicit || active[0];

  // A recomendação automática escolhe a embalagem que cobre a falta com o
  // menor excesso. Em empate, prefere menos volumes físicos. Assim, faltar
  // 2 un escolhe 2 unidades, não 1 fardo com 6; faltar 12 un pode escolher
  // 2 fardos em vez de 12 unidades avulsas.
  return [...active].sort((left, right) => {
    const score = (presentation: StockProductPresentation) => {
      const quantity = normalizeCommercialPurchaseQuantity(needInBaseUnit, presentation, product.unit);
      const base = quantity * Number(presentation.conversion_quantity);
      return { surplus: Math.max(0, base - needInBaseUnit), quantity };
    };
    const a = score(left);
    const b = score(right);
    return a.surplus - b.surplus || a.quantity - b.quantity;
  })[0];
}

export function commercialPurchasePlan(product: StockProduct, rawNeed: number, committedQuantity = 0, presentationId?: string): CommercialPurchasePlan {
  const netNeed = netStockPurchaseQuantity(rawNeed, committedQuantity);
  const presentation = activeStockPresentation(product, presentationId, netNeed);
  const factor = presentation?.conversion_quantity || 1;
  const purchaseQuantity = netNeed > 0
    ? normalizeCommercialPurchaseQuantity(netNeed, presentation, product.unit)
    : 0;
  const baseQuantity = Number((purchaseQuantity * factor).toFixed(4));
  return {
    rawNeed: Math.max(0, rawNeed),
    committedQuantity: Math.max(0, committedQuantity),
    netNeed,
    purchaseQuantity,
    baseQuantity,
    surplusQuantity: Number(Math.max(0, baseQuantity - netNeed).toFixed(4)),
    presentation,
  };
}

export interface ShoppingPriceSignal { samples: number; median: number | null; latest: number | null; lowest: number | null; current: number; deltaPercent: number | null; tone: 'good' | 'neutral' | 'bad' | 'unknown'; label: string; }
const median = (values: number[]) => { if (!values.length) return null; const sorted=[...values].sort((a,b)=>a-b); const middle=Math.floor(sorted.length/2); return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2; };

export type ShoppingPriceHistoryRow = { supply: StockSupply; item: StockSupply['items'][number] };
export type ShoppingPriceHistoryIndex = Map<string, ShoppingPriceHistoryRow[]>;
/** Reutiliza o histórico no modo supermercado sem varrer todas as compras a cada item. */
export function indexShoppingPriceHistory(supplies: StockSupply[]): ShoppingPriceHistoryIndex {
  const index: ShoppingPriceHistoryIndex = new Map();
  for (const supply of supplies) {
    if (!supply.stock_integrated_at || supply.stock_reversed_at) continue;
    for (const item of supply.items) {
      if (!item.stock_product_id || !(Number(comparableBaseUnitCost(item)) > 0)) continue;
      const row = { supply, item };
      const bucket = index.get(item.stock_product_id);
      if (bucket) bucket.push(row);
      else index.set(item.stock_product_id, [row]);
    }
  }
  for (const rows of index.values()) rows.sort((a,b)=>new Date(b.supply.occurred_at).getTime()-new Date(a.supply.occurred_at).getTime());
  return index;
}

export function shoppingPriceSignal(product: StockProduct, supplies: StockSupply[], current: number, index?: ShoppingPriceHistoryIndex): ShoppingPriceSignal {
  const rows = index ? index.get(product.id) || [] : supplies.flatMap((supply) => supply.items.map((item) => ({ supply, item }))).filter(({supply,item}) => item.stock_product_id===product.id && Boolean(supply.stock_integrated_at) && !supply.stock_reversed_at && Number(comparableBaseUnitCost(item))>0).sort((a,b)=>new Date(b.supply.occurred_at).getTime()-new Date(a.supply.occurred_at).getTime());
  const values=rows.map(({item})=>Number(comparableBaseUnitCost(item)||0)).filter((value)=>value>0); const historicalMedian=median(values); const latest=values[0]??null; const lowest=values.length?Math.min(...values):null; const deltaPercent=historicalMedian&&current>0?((current-historicalMedian)/historicalMedian)*100:null;
  let tone:ShoppingPriceSignal['tone']='unknown'; let label='Sem histórico comparável';
  if(deltaPercent!==null){if(deltaPercent<=-5){tone='good';label=`${Math.abs(deltaPercent).toFixed(0)}% abaixo da mediana`;}else if(deltaPercent>=8){tone='bad';label=`${deltaPercent.toFixed(0)}% acima da mediana`;}else{tone='neutral';label='Dentro da faixa histórica';}}
  return {samples:values.length,median:historicalMedian,latest,lowest,current,deltaPercent,tone,label};
}

export function projectedAverageCost(product: StockProduct, addedQuantity: number, newUnitCost: number) {
  const oldQuantity=Math.max(0,product.current_quantity);
  const knownCost=typeof product.average_cost==='number' && Number.isFinite(product.average_cost) && product.average_cost>=0;
  const oldCost=knownCost?product.average_cost!:0;
  if(!(addedQuantity>0&&newUnitCost>0)) return oldCost;
  if(oldQuantity<=0 || !knownCost) return newUnitCost;
  return (oldQuantity*oldCost+addedQuantity*newUnitCost)/(oldQuantity+addedQuantity);
}
