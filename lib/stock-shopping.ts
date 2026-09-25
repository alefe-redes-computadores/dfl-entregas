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

export function activeStockPresentation(product: StockProduct, presentationId?: string) {
  const active = (product.presentations || []).filter((item) => item.active && item.conversion_quantity > 0);
  return active.find((item) => item.id === presentationId) || active[0];
}

export function commercialPurchasePlan(product: StockProduct, rawNeed: number, committedQuantity = 0, presentationId?: string): CommercialPurchasePlan {
  const netNeed = netStockPurchaseQuantity(rawNeed, committedQuantity);
  const presentation = activeStockPresentation(product, presentationId);
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

export function shoppingPriceSignal(product: StockProduct, supplies: StockSupply[], current: number): ShoppingPriceSignal {
  const rows = supplies.flatMap((supply) => supply.items.map((item) => ({ supply, item }))).filter(({supply,item}) => item.stock_product_id===product.id && Boolean(supply.stock_integrated_at) && !supply.stock_reversed_at && Number(comparableBaseUnitCost(item))>0).sort((a,b)=>new Date(b.supply.occurred_at).getTime()-new Date(a.supply.occurred_at).getTime());
  const values=rows.map(({item})=>Number(comparableBaseUnitCost(item)||0)).filter((value)=>value>0); const historicalMedian=median(values); const latest=values[0]??null; const lowest=values.length?Math.min(...values):null; const deltaPercent=historicalMedian&&current>0?((current-historicalMedian)/historicalMedian)*100:null;
  let tone:ShoppingPriceSignal['tone']='unknown'; let label='Sem histórico comparável';
  if(deltaPercent!==null){if(deltaPercent<=-5){tone='good';label=`${Math.abs(deltaPercent).toFixed(0)}% abaixo da mediana`;}else if(deltaPercent>=8){tone='bad';label=`${deltaPercent.toFixed(0)}% acima da mediana`;}else{tone='neutral';label='Dentro da faixa histórica';}}
  return {samples:values.length,median:historicalMedian,latest,lowest,current,deltaPercent,tone,label};
}

export function projectedAverageCost(product: StockProduct, addedQuantity: number, newUnitCost: number) {
  const oldQuantity=Math.max(0,product.current_quantity); const oldCost=Math.max(0,product.average_cost||0); if(!(addedQuantity>0&&newUnitCost>0))return oldCost; if(oldQuantity<=0)return newUnitCost; return (oldQuantity*oldCost+addedQuantity*newUnitCost)/(oldQuantity+addedQuantity);
}
