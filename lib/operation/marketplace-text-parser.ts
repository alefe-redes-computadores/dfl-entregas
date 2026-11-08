import type { OrderOrigin } from '@/types';
import { parseIfoodOrderText, type ParsedIfoodOrder } from '@/lib/ifood-order-parser';
import { parseKeetaOrdersText } from '@/lib/keeta-order';
import { normalizeFood99Order } from '@/lib/food99-order';

/** Uma unica regra de importacao por plataforma para Novo e Editar.
 * Nao interpreta uma origem como outra, nem inventa ID/codigo de confirmacao.
 */
export function parseMarketplaceText(
  origin: OrderOrigin,
  text: string,
): ParsedIfoodOrder | null {
  const input = text.trim();
  if (!input || input.length > 16000) return null;
  if (origin === 'keeta') return parseKeetaOrdersText(input)[0] || null;
  const base = parseIfoodOrderText(input);
  if (origin === 'food99') return normalizeFood99Order(input, base);
  if (origin === 'ifood') return base;
  return null;
}
