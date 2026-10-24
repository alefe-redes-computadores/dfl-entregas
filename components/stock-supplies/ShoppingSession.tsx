'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Save, Search, ShoppingCart, TrendingDown, TrendingUp, HardDrive, X } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import type { StockSupply, StockSupplyItem } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { indexShoppingPriceHistory, shoppingPriceSignal } from '@/lib/stock-shopping';
import { formatBRLCents, moneyToNumber, numberToBRLInput } from '@/lib/money-input';
import { downloadShoppingListPdf } from '@/lib/shopping-list-pdf';
import { formatStockQuantity } from '@/lib/stock-quantity';
import { buildStockCheckoutPreview } from '@/lib/stock-checkout-preview';
import { reconcileShoppingDraft, shoppingSupplySignature, type ShoppingSessionDraft } from '@/lib/stock-shopping-session-state';

type Draft = ShoppingSessionDraft;
const storageKey = (id: string) => `dfl-shopping-session:${id}`;
const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

// total_price representa o item inteiro. O campo de compra pede preço por apresentação.
function defaultUnitPrice(item: StockSupplyItem): number {
  const explicit = Number(item.purchase_unit_price);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const quantity = Number(item.purchase_quantity ?? 1);
  const total = Number(item.total_price);
  return Number.isFinite(quantity) && quantity > 0 && Number.isFinite(total) && total > 0
    ? Number((total / quantity).toFixed(2))
    : 0;
}

function emptyDraft(items: StockSupplyItem[]): Draft {
  return reconcileShoppingDraft(items, null,
    Object.fromEntries(items.map(item => [item.id, numberToBRLInput(defaultUnitPrice(item))])));
}

function readDraft(id: string, items: StockSupplyItem[]): Draft {
  const base = emptyDraft(items);
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey(id)) || 'null') as unknown;
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return base;
    const raw = stored as { checked?: unknown; prices?: unknown; signatures?: unknown };
    const safeRecord = (value: unknown): Record<string, unknown> =>
      value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const checked = safeRecord(raw.checked);
    const prices = safeRecord(raw.prices);
    const signatures = safeRecord(raw.signatures);
    const safe: Draft = { checked: {}, prices: {}, signatures: {} };
    for (const item of items) {
      safe.checked[item.id] = checked[item.id] === true;
      if (typeof prices[item.id] === 'string') safe.prices[item.id] = prices[item.id] as string;
      if (typeof signatures[item.id] === 'string') safe.signatures[item.id] = signatures[item.id] as string;
    }
    return reconcileShoppingDraft(items, safe, base.prices);
  } catch { return base; }
}

