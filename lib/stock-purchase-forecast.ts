import type { StockSupplier, StockSupply, StockSupplyItem } from '@/types';
import type { StockMarketRow } from '@/lib/stock-market-list';
import { comparableBaseUnitCost } from '@/lib/stock-commercial-health';

/** R97: estimativa a partir de compras RECEBIDAS. Nao e cotacao atual. */
export type StockVendorQuote = {
  supplierKey: string;
  supplierName: string;
  unitBasePrice: number;
  estimatedTotal: number;
  observedAt: string;
  ageDays: number;
  stale: boolean;
  evidenceCount: number;
  unlinked: boolean;
};
export type StockForecastLine = {
  row: StockMarketRow;
  quotes: StockVendorQuote[];
  best: StockVendorQuote | null;
};
export type StockVendorGroup = {
  key: string;
  name: string;
  lines: StockForecastLine[];
  estimate: number;
  staleCount: number;
};
export type StockPurchaseForecast = {
  lines: StockForecastLine[];
  groups: StockVendorGroup[];
  unpriced: StockForecastLine[];
  pricedItems: number;
  totalItems: number;
  partialTotal: number;
  sampleCount: number;
  vendorCount: number;
};
const DAY = 86400_000;
const HISTORY_DAYS = 180;
const STALE_DAYS = 45;
const BRL = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const normal = (text: string) => String(text).normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');

type Evidence = {
  supplierKey: string;
  supplierName: string;
  observedAt: string;
  time: number;
  unitBasePrice: number;
  count: number;
  unlinked: boolean;
};
/**
 * Indexa o historico UMA vez. ID de fornecedor e identidade forte; nome legado
 * so equivale a ID se houver uma correspondencia unica no cadastro.
 * Precos sao comparados por unidade-base do mesmo produto e unidade.
 */
export function buildStockPurchaseForecast(
  rows: readonly StockMarketRow[],
  supplies: readonly StockSupply[],
  suppliers: readonly StockSupplier[],
  now = Date.now(),
): StockPurchaseForecast {
  const products = new Map(rows.map(row => [row.productId, row] as const));
  const catalogById = new Map(suppliers.map(s => [s.id, s] as const));
  const uniqueName = new Map<string, string | null>();
  for (const supplier of suppliers) {
    const key = normal(supplier.name);
    if (!key) continue;
    uniqueName.set(key, uniqueName.has(key) ? null : supplier.id);
  }
  const evidenceByProduct = new Map<string, Map<string, Evidence>>();
  let sampleCount = 0;
  for (const supply of supplies) {
    if (!['recebido', 'conferido'].includes(supply.status) || supply.stock_reversed_at) continue;
    const time = Date.parse(supply.occurred_at);
    if (!Number.isFinite(time) || time > now + 5 * 60_000 || now - time > HISTORY_DAYS * DAY) continue;
    const recordedName = (supply.supplier || '').trim();
    const known = supply.supplier_id ? catalogById.get(supply.supplier_id) : undefined;
    const inferred = !supply.supplier_id && recordedName ? uniqueName.get(normal(recordedName)) : undefined;
    const id = supply.supplier_id || inferred || '';
    const ambiguous = !supply.supplier_id && !!recordedName && uniqueName.has(normal(recordedName)) && inferred === null;
    const supplierKey = id ? `id:${id}` : recordedName ? `legacy:${normal(recordedName)}` : '';
    if (!supplierKey) continue;
    const supplierName = (known?.name || (id ? catalogById.get(id)?.name : '') || recordedName || 'Fornecedor cadastrado') + (ambiguous ? ' (sem ID confiável)' : '');
    for (const item of supply.items) {
      const row = item.stock_product_id ? products.get(item.stock_product_id) : undefined;
      if (!row || (item.unit && item.unit !== row.supplyItem.unit)) continue;
      const price = comparableBaseUnitCost(item as StockSupplyItem);
      if (price === null || !Number.isFinite(price) || price <= 0 || price > 10_000_000) continue;
      const productQuotes = evidenceByProduct.get(row.productId) || new Map<string, Evidence>();
      evidenceByProduct.set(row.productId, productQuotes);
      const before = productQuotes.get(supplierKey);
      sampleCount++;
      // Valores duplicados antigos contam como evidencias, mas nunca somam ao orcamento.
      if (before && time < before.time) { before.count++; continue; }
      productQuotes.set(supplierKey, { supplierKey, supplierName,
        observedAt: supply.occurred_at, time, unitBasePrice: price,
        count: (before?.count || 0) + 1, unlinked: ambiguous });
    }
  }
  const lines: StockForecastLine[] = rows.map(row => {
    const quotes = [...(evidenceByProduct.get(row.productId)?.values() || [])].map(item => {
      const ageDays = Math.max(0, Math.floor((now - item.time) / DAY));
      return { supplierKey: item.supplierKey, supplierName: item.supplierName,
        unitBasePrice: item.unitBasePrice, estimatedTotal: BRL(item.unitBasePrice * row.baseQuantity),
        observedAt: item.observedAt, ageDays, stale: ageDays > STALE_DAYS,
        evidenceCount: item.count, unlinked: item.unlinked } satisfies StockVendorQuote;
    }).sort((a, b) => Number(a.unlinked) - Number(b.unlinked) || a.unitBasePrice - b.unitBasePrice || a.ageDays - b.ageDays ||
      a.supplierName.localeCompare(b.supplierName, 'pt-BR'));
    return { row, quotes, best: quotes.find(quote => !quote.unlinked) || null };
  });
  const map = new Map<string, StockVendorGroup>();
  const unpriced: StockForecastLine[] = [];
  let partialTotal = 0;
  for (const line of lines) {
    const quote = line.best;
    if (!quote) { unpriced.push(line); continue; }
    partialTotal += quote.estimatedTotal;
    const group = map.get(quote.supplierKey) || {
      key: quote.supplierKey, name: quote.supplierName,
      lines: [], estimate: 0, staleCount: 0,
    };
    group.lines.push(line);
    group.estimate += quote.estimatedTotal;
    if (quote.stale) group.staleCount++;
    map.set(quote.supplierKey, group);
  }
  const groups = [...map.values()].map(group => ({ ...group, estimate: BRL(group.estimate) }))
    .sort((a, b) => b.lines.length - a.lines.length || a.name.localeCompare(b.name, 'pt-BR'));
  return { lines, groups, unpriced, pricedItems: lines.length - unpriced.length,
    totalItems: lines.length, partialTotal: BRL(partialTotal),
    sampleCount, vendorCount: new Set(lines.flatMap(line => line.quotes.map(quote => quote.supplierKey))).size };
}

