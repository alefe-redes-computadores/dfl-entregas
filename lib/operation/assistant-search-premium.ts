/**
 * DFL Entregas R245 (R238 plano) — Busca 360 local, contextual e sem I/O.
 * Não altera entidade, não consulta Firebase e não produz status/ETA.
 */
import type { Customer, Delivery, Motoboy, Route, StockProduct } from '@/types';
import { matchesOperationSearch, normalizeOperationSearch } from '@/lib/operation/searchR99';

export type Search360Kind = 'delivery' | 'customer' | 'route' | 'stock' | 'motoboy';
export type Search360Result = Readonly<{
  id: string; kind: Search360Kind; title: string; detail: string; href: string; score: number;
}>;
export type Search360TimeIntent = Readonly<{ hour: number; minute: number; around: boolean }>;
export type Search360Snapshot = Readonly<{
  deliveries: readonly Delivery[];
  customers: readonly Customer[];
  routes: readonly Route[];
  products: readonly StockProduct[];
  motoboys?: readonly Motoboy[];
}>;

const TIME_ZONE = 'America/Sao_Paulo';
const text = (value: unknown) => typeof value === 'string' ? value : '';
// Índice fraco por snapshot imutável: evita reconstruir o mapa de clientes
// a cada caractere, sem manter snapshots antigos vivos após substituição.
const customerNameIndexes = new WeakMap<readonly Customer[], Map<string, string>>();
function customerNameIndex(customers: readonly Customer[]): Map<string, string> {
  const existing = customerNameIndexes.get(customers);
  if (existing) return existing;
  const index = new Map(customers.map(customer => [customer.id, customer.name]));
  customerNameIndexes.set(customers, index);
  return index;
}
const safeId = (value: unknown) => encodeURIComponent(text(value).slice(0, 1300));
const ascii = (value: unknown) => text(value).normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const HOUR_EXPRESSION = /\b(?:(?:por volta d[ae]s?|perto d[ae]s?|as|das|pelas?)\s+)([01]?\d|2[0-3])(?::([0-5]\d))?\s*(?:h(?:oras?)?)?(?=\b|$)/i;
// Reutilizar formatadores: construí-los para cada pedido e tecla é caro no Android.
const ORDER_CLOCK_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false,
});
const ORDER_DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE, day: '2-digit', month: '2-digit',
});
const ORDER_TIME_EXPRESSION = /\b(?:pedidos?|entregas?)\s+([01]?\d|2[0-3]):([0-5]\d)\b/i;

/** Apenas expressões de horário explícitas: não confundir código de pedido com hora. */
export function parseAssistantTimeIntent(raw: string): Search360TimeIntent | null {
  const input = ascii(raw).slice(0, 110);
  const match = HOUR_EXPRESSION.exec(input) ?? ORDER_TIME_EXPRESSION.exec(input) ?? /^(?:\s*)([01]?\d|2[0-3]):([0-5]\d)(?:\s*)$/.exec(input);
  if (!match) return null;
  const hour = Number(match[1]), minute = match[2] ? Number(match[2]) : 0;
  if (!Number.isInteger(hour) || hour > 23 || !Number.isInteger(minute) || minute > 59) return null;
  return { hour, minute, around: /\b(?:por volta|perto)\b/.test(input) };
}

export function assistantSearchCategory(raw: string): Search360Kind | null {
  const q = normalizeOperationSearch(raw);
  if (/\b(pedidos?|entregas?)\b/.test(q)) return 'delivery';
  if (/\b(rotas?)\b/.test(q)) return 'route';
  if (/\b(motoboys?|entregadores?)\b/.test(q)) return 'motoboy';
  if (/\b(estoque|produtos?|itens?)\b/.test(q)) return 'stock';
  if (/\b(clientes?)\b/.test(q)) return 'customer';
  return null;
}