export function ShoppingSession({ supply, onFinish, busy }: {
  supply: StockSupply;
  onFinish: (items: StockSupplyItem[]) => Promise<void>;
  busy: boolean;
}) {
  const products = useAppStore(state => state.stockProducts);
  const supplies = useAppStore(state => state.stockSupplies);
  // O primeiro render deve ser igual no servidor e no Android, antes de ler localStorage.
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(supply.items));
  // Eventos nativos de pausa podem chegar antes do proximo debounce.
  const draftSnapshotRef = useRef<Draft>(draft);
  draftSnapshotRef.current = draft;
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const activeSupplyIdRef = useRef<string | null>(null);
  const saveDraftRef = useRef<(() => void) | null>(null);
  const [query, setQuery] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(35);
  const [finishing, setFinishing] = useState(false);
  const [localDraftSaved, setLocalDraftSaved] = useState(true);
  const finishInFlight = useRef(false);
  // Evita recriar o rascunho após uma finalização confirmada, antes do unmount.
  const completedSessionRef = useRef<string | null>(null);

  const supplySignature = useMemo(() => shoppingSupplySignature(supply.items), [supply.items]);
  const hydrationKey = `${supply.id}:${supplySignature}`;

  useEffect(() => {
    const sameSupply = activeSupplyIdRef.current === supply.id;
    if (!sameSupply) completedSessionRef.current = null;
    activeSupplyIdRef.current = supply.id;
    // Uma atualização do pedido depois da finalização não deve ressuscitar
    // o rascunho já removido do armazenamento local.
    if (completedSessionRef.current === supply.id) return;
    // Mesmo pedido editado com nova quantidade: preserva preços, mas exige
    // conferir novamente apenas as linhas fisicamente modificadas.
    setDraft(previous => sameSupply
      ? reconcileShoppingDraft(supply.items, previous, emptyDraft(supply.items).prices)
      : readDraft(supply.id, supply.items));
    setHydratedKey(hydrationKey);
    // A assinatura é o contrato das linhas, não a identidade do array React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrationKey]);

  useEffect(() => {
    if (hydratedKey !== hydrationKey || finishing || completedSessionRef.current === supply.id) return;
    // Debounce de escrita síncrona no Android; o flush em pagehide assegura
    // o progresso quando a tela for fechada logo após uma alteração.
    const persist = () => {
      if (completedSessionRef.current === supply.id) return;
      try { window.localStorage.setItem(storageKey(supply.id), JSON.stringify(draftSnapshotRef.current)); setLocalDraftSaved(true); }
      catch { setLocalDraftSaved(false); }
    };
    saveDraftRef.current = persist;
    const timer = window.setTimeout(persist, 250);
    return () => { window.clearTimeout(timer); if (saveDraftRef.current === persist) saveDraftRef.current = null; };
  }, [draft, supply.id, hydratedKey, hydrationKey, finishing]);

  useEffect(() => {
    const flush = () => { if (hydratedKey === hydrationKey && !finishing && completedSessionRef.current !== supply.id) saveDraftRef.current?.(); };
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [hydratedKey, hydrationKey, finishing, supply.id]);

  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const priceHistoryByProduct = useMemo(() => indexShoppingPriceHistory(supplies), [supplies]);
  const items = useMemo(() => supply.items.map(item => {
    const price = moneyToNumber(draft.prices[item.id] || '');
    const purchaseQty = Number(item.purchase_quantity ?? 1);
    const conversion = Number(item.conversion_quantity || 1);
    const valid = Number.isFinite(price) && price > 0 && Number.isFinite(purchaseQty) && purchaseQty > 0 && conversion > 0;
    return {
      ...item,
      purchase_unit_price: valid ? price : undefined,
      total_price: valid ? Number((price * purchaseQty).toFixed(2)) : undefined,
      unit_price: valid ? Number((price / conversion).toFixed(4)) : undefined,
    };
  }), [draft.prices, supply.items]);

  const previewByProduct = useMemo(() => buildStockCheckoutPreview(items, productById), [items, productById]);
  const count = items.filter(item => draft.checked[item.id]).length;
  const missingPrices = items.filter(item => draft.checked[item.id] && !(item.total_price && item.total_price > 0)).length;
  const total = items.reduce((sum, item) => sum + (item.total_price || 0), 0);
  const confirmedTotal = items.reduce((sum, item) => sum + (draft.checked[item.id] ? item.total_price || 0 : 0), 0);
  const normalizedQuery = normalized(query);
  const visibleItems = items.filter(item =>
    (!onlyPending || !draft.checked[item.id]) &&
    (!normalizedQuery || normalized(item.name).includes(normalizedQuery)),
  );
  useEffect(() => { setVisibleLimit(35); }, [query, onlyPending, supply.id]);
  const renderedItems = visibleItems.slice(0, visibleLimit);
  const remainingItems = Math.max(0, visibleItems.length - renderedItems.length);
  const pending = items.length - count;
  const locked = busy || finishing || hydratedKey !== hydrationKey;

  const finish = async () => {
    if (locked || finishInFlight.current) return;
    if (!items.length) return void toast.error('A compra está sem produtos.');
    if (count !== items.length) return void toast.error('Ainda existem itens pendentes.');
    if (missingPrices) return void toast.error('Informe o preço dos itens marcados.', {
      description: 'O total e o custo médio dependem desses valores.',
    });
    finishInFlight.current = true;
    setFinishing(true);
    try {
      await onFinish(items);
      completedSessionRef.current = supply.id;
      try { window.localStorage.removeItem(storageKey(supply.id)); } catch { /* sucesso remoto preservado */ }
    } catch (error) {
      toast.error('Não foi possível finalizar. A conferência foi preservada.', {
        description: error instanceof Error ? error.message : 'Confira a conexão e tente novamente.',
      });
    } finally {
      finishInFlight.current = false;
      setFinishing(false);
    }
  };

  return (
    <section className="mt-5 rounded-[24px] border border-zinc-800 bg-zinc-900/35 p-3.5 sm:p-4" aria-label="Conferência no supermercado">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><ShoppingCart size={19}/></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-black text-zinc-100">Conferência da compra</h2>
          <p className="mt-1 text-[11px] text-zinc-400">{count} de {items.length} itens conferidos · {pending} pendentes</p>
          <p className="mt-1 text-[10px] text-zinc-500">Progresso salvo neste aparelho. Se quantidade ou embalagem mudar, o item precisará de nova conferência. O estoque só entra após finalizar.</p>
          {!localDraftSaved && <p role="alert" className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] font-semibold text-amber-200">Não foi possível salvar o progresso local. Evite fechar esta tela antes de finalizar.</p>}
        </div>
        <HardDrive size={16} className="shrink-0 text-emerald-400/70" aria-label="Rascunho armazenado neste aparelho"/>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={items.length || 1} aria-valuenow={count} aria-label="Itens conferidos" className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-900">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{width:`${items.length ? count / items.length * 100 : 0}%`}} />
      </div>
      <div className="mt-3 flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 focus-within:border-amber-500/50">
          <Search size={15} className="shrink-0 text-zinc-500"/>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar item" aria-label="Buscar item da compra" className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none"/>
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca" className="grid h-8 w-8 place-items-center"><X size={15}/></button>}
        </label>
        <button type="button" aria-pressed={onlyPending} onClick={() => setOnlyPending(value => !value)} className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${onlyPending ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-zinc-800 text-zinc-400'}`}>Pendentes · {pending}</button>
      </div>
      <div className="mt-4 space-y-2">
        {renderedItems.map(item => {
          const marked = draft.checked[item.id] === true;
          const product = productById.get(item.stock_product_id || '');
          const unitCost = item.unit_price || 0;
          const signal = product ? shoppingPriceSignal(product, supplies, unitCost, priceHistoryByProduct) : null;
          const preview = product ? previewByProduct.get(product.id) : undefined;
          const projected = preview?.balanceAfter ?? 0;
          const nextCost = preview?.averageCostAfter ?? null;
          return (
            <article key={item.id} className={`rounded-2xl border p-3 ${marked ? 'border-emerald-500/30 bg-emerald-500/[.05]' : 'border-zinc-800 bg-zinc-950/50'}`}>
              <button type="button" disabled={locked} aria-pressed={marked} aria-label={`${marked ? 'Desmarcar' : 'Conferir'} ${item.name}`} onClick={() => setDraft(previous => ({...previous, checked: {...previous.checked, [item.id]: !previous.checked[item.id]}}))} className="flex min-h-11 w-full items-center gap-3 text-left disabled:opacity-60">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${marked ? 'border-emerald-500 bg-emerald-500 text-zinc-950' : 'border-zinc-700 text-zinc-600'}`}><Check size={16}/></span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-zinc-100">{item.name}</strong><small className="text-zinc-500">{item.purchase_quantity && item.presentation_label ? `${item.purchase_quantity} × ${item.presentation_label}` : formatStockQuantity(item.quantity, item.unit)}</small></span>
              </button>
              <label className="mt-3 block text-[11px] font-bold text-zinc-400">Preço por {item.presentation_label || item.purchase_unit || item.unit}
                <input inputMode="numeric" disabled={locked} value={draft.prices[item.id] || 'R$ 0,00'} onChange={event => setDraft(previous => ({...previous, prices: {...previous.prices, [item.id]: formatBRLCents(event.target.value)}}))} className={`mt-1 h-11 w-full rounded-xl border bg-zinc-900 px-3 text-base font-bold text-zinc-100 outline-none disabled:opacity-60 ${marked && !item.total_price ? 'border-red-500/50' : 'border-zinc-800 focus:border-amber-500'}`}/>
              </label>
              {product && <details className="mt-2 rounded-xl border border-zinc-800/80 bg-zinc-900/45 px-3 py-2.5">
                <summary className="cursor-pointer text-[10px] font-bold text-zinc-400">Estoque estimado e comparação de custos</summary>
                <div className="flex items-center justify-between gap-2"><span className="text-[10px] text-zinc-500">Estoque após a compra {formatStockQuantity(product.current_quantity, product.unit)} → <b className="text-zinc-200">{formatStockQuantity(projected, product.unit)}</b>{preview && preview.lineCount > 1 ? <small className="block text-amber-300">Somando {preview.lineCount} itens deste produto</small> : null}</span>
                  {unitCost > 0 && signal && <span className={`flex shrink-0 items-center gap-1 text-[10px] font-bold ${signal.tone === 'good' ? 'text-emerald-400' : signal.tone === 'bad' ? 'text-red-400' : 'text-zinc-400'}`}>{signal.tone === 'good' ? <TrendingDown size={12}/> : signal.tone === 'bad' ? <TrendingUp size={12}/> : null}{signal.label}</span>}
                </div>
                {nextCost !== null && <p className="mt-2 text-[10px] text-zinc-500">Custo médio projetado: <b className="text-emerald-400">{currency(nextCost)}</b></p>}
                {nextCost === null && <p className="mt-2 text-[10px] text-amber-300">Informe o preço de todos os itens deste produto para prever o custo médio.</p>}
              </details>}
            </article>
          );
        })}
      </div>
      {remainingItems > 0 && <button type="button" onClick={() => setVisibleLimit(limit => limit + 35)} className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/[.06] text-xs font-bold text-amber-300">Mostrar mais itens ({remainingItems} restantes)</button>}
      {!visibleItems.length && <div className="mt-4 rounded-2xl border border-dashed border-zinc-800 p-6 text-center text-xs text-zinc-400">{onlyPending && !pending ? 'Todos os itens já foram conferidos.' : 'Nenhum item neste filtro.'}</div>}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
        <div><p className="text-[10px] font-bold text-zinc-500">Itens conferidos</p><p className="mt-1 text-base font-black text-emerald-400">{currency(confirmedTotal)}</p></div>
        <div className="text-right"><p className="text-[10px] font-bold text-zinc-500">Lista completa · estimativa</p><p className="mt-1 text-base font-black text-zinc-200">{currency(total)}</p></div>
        <p className="col-span-2 border-t border-zinc-800 pt-2 text-[10px] text-zinc-500">Valores informados para a compra; o total da lista inclui itens ainda não conferidos. O estoque só é atualizado após finalizar.</p>
      </div>
      {missingPrices > 0 && <p role="alert" className="mt-2 text-xs font-bold text-red-300">{missingPrices} item(ns) marcado(s) sem preço válido.</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => downloadShoppingListPdf({...supply, items, total_amount: total}, draft.checked)} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-zinc-700 text-xs font-bold text-zinc-300"><Download size={16}/>Lista PDF</button>
        <button type="button" disabled={locked || !items.length || count !== items.length || missingPrices > 0} aria-busy={finishing} onClick={() => void finish()} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-black text-zinc-950 disabled:opacity-40"><Save size={16}/>{locked ? 'Salvando...' : 'Finalizar compra'}</button>
      </div>
    </section>
  );
}
