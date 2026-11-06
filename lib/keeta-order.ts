/**
 * R283 — Keeta: importação conservadora de texto copiado de pedidos.
 * Sem SDK, API, scraping ou vínculo com o serviço da plataforma.
 * Números e valores não rotulados NÃO são inferidos; campos incertos pedem revisão.
 */
import type { ParsedIfoodOrder } from '@/lib/ifood-order-parser';

export const isKeetaText = (raw: string) =>
  /^(?:\s*keeta\b|\s*(?:canal|origem|plataforma)\s*[:\-]\s*keeta\b)/im.test(raw);

export const isKeetaCommercialId = (value: string) =>
  /^[a-z0-9][a-z0-9-]{2,39}$/i.test(value.trim());

const emptyKeetaOrder = (): ParsedIfoodOrder => ({
  orderId: '', ifoodId: '', confirmationCode: '', customerName: '',
  phone: '', address: '', mapsLink: '', isPaid: false, paymentMethod: null,
  value: '', customerCharge: '', subsidy: '', changeFor: '', drinks: [],
  observations: [], routeNumber: '', motoboyHint: '',
});

const orderLabel = /^(?:(?:n[úu]mero|n[º°o.]?)\s*(?:do\s+)?pedido|pedido(?:\s*n[º°o.]?)?|order\s*(?:id|number)?)\s*[:#º°\-]?\s*#?\s*([A-Z0-9][A-Z0-9-]{2,39})(?=\s|$)/i;
const moneyLabel = /^(?:total\s*(?:do\s+pedido)?|valor\s*(?:total|do\s+pedido)?|cliente\s+paga)\s*[:\-]?\s*(?:R\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+)(?:[.,]\d{2})?)\b/i;
const drinkWord = /\b(?:coca(?:-cola)?|guaran[aá]|fanta|sprite|suco|refrigerante|refri|[aá]gua(?:\s+mineral)?|schweppes|del\s+valle|kuat|pepsi|soda|t[oô]nica)\b/i;
const moneyValue = (value: string): string => {
  const raw = value.trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 && amount <= 999999
    ? amount.toFixed(2).replace('.', ',') : '';
};

/** Um pedido por texto. Múltiplos IDs comerciais diferentes são recusados. */
export function parseKeetaOrdersText(raw: string): ParsedIfoodOrder[] {
  const lines = String(raw || '').slice(0, 16000).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const result = emptyKeetaOrder();
  const labelledIds = lines.map(line => line.match(orderLabel)?.[1] || '').filter(Boolean);
  const distinctIds = [...new Set(labelledIds.map(value => value.toUpperCase()))];
  // Fail-closed: jamais ignorar pedidos adicionais de uma colagem múltipla.
  if (distinctIds.length > 1) return [];
  result.orderId = labelledIds[0] || '';

  const customer = lines.map(line => line.match(/^(?:cliente|nome\s*(?:do\s+)?cliente)\s*[:\-]\s*(.{2,90})$/i)?.[1]?.trim()).find(Boolean);
  result.customerName = customer || '';
  const value = lines.map(line => line.match(moneyLabel)?.[1]).find(Boolean);
  result.customerCharge = moneyValue(value || '');
  result.value = result.customerCharge;

  const payment = lines.find(line => /^forma\s+de\s+pagamento\s*[:\-]|^pagamento\s*[:\-]/i.test(line)) || '';
  if (/\bpix\b/i.test(payment)) result.paymentMethod = 'pix';
  else if (/\bcart[aã]o|cr[eé]dito|d[eé]bito\b/i.test(payment)) result.paymentMethod = 'cartao';
  else if (/\bdinheiro\b/i.test(payment)) result.paymentMethod = 'dinheiro';
  result.isPaid = lines.some(line => /\b(?:pago\s+no\s+app|pagamento\s+aprovado|pago\s+online|j[aá]\s+pago|pr[eé]-?pago)\b/i.test(line));

  const drinks: string[] = [];
  const observations: string[] = [];
  for (const line of lines) {
    if (/^(?:obs(?:erva[cç][aã]o)?|observa[cç][oõ]es?|nota)\s*[:\-]/i.test(line)) {
      const note = line.replace(/^[^:\-]{2,35}[:\-]\s*/, '').slice(0, 300).trim();
      if (note) observations.push(note);
      continue;
    }
    if (/^bebidas?\s*[:\-]/i.test(line)) {
      const content = line.replace(/^bebidas?\s*[:\-]\s*/i, '').trim();
      if (content && !/^(?:nenhuma|sem\s+bebidas?|n[aã]o\s+informad[ao]s?)$/i.test(content)) drinks.push(content.slice(0, 150));
      continue;
    }
    if (/^(?:total|valor|pagamento|cliente|nome|pedido|n[úu]mero|obs|endereço|rua|bairro|cep|troco|taxa)\b/i.test(line)) continue;
    if (drinkWord.test(line) && !/https?:\/\//i.test(line)) {
      const candidate = line.replace(/\s*(?:R\$\s*)?\d+[.,]\d{2}\s*$/, '').trim();
      if (candidate) drinks.push(candidate.slice(0, 150));
    }
  }
  result.drinks = [...new Set(drinks)].slice(0, 16);
  result.observations = [...new Set(observations)].slice(0, 8);
  return [result];
}
