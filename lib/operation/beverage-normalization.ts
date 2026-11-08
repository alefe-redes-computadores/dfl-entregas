/** R299 P3: bebidas para pedidos, sem atribuir nome de combo à bebida.
 * Somente segmentos que COMEÇAM com um produto de bebida reconhecido são extraídos.
 * Não tenta adivinhar quantidades ocultas no texto de um sanduíche.
 */
export type BeverageToken = { name: string; qty: number };

const BEVERAGE_START = /^(?:coca(?:\s*[- ]\s*cola)?|fanta|guaran[aá]|kuat|sprite|pepsi|schweppes|del\s+valle|suco|[aá]gua|refrigerante|refri|soda|t[oô]nica|cerveja|heineken|energ[eé]tico|red\s*bull)\b/i;
const BEVERAGE_SEPARATOR = /\s*\+\s*|\s*;\s*|\r?\n|,\s+(?=(?:\d{1,3}\s*(?:x|×)?\s*)?(?:coca|fanta|guaran[aá]|kuat|sprite|pepsi|schweppes|suco|[aá]gua|refri|refrigerante|del\s+valle))/i;

function quantityAndName(raw: string): BeverageToken | null {
  let text = String(raw || '').trim()
    .replace(/^\s*(?:[-•*]\s*)+/, '')
    .replace(/^(?:bebidas?|refrigerantes?)\s*[:\-]\s*/i, '')
    .replace(/\s+R\$\s*\d+(?:[.,]\d{2})?\s*$/i, '')
    .trim();
  const qtyMatch = text.match(/^(\d{1,3})\s*(?:x|×)?\s+(?=[\p{L}])/iu) ||
    text.match(/^(\d{1,3})\s*(?:x|×)\s*(?=[\p{L}])/iu);
  let qty = 1;
  if (qtyMatch) {
    qty = Number(qtyMatch[1]);
    text = text.slice(qtyMatch[0].length).trim();
  }
  if (qty > 99 || qty < 1 || !BEVERAGE_START.test(text)) return null;
  text = text
    .replace(/^coca\s*[- ]\s*cola\b/i, 'COCA')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(?:litros?|l)\b/gi, (_, amount: string) => `${amount}L`)
    .replace(/\b(\d{2,4})\s*ml\b/gi, (_, amount: string) => `${amount}ML`)
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR');
  if (!text || text.length > 68) return null;
  return {name: text, qty};
}

export function parseBeverageTokens(value: string): BeverageToken[] {
  const result = new Map<string, BeverageToken>();
  for (const piece of String(value || '').slice(0, 5000).split(BEVERAGE_SEPARATOR)) {
    const token = quantityAndName(piece);
    if (!token) continue;
    const current = result.get(token.name);
    result.set(token.name, {name: token.name, qty: (current?.qty || 0) + token.qty});
  }
  return [...result.values()];
}

export function normalizeBeverageList(input: readonly string[]): string[] {
  const result = new Map<string, number>();
  for (const value of input) {
    const tokens = parseBeverageTokens(value);
    if (!tokens.length) {
      // Entrada manual desconhecida: preservar, nunca apagar bebida informada.
      const original = String(value || "").trim();
      if (original && !result.has(original)) result.set(original, 1);
    }
    for (const token of tokens) {
      result.set(token.name, (result.get(token.name) || 0) + token.qty);
    }
  }
  return [...result].map(([name,qty])=>qty>1?`${qty}x ${name}`:name);
}