export function stockVendorSpecificLines(forecast: StockPurchaseForecast, supplierKey: string) {
  return forecast.lines.filter(line => line.quotes.some(quote => quote.supplierKey === supplierKey));
}

/** Texto exportavel: inclui SEMPRE os itens sem historico de preco. */
export function stockSupplierPurchaseText(
  forecast: StockPurchaseForecast,
  checked: Readonly<Record<string, string>>,
  date = new Date(),
  supplierKey = '',
): string {
  const out = [
    'DA FAMILIA LANCHES - ROTEIRO DE COMPRAS',
    `Data: ${date.toLocaleDateString('pt-BR')}`,
    'Valores historicos estimados, nao cotacoes atuais.',
    'Marcar na lista nao altera o estoque.',
  ];
  if (supplierKey) {
    const lines = stockVendorSpecificLines(forecast, supplierKey);
    const name = lines.flatMap(line => line.quotes).find(quote => quote.supplierKey === supplierKey)?.supplierName || 'Fornecedor';
    out.push('', `FORNECEDOR: ${name.toLocaleUpperCase('pt-BR')}`);
    for (const line of lines) {
      const quote = line.quotes.find(q => q.supplierKey === supplierKey)!;
      out.push(`${checked[line.row.id] === line.row.signature ? '[x]' : '[ ]'} ${line.row.name} - ${line.row.purchaseText} - historico R$ ${quote.estimatedTotal.toFixed(2).replace('.', ',')} (${quote.ageDays}d)`);
    }
    const withoutQuote = forecast.lines.filter(line => !line.quotes.some(q => q.supplierKey === supplierKey));
    out.push('', `${withoutQuote.length} produto(s) da lista sem preco registrado com este fornecedor.`);
  } else {
    for (const group of forecast.groups) {
      out.push('', `FORNECEDOR: ${group.name.toLocaleUpperCase('pt-BR')}`);
      for (const line of group.lines) {
        out.push(`${checked[line.row.id] === line.row.signature ? '[x]' : '[ ]'} ${line.row.name} - ${line.row.purchaseText} - hist. R$ ${line.best!.estimatedTotal.toFixed(2).replace('.', ',')}`);
      }
      out.push(`Subtotal historico: R$ ${group.estimate.toFixed(2).replace('.', ',')}`);
    }
    if (forecast.unpriced.length) {
      out.push('', 'PRECOS A COTAR');
      for (const line of forecast.unpriced) out.push(`${checked[line.row.id] === line.row.signature ? '[x]' : '[ ]'} ${line.row.name} - ${line.row.purchaseText} - SEM PRECO`);
    }
    out.push('', `Estimativa PARCIAL: R$ ${forecast.partialTotal.toFixed(2).replace('.', ',')} (${forecast.pricedItems}/${forecast.totalItems} com historico)`);
  }
  out.push('', 'Conferencia e recebimento devem ser registrados no DFL.');
  return out.join('\n');
}
