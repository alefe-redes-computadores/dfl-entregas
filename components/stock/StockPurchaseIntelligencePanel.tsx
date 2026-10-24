'use client';

import { useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { ArrowDownUp, ChevronDown, ClipboardCopy, FileText, Info, Share2, Store, TrendingDown } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { useAppStore } from '@/store/useAppStore';
import { exportStockMarketPdf } from '@/lib/stock-market-pdf';
import { buildStockPurchaseForecast, stockSupplierPurchaseText, stockVendorSpecificLines } from '@/lib/stock-purchase-forecast';
import type { StockMarketRow } from '@/lib/stock-market-list';

type Props = {
  rows: readonly StockMarketRow[];
  checked: Readonly<Record<string, string>>;
  invalid: boolean;
};
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pulse = () => {
  if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
};

/** R97 — somente planejamento derivado do store, sem novas consultas Firestore. */
export function StockPurchaseIntelligencePanel({ rows, checked, invalid }: Props) {
  const supplies = useAppStore(state => state.stockSupplies);
  const suppliers = useAppStore(state => state.stockSuppliers);
  const forecast = useMemo(() => buildStockPurchaseForecast(rows, supplies, suppliers), [rows, supplies, suppliers]);
  const [expanded, setExpanded] = useState(false);
  const [supplierKey, setSupplierKey] = useState('');
  const [busyAction, setBusyAction] = useState<'share' | 'copy' | 'pdf' | null>(null);
  const actionLock = useRef(false);
  const [shown, setShown] = useState(8);
  const supplierKeys = useMemo(() => {
    const found = new Map<string, string>();
    for (const line of forecast.lines) for (const quote of line.quotes) found.set(quote.supplierKey, quote.supplierName);
    return [...found].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [forecast.lines]);
  const chosenValid = supplierKeys.some(item => item.key === supplierKey) ? supplierKey : '';
  const selectedLines = chosenValid ? stockVendorSpecificLines(forecast, chosenValid) : forecast.lines;
  const supplierTotal = chosenValid ? selectedLines.reduce((sum, line) => sum +
    (line.quotes.find(quote => quote.supplierKey === chosenValid)?.estimatedTotal || 0), 0) : forecast.partialTotal;
  const unpricedForSelection = chosenValid ? forecast.totalItems - selectedLines.length : forecast.unpriced.length;
  const budgetIncomplete = unpricedForSelection > 0;
  const summaryIsEmpty = forecast.totalItems === 0;

  const text = () => stockSupplierPurchaseText(forecast, checked, new Date(), chosenValid);
  const run = async (kind: 'share' | 'copy' | 'pdf') => {
    if (actionLock.current || invalid || summaryIsEmpty || (chosenValid && selectedLines.length === 0)) {
      if (invalid) toast.error('Revise as quantidades inválidas antes de exportar o roteiro.');
      return;
    }
    actionLock.current = true;
    setBusyAction(kind);
    try {
      if (kind === 'pdf') {
        // O PDF especifico contem somente itens com preco deste fornecedor.
        // A lista geral, incluindo itens sem cotacao, continua no painel R96.
        const mode = await exportStockMarketPdf(selectedLines.map(line => line.row), checked);
        toast.success(mode === 'shared' ? 'PDF enviado para compartilhamento.' : 'PDF do fornecedor preparado.');
      } else if (kind === 'share') {
        const message = text();
        if (Capacitor.isNativePlatform()) {
          await Share.share({ title: 'DFL - Roteiro por fornecedor', text: message, dialogTitle: 'Enviar roteiro de compras' });
        } else if (navigator.share) {
          await navigator.share({ title: 'DFL - Roteiro de compras', text: message });
        } else {
          await copyToClipboard(message);
          toast.success('Roteiro copiado para colar no Samsung Notes ou WhatsApp.');
        }
      } else {
        await copyToClipboard(text());
        toast.success('Roteiro copiado. Os itens sem preço também foram incluídos.');
      }
      pulse();
    } catch (error) {
      const cancelled = (error as { name?: string })?.name === 'AbortError' || /cancel/i.test(String(error));
      if (!cancelled) toast.error(kind === 'pdf'
        ? 'Não foi possível gerar o PDF desta loja. Tente copiar o roteiro.'
        : 'Não foi possível compartilhar ou copiar o roteiro. Tente novamente.');
    } finally {
      actionLock.current = false;
      setBusyAction(null);
    }
  };

  return (
    <section aria-label="Inteligência de compras e fornecedores R97" className="mb-4 overflow-hidden rounded-[24px] border border-amber-500/20 bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-amber-950/15 shadow-[0_15px_38px_rgba(0,0,0,.13)]">
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300"><TrendingDown size={19} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-black text-zinc-100">Inteligência de compras</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">Orçamento calculado com preços de compras recebidas nos últimos 180 dias.</p>
          </div>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[9px] font-black text-amber-300">R97</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-3 py-3">
            <span className="text-[9px] font-bold text-zinc-500">Estimativa {forecast.unpriced.length ? 'parcial' : 'histórica'}</span>
            <p className="mt-0.5 text-lg font-black tracking-tight text-zinc-100" aria-label="Total estimado de itens precificados">{forecast.pricedItems ? money(forecast.partialTotal) : 'Sem histórico'}</p>
            <p className="mt-1 text-[9px] text-zinc-500">{forecast.pricedItems} de {forecast.totalItems} itens com preço</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-3 py-3">
            <span className="text-[9px] font-bold text-zinc-500">Cotações a revisar</span>
            <p className="mt-0.5 text-lg font-black tracking-tight text-amber-300">{forecast.unpriced.length}</p>
            <p className="mt-1 text-[9px] text-zinc-500">{forecast.vendorCount} fornecedor(es) com histórico</p>
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-zinc-500"><Info size={13} className="mt-0.5 shrink-0" />Preços anteriores não garantem oferta atual. Total parcial não é o custo final da compra.</p>
        {forecast.lines.some(line => line.best?.stale) && <p className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/[.065] px-3 py-2 text-[10px] text-amber-200">Alguns preços têm mais de 45 dias. Confirme antes de comprar.</p>}
        {summaryIsEmpty ? (
          <p className="mt-3 text-xs text-zinc-500">Selecione produtos para comparar os custos históricos e montar seu roteiro por fornecedor.</p>
        ) : (
          <button type="button" aria-expanded={expanded} onClick={() => { setExpanded(value => !value); setShown(8); pulse(); }} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-amber-500/25 bg-amber-500/[.06] px-3 text-left text-[11px] font-black text-amber-200 active:bg-amber-500/10">
            <span className="flex items-center gap-2"><Store size={16}/>{expanded ? 'Ocultar comparador' : 'Comparar fornecedores e organizar compras'}</span>
            <ChevronDown size={16} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}/>
          </button>
        )}
      </div>
      {expanded && !summaryIsEmpty && <div className="border-t border-zinc-800/80 bg-zinc-950/35 p-3.5">
        <label htmlFor="r97-supplier" className="mb-1.5 block text-[10px] font-bold text-zinc-300">Roteiro para</label>
        <div className="relative">
          <select id="r97-supplier" value={chosenValid} onChange={event => { setSupplierKey(event.target.value); setShown(8); pulse(); }} className="h-12 w-full appearance-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 pr-10 text-xs font-bold text-zinc-100 outline-none focus:border-amber-500/70">
            <option value="">Melhores preços registrados por produto</option>
            {supplierKeys.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}
          </select>
          <ArrowDownUp size={15} className="pointer-events-none absolute right-3 top-4 text-amber-400"/>
        </div>
        <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/55 p-3">
          <p className="text-[10px] font-bold text-zinc-200">{chosenValid ? 'Histórico específico deste fornecedor' : 'Roteiro sugerido com base no menor histórico'}</p>
          <p className="mt-1 text-[11px] text-zinc-400">{selectedLines.length} produto(s) com preço · {money(supplierTotal)} estimados</p>
          {budgetIncomplete && <p role="note" className="mt-1 text-[10px] text-amber-300">{unpricedForSelection} produto(s) da lista ainda sem preço para esta seleção. Não serão tratados como gratuitos.</p>}
        </div>
        <div className="mt-2 space-y-1.5" aria-label="Preços anteriores por item">
          {selectedLines.slice(0, shown).map(line => {
            const quote = chosenValid ? line.quotes.find(entry => entry.supplierKey === chosenValid) : line.best;
            return <div key={line.row.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/55 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-zinc-100">{line.row.name}</p>
                <p className="mt-0.5 text-[9px] text-zinc-500">{line.row.purchaseText}</p>
                <p className="mt-1 truncate text-[9px] text-zinc-400">{quote ? `${quote.supplierName} · ${quote.ageDays} dia(s) atrás${quote.stale ? ' · antigo' : ''}` : 'Sem preço no histórico'}</p>
              </div>
              <span className="shrink-0 text-right text-[11px] font-black text-zinc-200">{quote ? money(quote.estimatedTotal) : 'A cotar'}</span>
            </div>;
          })}
          {selectedLines.length > shown && <button type="button" onClick={() => setShown(value => value + 15)} className="min-h-11 w-full rounded-xl border border-zinc-700 text-[11px] font-bold text-zinc-300">Ver mais {Math.min(15, selectedLines.length - shown)} de {selectedLines.length} itens</button>}
          {!selectedLines.length && <p className="rounded-xl border border-dashed border-zinc-700 p-4 text-[11px] text-zinc-500">Não há preços registrados para esta loja nos últimos 180 dias.</p>}
        </div>
        {!chosenValid && forecast.groups.length > 0 && <div className="mt-3 border-t border-zinc-800 pt-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-500">Grupos por fornecedor · menor histórico</p>
          {forecast.groups.slice(0, 5).map(group => <p key={group.key} className="flex justify-between gap-3 py-1 text-[10px] text-zinc-400"><span className="min-w-0 truncate">{group.name} · {group.lines.length} item(ns)</span><span className="shrink-0 font-bold text-zinc-200">{money(group.estimate)}</span></p>)}
          {forecast.groups.length > 5 && <p className="text-[9px] text-zinc-500">+{forecast.groups.length - 5} fornecedores no roteiro exportado.</p>}
        </div>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={!!busyAction || invalid} onClick={() => void run('copy')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-2 text-[11px] font-black text-zinc-200 active:bg-zinc-800 disabled:opacity-40"><ClipboardCopy size={15}/>Copiar roteiro</button>
          <button type="button" disabled={!!busyAction || invalid} onClick={() => void run('share')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 text-[11px] font-black text-amber-200 active:bg-amber-500/20 disabled:opacity-40"><Share2 size={15}/>Compartilhar</button>
        </div>
        {chosenValid && <button type="button" disabled={!!busyAction || invalid || !selectedLines.length} onClick={() => void run('pdf')} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/80 text-[11px] font-bold text-zinc-200 disabled:opacity-40"><FileText size={15}/>{busyAction === 'pdf' ? 'Gerando PDF...' : 'PDF dos itens desta loja'}</button>}
        <p className="mt-2 text-[9px] leading-relaxed text-zinc-500">Este comparador não compra, não altera fornecedores nem movimenta o estoque. Itens sem histórico permanecem na lista geral R96.</p>
      </div>}
    </section>
  );
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  const element = document.createElement('textarea');
  element.value = text;
  element.setAttribute('readonly', '');
  element.style.position = 'fixed';
  element.style.opacity = '0';
  document.body.appendChild(element);
  try { element.select(); if (!document.execCommand('copy')) throw new Error('clipboard unavailable'); }
  finally { element.remove(); }
}
