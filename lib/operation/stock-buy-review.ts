/** R299 P13 — Conferência de compra, nunca altera saldo, meta, preço ou pedido. */
import type { StockProduct } from '@/types';

export type StockBuyReview = {
  autoSelect: boolean;
  reasons: string[];
  kind: 'normal' | 'review';
};

type PurchasePreview = { netNeed: number; surplusQuantity: number };
const PACKAGED = new Set(['pct', 'cx', 'fardo']);
const safe = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Só evita a seleção automática. Comprar manualmente permanece uma decisão do operador. */
export function stockBuyReview(product: StockProduct, preview?: PurchasePreview): StockBuyReview {
  const reasons: string[] = [];
  const minimum = Number(product.minimum_quantity);
  const ideal = Number(product.ideal_quantity ?? 0);
  const current = Number(product.current_quantity);
  if (![minimum, ideal, current].every(safe)) {
    reasons.push('Saldo, mínimo ou meta precisam de conferência');
  } else {
    // Diferença expressiva pode ser intencional. Nunca reescreva o cadastro.
    if (minimum > 0 && ideal >= minimum * 5 && ideal - minimum >= 12) {
      reasons.push('Meta muito acima do mínimo; confira unidade e quantidade');
    } else if (minimum === 0 && ideal >= 48) {
      reasons.push('Meta alta sem mínimo cadastrado; confira a quantidade');
    }
  }
  if (PACKAGED.has(product.unit) && (product.presentations || []).some(p =>
    p.active && p.purchase_unit !== product.unit && Number(p.conversion_quantity) > 1
  )) {
    reasons.push('Embalagem e unidade-base exigem conferência de conversão');
  }
  if (preview && safe(preview.netNeed) && safe(preview.surplusQuantity) &&
      preview.netNeed > 0 && preview.surplusQuantity >= Math.max(8, preview.netNeed * 2)) {
    reasons.push('Embalagem arredonda a compra muito acima da falta real');
  }
  const autoSelect = reasons.length === 0;
  return { autoSelect, reasons, kind: autoSelect ? 'normal' : 'review' };
}
