import type { ParsedIfoodOrder } from '@/lib/ifood-order-parser';

export const isFood99Text = (raw: string) =>
  /\b(?:99\s*food|food\s*99)\b/i.test(raw);

/**
 * O 99Food usa um único número comercial de seis dígitos no fluxo atual.
 * O parser compartilhado continua extraindo cliente, pagamento, cupom,
 * bebidas e observações; aqui só corrigimos a identidade do canal.
 */
export function normalizeFood99Order(
  raw: string,
  parsed: ParsedIfoodOrder,
): ParsedIfoodOrder {
  const labelled = raw.match(
    /\b(?:n[º°o.]?\s*(?:do\s+)?pedido|pedido|order)\s*[:#-]?\s*#?\s*(\d{6})\b/i,
  )?.[1];
  const standalone = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^#?\d{6}$/.test(line))
    ?.replace(/\D/g, '');

  return {
    ...parsed,
    orderId: labelled || (/^\d{6}$/.test(parsed.orderId) ? parsed.orderId : standalone || ''),
    ifoodId: '',
    confirmationCode: '',
    routeNumber: '',
    motoboyHint: '',
  };
}