/** Remove apenas a instrução; o texto útil fica para o ranking. */
export function assistantSearchTerms(raw: string): string {
  let value = ascii(raw).slice(0, 110);
  const temporal = HOUR_EXPRESSION.exec(value) ?? ORDER_TIME_EXPRESSION.exec(value);
  if (temporal) value = value.replace(temporal[0], ' ');
  else if (/^\s*\d{1,2}:\d{2}\s*$/.test(value)) value = '';
  return normalizeOperationSearch(value)
    .replace(/\b(?:quero|preciso|pode|buscar|procurar|encontrar|localizar|mostrar|abrir|ver|listar|pesquisar|filtrar|um|uma|os|as|o|a|de|do|da|dos|das|por|no|na|nas|nos|com|pelo|pela|pelos|pelas|pedido|pedidos|entrega|entregas|cliente|clientes|motoboy|motoboys|entregador|entregadores|rota|rotas|estoque|produto|produtos|item|itens|codigo|numero)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Horário é calculado na hora da consulta, sem inferir data de campos ausentes. */
export function localOrderClock(value: unknown): Readonly<{ minuteOfDay: number; label: string }> | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  const parts = ORDER_CLOCK_FORMATTER.formatToParts(timestamp);
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  const minute = Number(parts.find(part => part.type === 'minute')?.value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  const date = ORDER_DATE_FORMATTER.format(timestamp);
  return { minuteOfDay: hour * 60 + minute, label: `${date} · ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}` };
}

function matchesClock(value: number, wanted: Search360TimeIntent): boolean {
  const target = wanted.hour * 60 + wanted.minute;
  const diff = Math.abs(value - target);
  return wanted.around ? Math.min(diff, 1440 - diff) <= 15 : diff === 0;
}

function fieldScore(value: unknown, terms: string, id = false): number {
  if (!terms || !text(value)) return -1;
  const norm = normalizeOperationSearch(value);
  if (norm === terms) return id ? 1800 : 1050;
  if (norm.startsWith(terms)) return id ? 1450 : 790;
  if (norm.includes(terms)) return id ? 1100 : 530;
  return matchesOperationSearch(value, terms) ? 290 : -1;
}

export function searchAssistantSnapshotPremium(
  raw: string, snapshot: Search360Snapshot, limit = 12,
): Search360Result[] {
  const cap = Number.isFinite(limit) ? Math.max(0, Math.min(40, Math.trunc(limit))) : 0;
  if (!cap) return [];
  const time = parseAssistantTimeIntent(raw);
  const terms = assistantSearchTerms(raw);
  if (!terms && !time) return [];
  const scope = assistantSearchCategory(raw);
  if (time && scope && scope !== 'delivery') return [];
  const results: Search360Result[] = [];
  const allowed = (kind: Search360Kind) => !scope || scope === kind;
  const add = (item: Search360Result) => results.push(item);
  const best = (fields: readonly (string | undefined | null)[], idFields: readonly (string | undefined | null)[] = []) => {
    if (!terms) return 1;
    return Math.max(-1,
      ...fields.map(value => fieldScore(value, terms)),
      ...idFields.map(value => fieldScore(value, terms, true)),
    );
  };

  if (allowed('delivery')) {
    const customerById = customerNameIndex(snapshot.customers);
    for (const delivery of snapshot.deliveries) {
      // Busca por nome/código não precisa formatar horário de todos os pedidos.
      // Na busca temporal, calcular só quando o filtro realmente exige.
      const timeValue = time ? localOrderClock(delivery.created_at ?? delivery.createdAt) : null;
      if (time && (!timeValue || !matchesClock(timeValue.minuteOfDay, time))) continue;
      const score = best([
        delivery.customer_name, customerById.get(delivery.customer_id), delivery.address_string,
        delivery.order_id, delivery.ifood_id, delivery.external_order_id,
      ], [delivery.id, delivery.order_id, delivery.ifood_id, delivery.external_order_id]);
      if (score < 0) continue;
      const code = delivery.order_id || delivery.ifood_id || delivery.external_order_id || delivery.id.slice(0,8);
      // Horário do card é solicitado apenas para resultados candidatos,
      // jamais para milhares de pedidos que não correspondem ao nome digitado.
      const displayClock = timeValue ?? localOrderClock(delivery.created_at ?? delivery.createdAt);
      const customer = delivery.customer_name || customerById.get(delivery.customer_id) || 'Cliente não identificado';
      const detail = [ `Pedido ${code}`, displayClock?.label, delivery.address_string ].filter(Boolean).join(' · ').slice(0,170);
      add({id:`delivery:${delivery.id}`,kind:'delivery',title:customer,detail,href:`/entregas/details?id=${safeId(delivery.id)}`,score:score + (time ? 100 : 0)});
    }
  }
  if (!time && allowed('customer')) for (const customer of snapshot.customers) {
    const score = best([customer.name, customer.address, customer.neighborhood, customer.phone], [customer.id]);
    if (score < 0) continue;
    add({id:`customer:${customer.id}`,kind:'customer',title:customer.name,detail:'Ficha do cliente · cadastro local',href:`/clientes/details?id=${safeId(customer.id)}`,score});
  }
  if (!time && allowed('route')) for (const route of snapshot.routes) {
    const score = best([route.name, route.motoboy_name], [route.id]);
    if (score < 0) continue;
    add({id:`route:${route.id}`,kind:'route',title:route.name,detail:`Rota · ${route.motoboy_name || 'Responsável não definido'}`,href:`/rotas/details?id=${safeId(route.id)}`,score});
  }
  if (!time && allowed('stock')) for (const product of snapshot.products) {
    if (!product.active) continue;
    const score = best([product.name,product.category,product.barcode], [product.id,product.barcode]);
    if (score < 0) continue;
    add({id:`stock:${product.id}`,kind:'stock',title:product.name,detail:'Produto do estoque',href:`/estoque/detalhes?id=${safeId(product.id)}&from=estoque`,score});
  }
  if (!time && allowed('motoboy')) for (const motoboy of snapshot.motoboys ?? []) {
    const score = best([motoboy.name], [motoboy.id]);
    if (score < 0) continue;
    add({id:`motoboy:${motoboy.id}`,kind:'motoboy',title:motoboy.name,detail:motoboy.active?'Motoboy cadastrado':'Motoboy inativo',href:`/motoboys/details?id=${safeId(motoboy.id)}`,score});
  }
  return results.sort((a,b) => b.score-a.score || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title,'pt-BR') || a.id.localeCompare(b.id)).slice(0,cap);
}

const EXAMPLE_GROUPS = [
  ['Pedidos às 15:00','Pedidos por volta das 19:00','Entregas pendentes','Caixa de entrada'],
  ['Rotas em montagem','Rota Azul','Rotas na rua','Motoboy Bruno'],
  ['Produtos abaixo do mínimo','Bacon no estoque','Produtos zerados','Estoque de ovos'],
  ['Compras','Pedido 845211','Cliente João','Pagamentos pendentes'],
] as const;
/** Variedade somente da sessão; nunca persiste texto livre ou dados de clientes. */
export function assistantSessionExamples(seed: number): string[] {
  const offset = Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0;
  return EXAMPLE_GROUPS.map((group,index)=>group[(offset + index*3) % group.length]);
}

/** Enter só navega quando não existe empate entre registros igualmente relevantes. */
export function resolveAssistantEnter(
  raw: string, matches: readonly Search360Result[], destinationHref?: string,
): Readonly<{ state: 'match' | 'destination' | 'choose' | 'none'; href?: string }> {
  const top = matches[0];
  const time = parseAssistantTimeIntent(raw);
  const specific = Boolean(assistantSearchTerms(raw));
  if (top && (time || (specific && top.score >= 520))) {
    if (matches.some((next,index) => index > 0 && next.score === top.score && next.kind === top.kind))
      return {state:'choose'};
    return {state:'match',href:top.href};
  }
  if (destinationHref?.startsWith('/') && !destinationHref.startsWith('//') && !time)
    return {state:'destination',href:destinationHref};
  if (top) {
    if (matches.some((next,index)=> index>0 && next.score === top.score && next.kind === top.kind))
      return {state:'choose'};
    return {state:'match',href:top.href};
  }
  return {state:'none'};
}
