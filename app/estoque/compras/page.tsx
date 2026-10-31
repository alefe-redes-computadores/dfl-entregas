'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  BrainCircuit,
  Check,
  PackagePlus,
  Plus,
  Save,
  Search,
  X,
  ShoppingBasket,
  ClipboardCopy,
  FileText,
  Share2,
  ListChecks,
  ChevronDown,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from '@/lib/operational-toast';
import { claimSubmission, releaseSubmission } from '@/lib/operation/submissionGate';

import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { stockLevel } from '@/lib/stock';
import { rankStockProducts } from '@/lib/stock-search';
import { stockOperationLabel, stockOperationPriority, stockOperationRank, stockOperationTiming } from '@/lib/stock-operation';
import {
  buildStockRecommendations,
} from '@/lib/stock-intelligence';
import { formatStockQuantity, parseStockQuantityInput } from '@/lib/stock-quantity';
import {
  committedStockQuantityMap,
  commercialPurchasePlan,
} from '@/lib/stock-shopping';
import { humanPurchasePlan } from '@/lib/stock-commercial-display-v2';
import { buildStockMarketRows, readStockMarketChecks, serializeStockMarketChecks, STOCK_MARKET_CHECKLIST_KEY, stockMarketChecked, stockMarketText } from '@/lib/stock-market-list';
import { exportStockMarketPdf } from '@/lib/stock-market-pdf';
import { StockPurchaseIntelligencePanel } from '@/components/stock/StockPurchaseIntelligencePanel';
import { StockPurchaseCoveragePanel } from '@/components/stock/StockPurchaseCoveragePanel';
import { invalidStockPurchaseSelections, validateStockPurchaseQuantity } from '@/lib/stock-purchase-draft';
import { compactStockPurchaseDraft, parseStockPurchaseDraft, STOCK_PURCHASE_DRAFT_KEY } from '@/lib/stock-purchase-session';
import { guardedStockRecommendation } from '@/lib/stock-recommendation-guard';
import { formatCommercialPlan, isDiscretePurchaseUnit,
  normalizeTypedPurchaseQuantity,
} from '@/lib/stock-commercial';
import type {
  StockProduct,
  StockSupply,
} from '@/types';

const prioritySort = (
  a: StockProduct,
  b: StockProduct,
) => {
  const rank = {
    zero: 0,
    baixo: 1,
    ok: 2,
  };

  return (
    rank[stockLevel(a)] -
      rank[stockLevel(b)] ||
    a.name.localeCompare(b.name, 'pt-BR')
  );
};

export default function ShoppingList() {
  const router = useRouter();

  const allProducts = useAppStore((state) => state.stockProducts);
  const products = useMemo(
    () => allProducts.filter((product) => product.active),
    [allProducts],
  );

  const movements = useAppStore(
    (state) => state.stockMovements,
  );

  const supplies = useAppStore(
    (state) => state.stockSupplies,
  );

  const addStockSupply = useAppStore(
    (state) => state.addStockSupply,
  );

  const user = useAppStore((state) => state.user);

  const [presentationIds, setPresentationIds] = useState<Record<string, string>>({});

  const recommendationMap = useMemo(
    () =>
      new Map(
        buildStockRecommendations(
          products,
          movements,
        ).map((item) => [
          item.productId,
          item,
        ]),
      ),
    [products, movements],
  );

  const committedMap = useMemo(
    () => committedStockQuantityMap(supplies),
    [supplies],
  );

  const netRecommendationMap = useMemo(
    () =>
      new Map(
        products.map((product) => {
          const recommendation = recommendationMap.get(product.id);
          const guarded = guardedStockRecommendation(product, recommendation);
          const gross = guarded.quantity;

          const committed =
            committedMap.get(product.id) || 0;

          const commercial = commercialPurchasePlan(
            product,
            gross,
            committed,
            presentationIds[product.id],
          );

          return [
            product.id,
            {
              gross,
              committed,
              rawNet: commercial.netNeed,
              net: commercial.baseQuantity,
              purchaseQuantity: commercial.purchaseQuantity,
              presentation: commercial.presentation,
              surplus: commercial.surplusQuantity,
              guard: guarded,
            },
          ] as const;
        }),
      ),
    [
      committedMap,
      products,
      recommendationMap,
      presentationIds,
    ],
  );

  const suggested = useMemo(
    () =>
      products
        .filter(
          (product) =>
            (
              netRecommendationMap.get(product.id)
                ?.purchaseQuantity || 0
            ) > 0,
        )
        .sort((a, b) => {
          const aPriority = stockOperationPriority(a, recommendationMap.get(a.id));
          const bPriority = stockOperationPriority(b, recommendationMap.get(b.id));
          return stockOperationRank[aPriority] - stockOperationRank[bPriority] || prioritySort(a, b);
        }),
    [products, netRecommendationMap, recommendationMap],
  );

  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(35);
  useEffect(() => setVisibleLimit(35), [query, showAll, showOnlySelected]);

  const [selected, setSelected] = useState<
    Record<string, boolean>
  >(() =>
    Object.fromEntries(
      suggested.map((product) => [
        product.id,
        true,
      ]),
    ),
  );

  const [quantities, setQuantities] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(
      suggested.map((product) => [
        product.id,
        String(
          Number(
            (
              netRecommendationMap.get(product.id)
                ?.purchaseQuantity || 0
            ).toFixed(3),
          ),
        ),
      ]),
    ),
  );

  const [busy, setBusy] = useState(false);
  const [leavePrompt, setLeavePrompt] = useState(false);
  const purchaseCommitted = useRef(false);
  const purchaseSubmitLock = useRef(false);
  const initializedSuggestions = useRef(new Set<string>());
  const draftRestored = useRef(false);
  // O Android pode suspender a PWA antes dos 180ms do debounce.
  const purchaseDraftSnapshotRef = useRef({ selected, quantities, presentationIds });
  purchaseDraftSnapshotRef.current = { selected, quantities, presentationIds };
  const purchaseCompletedRef = useRef(false);
  const [draftStorageFailed, setDraftStorageFailed] = useState(false);
  const persistPurchaseDraft = useCallback((showError: boolean) => {
    if (!draftRestored.current || purchaseCompletedRef.current) return;
    const snapshot = purchaseDraftSnapshotRef.current;
    try {
      if (!Object.values(snapshot.selected).some(Boolean)) {
        window.localStorage.removeItem(STOCK_PURCHASE_DRAFT_KEY);
      } else {
        window.localStorage.setItem(STOCK_PURCHASE_DRAFT_KEY, JSON.stringify({
          version: 1,
          updatedAt: new Date().toISOString(),
          selected: snapshot.selected,
          quantities: snapshot.quantities,
          presentationIds: snapshot.presentationIds,
        }));
      }
      if (showError) setDraftStorageFailed(false);
    } catch {
      // Quota cheia / armazenamento desabilitado: nunca alegar rascunho salvo.
      if (showError) setDraftStorageFailed(true);
    }
  }, []);

  useEffect(() => {
    if (draftRestored.current || !products.length) return;
    draftRestored.current = true;
    const stored = parseStockPurchaseDraft(localStorage.getItem(STOCK_PURCHASE_DRAFT_KEY));
    if (!stored) return;
    const restored = compactStockPurchaseDraft(stored, new Set(products.map((item) => item.id)));
    if (!Object.keys(restored.selected).length) return;
    // A recuperação é autoridade nesta sessão: não reative automaticamente
    // uma sugestão que o operador já havia desmarcado antes de sair.
    products.forEach((item) => initializedSuggestions.current.add(item.id));
    setSelected(restored.selected);
    setQuantities(restored.quantities);
    setPresentationIds(restored.presentationIds);
    setShowAll(true);
    toast.info('Compra em andamento recuperada.', {
      description: 'Itens, quantidades e embalagens foram preservados.',
    });
  }, [products]);

  useEffect(() => {
    if (!draftRestored.current || busy || purchaseCompletedRef.current) return;
    const timer = window.setTimeout(() => persistPurchaseDraft(true), 180);
    return () => window.clearTimeout(timer);
  }, [busy, presentationIds, quantities, selected, persistPurchaseDraft]);

  useEffect(() => {
    const onPageHide = () => persistPurchaseDraft(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistPurchaseDraft(false);
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [persistPurchaseDraft]);

  /*
   * O store hidrata depois da primeira renderização em alguns aparelhos.
   * Seleciona apenas sugestões novas, sem reativar um item que o usuário
   * tenha desmarcado manualmente.
   */
  useEffect(() => {
    const freshSuggestions = suggested.filter(
      (product) => !initializedSuggestions.current.has(product.id),
    );

    if (!freshSuggestions.length) return;

    setSelected((current) => ({
      ...current,
      ...Object.fromEntries(
        freshSuggestions.map((product) => [product.id, true]),
      ),
    }));

    setQuantities((current) => ({
      ...current,
      ...Object.fromEntries(
        freshSuggestions
          .filter((product) => current[product.id] === undefined)
          .map((product) => [
            product.id,
            String(
              Number(
                (netRecommendationMap.get(product.id)?.purchaseQuantity || 0).toFixed(3),
              ),
            ),
          ]),
      ),
    }));

    freshSuggestions.forEach((product) =>
      initializedSuggestions.current.add(product.id),
    );
  }, [netRecommendationMap, suggested]);

  const displayed = useMemo(() => rankStockProducts(
    showAll ? products : suggested, query,
  ).filter((product) => !showOnlySelected || selected[product.id]),
  [showAll, products, suggested, query, showOnlySelected, selected]);

  const renderedProducts = useMemo(() => displayed.slice(0, visibleLimit), [displayed, visibleLimit]);
  const selectedProducts = useMemo(() => products.filter((product) => selected[product.id]), [products, selected]);
  const purchaseUnitFor = useCallback((product: StockProduct) =>
    commercialPurchasePlan(product, 1, 0, presentationIds[product.id]).presentation?.purchase_unit || product.unit,
  [presentationIds]);
  const invalidSelected = useMemo(() => invalidStockPurchaseSelections(
    products, selected, quantities, purchaseUnitFor,
  ), [products, selected, quantities, purchaseUnitFor]);
  const chosen = useMemo(() => selectedProducts.filter((product) =>
    validateStockPurchaseQuantity(quantities[product.id], purchaseUnitFor(product)).valid,
  ), [selectedProducts, quantities, purchaseUnitFor]);

  // Lista de mercado é um rascunho local separado: nunca dá entrada no estoque.
  const marketPreview = useMemo(() => buildStockMarketRows(
    products, selected, quantities, presentationIds,
  ), [products, selected, quantities, presentationIds]);
  const [marketChecked, setMarketChecked] = useState<Record<string, string>>({});
  const [marketReady, setMarketReady] = useState(false);
  const [marketVisibleLimit, setMarketVisibleLimit] = useState(12);
  const [marketExpanded, setMarketExpanded] = useState(false);
  const [marketStorageWarning, setMarketStorageWarning] = useState(false);
  const [marketExportBusy, setMarketExportBusy] = useState(false);
  const marketExportLock = useRef(false);
  const marketPurchased = useMemo(() => marketPreview.rows.filter(row => stockMarketChecked(row, marketChecked)).length,
    [marketPreview.rows, marketChecked]);
  const canExportMarket = marketPreview.rows.length > 0 && marketPreview.invalid.length === 0 && invalidSelected.length === 0;

  useEffect(() => {
    if (marketReady || !marketPreview.rows.length) return;
    try {
      setMarketChecked(readStockMarketChecks(window.localStorage.getItem(STOCK_MARKET_CHECKLIST_KEY), marketPreview.rows));
    } catch { setMarketChecked({}); setMarketStorageWarning(true); }
    setMarketReady(true);
  }, [marketReady, marketPreview.rows]);

  useEffect(() => {
    if (!marketReady || busy) return;
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(STOCK_MARKET_CHECKLIST_KEY, serializeStockMarketChecks(marketPreview.rows, marketChecked)); }
      catch { setMarketStorageWarning(true); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [marketChecked, marketPreview.rows, marketReady, busy]);

  const marketText = () => stockMarketText(marketPreview.rows, marketChecked);
  const marketHaptic = (style: ImpactStyle = ImpactStyle.Light) => {
    if (Capacitor.isNativePlatform()) void Haptics.impact({ style }).catch(() => undefined);
  };
  const downloadMarket = async () => {
    if (!canExportMarket || marketExportLock.current) return;
    marketExportLock.current = true;
    setMarketExportBusy(true);
    try {
      const mode = await exportStockMarketPdf(marketPreview.rows, marketChecked);
      marketHaptic();
      toast.success(mode === 'shared' ? 'Lista enviada para compartilhamento.' : 'PDF da lista preparado.');
    } catch (error) {
      const cancelled = (error as { name?: string })?.name === 'AbortError' || /cancel/i.test(String(error));
      if (!cancelled) toast.error('Não foi possível gerar ou enviar o PDF. Tente Copiar a lista.');
    } finally {
      marketExportLock.current = false;
      setMarketExportBusy(false);
    }
  };
  const copyMarket = async () => {
    if (!canExportMarket) { toast.error('Corrija as quantidades selecionadas antes de exportar.'); return; }
    try {
      const text = marketText();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const helper = document.createElement('textarea');
        helper.value = text;
        helper.setAttribute('readonly', '');
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        try { if (!document.execCommand('copy')) throw new Error('clipboard unavailable'); }
        finally { helper.remove(); }
      }
      marketHaptic();
      toast.success('Lista copiada. Cole no Samsung Notes ou WhatsApp.');
    } catch { toast.error('Não foi possível copiar. Use Compartilhar ou PDF.'); }
  };
  const shareMarket = async () => {
    if (!canExportMarket) { toast.error('Corrija as quantidades selecionadas antes de compartilhar.'); return; }
    const message = marketText();
    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title: 'DFL - Lista de compras', text: message, dialogTitle: 'Enviar lista de mercado' });
        marketHaptic();
      } else if (navigator.share) {
        await navigator.share({ title: 'DFL - Lista de compras', text: message });
      } else {
        await copyMarket();
      }
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError' && !String(error).toLowerCase().includes('cancel')) {
        toast.error('Não foi possível compartilhar a lista. Tente Copiar.');
      }
    }
  };

  // R98: salvar imediatamente quando o Android coloca a compra em segundo plano.
  useEffect(() => {
    const saveNow = () => {
      if (purchaseCommitted.current) return;
      try {
        if (!Object.values(selected).some(Boolean)) return;
        localStorage.setItem(STOCK_PURCHASE_DRAFT_KEY, JSON.stringify({
          version: 1, updatedAt: new Date().toISOString(),
          selected, quantities, presentationIds,
        }));
      } catch (error) { console.warn('Rascunho de compra nao persistido:', error); }
    };
    const visibility = () => { if (document.visibilityState === 'hidden') saveNow(); };
    const nativeBack = (event: Event) => {
      if (purchaseCommitted.current || !Object.values(selected).some(Boolean)) return;
      event.preventDefault();
      setLeavePrompt(true);
    };
    const leaving = (event: BeforeUnloadEvent) => {
      if (purchaseCommitted.current || !Object.values(selected).some(Boolean)) return;
      saveNow(); event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('dfl:native-back-request', nativeBack);
    window.addEventListener('beforeunload', leaving);
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('dfl:native-back-request', nativeBack);
      window.removeEventListener('beforeunload', leaving);
      window.removeEventListener('pagehide', saveNow);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [selected, quantities, presentationIds]);

  const create = async () => {
    if (busy || purchaseSubmitLock.current) return;
    if (invalidSelected.length) {
      toast.error(`Revise a quantidade de ${invalidSelected[0].name}. Nenhum item será omitido silenciosamente.`);
      return;
    }
    if (!chosen.length) {
      toast.error('Selecione ao menos um produto com quantidade válida.');
      return;
    }
    // O ref fecha a janela entre dois toques antes de o React aplicar setBusy.
    // Guardar a selecao ANTES da requisicao: se o Android fechar no envio,
    // a ultima embalagem/quantidade continua recuperavel.
    persistPurchaseDraft(true);
    if (!claimSubmission(purchaseSubmitLock)) return;
    setBusy(true);

    try {
      const now = new Date().toISOString();

      const supply: StockSupply = {
        id: `supply-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        occurred_at: now,
        status: 'solicitado',
        items: chosen.map((product) => {
          const typed = parseStockQuantityInput(
            quantities[product.id],
          );
          const presentation = commercialPurchasePlan(product, 1, 0, presentationIds[product.id]).presentation;
          const factor = presentation?.conversion_quantity || 1;
          const purchaseUnit = presentation?.purchase_unit || product.unit;
          const purchaseQuantity = normalizeTypedPurchaseQuantity(
            typed,
            purchaseUnit,
          );
          const baseQuantity = Number((purchaseQuantity * factor).toFixed(4));

          return {
            id: `item-${product.id}`,
            name: product.name,
            quantity: baseQuantity,
            unit: product.unit,
            stock_product_id: product.id,
            presentation_id: presentation?.id,
            presentation_label: presentation?.label,
            purchase_quantity: purchaseQuantity,
            purchase_unit: presentation?.purchase_unit || product.unit,
            conversion_quantity: factor,
          };
        }),
        products_amount: 0,
        total_amount: 0,
        purchaser_name:
          user?.displayName || undefined,
        purchaser_id: user?.uid || undefined,
        observation:
          'Compra montada pela reposição inteligente',
        created_at: now,
        updated_at: now,
      };

      await addStockSupply(supply);

      // Sucesso remoto NAO pode virar falso erro por quota/localStorage.
      purchaseCompletedRef.current = true;
      try { window.localStorage.removeItem(STOCK_PURCHASE_DRAFT_KEY); }
      catch { /* compra criada; nenhum segundo envio por falha de limpeza local */ }

      // Checklist local só é limpo após a persistência da compra.
      try { localStorage.removeItem(STOCK_MARKET_CHECKLIST_KEY); } catch { /* Compra já salva: cache opcional. */ }

      purchaseCommitted.current = true;
      toast.success('Compra montada.');

      router.replace(
        `/abastecimentos/detalhes?id=${supply.id}`,
      );
    } catch {
      releaseSubmission(purchaseSubmitLock);
      toast.error(
        'Não foi possível criar a compra.',
      );
      setBusy(false);
    }
  };

  const visibleIds = useMemo(() => new Set(displayed.map((item) => item.id)), [displayed]);
  const hiddenSelectedCount = useMemo(() => selectedProducts.filter((item) => !visibleIds.has(item.id)).length, [selectedProducts, visibleIds]);
  const selectableDisplayed = useMemo(() => displayed.filter(product => !selected[product.id]), [displayed, selected]);
  const selectedDisplayedCount = displayed.length - selectableDisplayed.length;
  const toggleVisibleSelection = () => {
    if(busy||!displayed.length)return;
    const shouldSelect = selectableDisplayed.length > 0;
    setSelected(current => ({...current,...Object.fromEntries(displayed.map(product => [product.id,shouldSelect]))}));
    if(shouldSelect){
      setQuantities(current => ({...current,...Object.fromEntries(displayed.filter(product=>current[product.id]===undefined).map(product=>[product.id,String(Number((netRecommendationMap.get(product.id)?.purchaseQuantity||1).toFixed(3)))]))}));
    }
  };

  return (
    <div className="pb-10">
      <PageHeader
        title="Montar compra"
        subtitle="Do estoque para o carrinho"
        to="/estoque"
        onBack={() => {
          if (busy || (!purchaseCommitted.current && selectedProducts.length > 0)) setLeavePrompt(true);
          else router.replace('/estoque');
        }}
      />

      {/* R131_COBERTURA_DE_COMPRAS */}
      <StockPurchaseCoveragePanel products={products} committed={committedMap}/>
      {leavePrompt && typeof document !== 'undefined' && createPortal(<div role="dialog" aria-modal="true" aria-label="Sair da compra" className="fixed inset-0 z-[170] flex max-h-[100dvh] items-end justify-center overflow-y-auto overscroll-contain bg-black/80 px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"><section className="w-full max-w-md max-h-[calc(100dvh-28px)] overflow-y-auto overscroll-contain rounded-[24px] border border-amber-500/25 bg-zinc-950 p-4 shadow-2xl"><p className="text-[10px] font-black uppercase tracking-[.14em] text-amber-400">Compra em andamento</p><h2 className="mt-2 font-heading text-lg font-black text-zinc-100">Deseja realmente sair?</h2><p className="mt-2 text-xs leading-relaxed text-zinc-400">Sua seleção, quantidades e embalagens serão preservadas no rascunho deste aparelho. Nenhuma compra será registrada sem sua confirmação.</p><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setLeavePrompt(false)} className="h-12 rounded-xl bg-emerald-500 font-black text-zinc-950">Continuar compra</button><button type="button" onClick={() => { setLeavePrompt(false); router.replace('/estoque'); }} disabled={busy} className="h-12 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-300 disabled:opacity-50">Sair e salvar</button></div></section></div>, document.body)}

      <section className="mb-4 rounded-[24px] border border-amber-500/20 bg-amber-500/[.06] p-4">
        <div className="flex gap-3">
          <BrainCircuit
            size={20}
            className="text-amber-400"
          />
          <div>
            <p className="text-sm font-black text-zinc-100">
              Revisão rápida da compra
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              Ajuste quantidades e embalagens antes de registrar a compra. Nenhum produto é comprado automaticamente.
            </p>
          </div>
        </div>
      </section>

      {draftStorageFailed && (
        <p role="alert" className="mb-3 rounded-xl border border-amber-500/35 bg-amber-500/[.08] px-3 py-2.5 text-[11px] font-semibold text-amber-200">
          Não foi possível guardar o rascunho neste aparelho. Confira o espaço de armazenamento antes de sair.
        </p>
      )}

      <section className="mb-4 overflow-hidden rounded-[24px] border border-emerald-500/25 bg-gradient-to-br from-zinc-900/90 via-zinc-900/75 to-emerald-950/15 p-3.5 shadow-[0_18px_38px_rgba(0,0,0,.15)]" aria-label="Lista de mercado R96">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400"><ListChecks size={20} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-zinc-100">Lista para levar ao mercado</h2>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-400">{marketPreview.rows.length} itens selecionados · {marketPurchased} marcados como comprados</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">Planejamento local, separado do recebimento real do estoque.</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-label="Progresso da lista" aria-valuemin={0} aria-valuemax={marketPreview.rows.length} aria-valuenow={marketPurchased}>
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-[width] duration-150" style={{ width: `${marketPreview.rows.length ? (marketPurchased / marketPreview.rows.length) * 100 : 0}%` }} />
        </div>
        {marketStorageWarning && <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] text-amber-200"><WifiOff size={15} className="mt-0.5 shrink-0" />Não foi possível guardar o checklist neste aparelho. Ele continua disponível enquanto esta tela estiver aberta.</p>}
        {marketPreview.invalid.length > 0 && <p role="alert" className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{marketPreview.invalid.length} quantidade(s) inválida(s). Revise antes de exportar: {marketPreview.invalid[0]}.</p>}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" disabled={!canExportMarket || marketExportBusy} onClick={() => void downloadMarket()} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-2 text-[11px] font-black text-emerald-300 transition-colors active:bg-emerald-500/20 disabled:opacity-40" aria-label="Gerar ou compartilhar PDF da lista de mercado"><FileText size={14} />{marketExportBusy ? 'Gerando...' : 'PDF'}</button>
          <button type="button" disabled={!canExportMarket} onClick={() => void shareMarket()} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900/80 px-2 text-[11px] font-black text-zinc-200 transition-colors active:bg-zinc-800 disabled:opacity-40" aria-label="Compartilhar lista para Samsung Notes"><Share2 size={14} />Enviar</button>
          <button type="button" disabled={!canExportMarket} onClick={() => void copyMarket()} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900/80 px-2 text-[11px] font-black text-zinc-200 transition-colors active:bg-zinc-800 disabled:opacity-40" aria-label="Copiar lista de mercado"><ClipboardCopy size={14} />Copiar</button>
        </div>
        {marketPreview.rows.length > 0 && <button type="button" aria-expanded={marketExpanded} onClick={() => { setMarketExpanded(value => !value); marketHaptic(); }} className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[.055] px-3 text-left text-[11px] font-bold text-emerald-200 transition-colors active:bg-emerald-500/10"><span className="flex items-center gap-2"><ShieldCheck size={16} />{marketExpanded ? 'Recolher checklist' : 'Conferir itens no mercado'}</span><ChevronDown size={16} className={marketExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>}
        {marketExpanded && marketPreview.rows.length > 0 && <div className="mt-2 max-h-[420px] space-y-1.5 overflow-y-auto rounded-xl border border-zinc-800/70 bg-zinc-950/40 p-2" aria-label="Checklist de produtos do mercado">
          {marketPreview.rows.slice(0, marketVisibleLimit).map((row, index, visible) => {
            const done = stockMarketChecked(row, marketChecked);
            const group = index === 0 || visible[index - 1]?.category !== row.category;
            return <div key={row.id}>
              {group && <p className="px-2 pb-1 pt-2 text-[9px] font-black uppercase tracking-widest text-emerald-400/75">{row.category}</p>}
              <button type="button" disabled={busy} aria-pressed={done} onClick={() => { setMarketChecked(current => ({ ...current, [row.id]: done ? '' : row.signature })); marketHaptic(); }} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${done ? 'border-emerald-500/20 bg-emerald-500/[.065]' : 'border-zinc-800/80 bg-zinc-900/55'}`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${done ? 'border-emerald-500 bg-emerald-500 text-zinc-950' : 'border-zinc-600 text-zinc-600'}`}>{done && <Check size={15} />}</span>
                <span className="min-w-0 flex-1"><span className={`block text-[11px] font-bold ${done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{row.name}</span><span className="block text-[10px] text-zinc-500">{row.purchaseText}</span></span>
              </button>
            </div>;
          })}
          {marketPreview.rows.length > marketVisibleLimit && <button type="button" onClick={() => setMarketVisibleLimit(value => value + 20)} className="min-h-11 w-full rounded-xl border border-zinc-700 text-[11px] font-bold text-zinc-300">Ver mais {Math.min(20, marketPreview.rows.length - marketVisibleLimit)} itens da lista</button>}
        </div>}
        {!marketPreview.rows.length && <p className="mt-3 text-[11px] text-zinc-500">Escolha produtos abaixo para montar a lista do mercado. Não é necessário salvar uma compra antes de exportar.</p>}
      </section>

      <StockPurchaseIntelligencePanel
        rows={marketPreview.rows}
        checked={marketChecked}
        invalid={marketPreview.invalid.length > 0 || invalidSelected.length > 0}
      />

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button" aria-pressed={!showAll}
          onClick={() => setShowAll(false)}
          className={`h-11 rounded-xl border text-xs font-black ${
            !showAll
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500'
          }`}
        >
          Sugeridos ({suggested.length})
        </button>

        <button
          type="button" aria-pressed={showAll}
          onClick={() => setShowAll(true)}
          className={`h-11 rounded-xl border text-xs font-black ${
            showAll
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
              : 'border-zinc-800 bg-zinc-900 text-zinc-500'
          }`}
        >
          Todos ativos
        </button>
      </div>

      <section className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3" aria-label="Busca e revisão da compra" id="dfl-purchase-review">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3">
          <Search size={17} className="shrink-0 text-amber-400" />
          <input aria-label="Buscar produto para comprar" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome ou categoria" className="h-12 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca"><X size={16} className="text-zinc-400" /></button>}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div aria-live="polite" className="flex items-center gap-2 text-xs font-bold text-zinc-300"><ShoppingBasket size={16} className="text-amber-400" />{selectedProducts.length} {selectedProducts.length === 1 ? 'item escolhido' : 'itens escolhidos'}</div>
          <button type="button" aria-pressed={showOnlySelected} onClick={() => {setShowOnlySelected((current) => !current); if(!showOnlySelected) { setShowAll(true); setQuery(''); }}} className={`min-h-10 rounded-xl border px-3 text-[11px] font-bold ${showOnlySelected ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-zinc-700 text-zinc-400'}`}>{showOnlySelected ? 'Exibindo escolhidos' : 'Revisar escolhidos'}</button>
        </div>
        {!!invalidSelected.length && <div role="alert" className="mt-3 rounded-xl border border-red-500/30 bg-red-500/[.07] px-3 py-2 text-[11px] font-bold text-red-300">
          {invalidSelected.length} item(ns) selecionado(s) com quantidade inválida ou arredondada para zero. Corrija antes de montar a compra. Primeiro: {invalidSelected[0].name}.
          <button type="button" onClick={()=>{setShowAll(true);setShowOnlySelected(true);setQuery('')}} className="ml-2 underline underline-offset-2">Revisar</button>
        </div>}
        {!!displayed.length && <div role="group" aria-label="Seleção em lote de todos os produtos do filtro" className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-2">
          <span role="status" aria-live="polite" className="text-[11px] text-zinc-400">{displayed.length} no filtro · {selectedDisplayedCount} selecionados no filtro</span>
          <button type="button" onClick={toggleVisibleSelection} disabled={busy} className="min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] font-bold text-amber-300 disabled:opacity-50">{selectableDisplayed.length ? 'Selecionar no filtro' : 'Desmarcar no filtro'}</button>
        </div>}
        {displayed.length > renderedProducts.length && <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">A seleção em lote vale para todos os {displayed.length} produtos do filtro — inclusive os que ainda não aparecem na tela. O botão Montar compra considera todos os itens escolhidos.</p>}
        {hiddenSelectedCount > 0 && !showOnlySelected && <button type="button" onClick={()=>{setShowOnlySelected(true);setShowAll(true);setQuery('')}} className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 text-left text-[11px] font-semibold text-amber-200"><span>{hiddenSelectedCount} item(ns) escolhidos fora do filtro</span><span className="font-black">Revisar agora →</span></button>}
      </section>

      <div className="space-y-2">
        {renderedProducts.map((product) => {
          const recommendation =
            recommendationMap.get(product.id);

          const purchasePlan =
            netRecommendationMap.get(product.id);

          const suggestedQuantity =
            purchasePlan?.purchaseQuantity || 0;

          const operationPriority = stockOperationPriority(
            product,
            recommendation,
          );
          const operationTiming = stockOperationTiming(
            recommendation,
          );

          return (
            <article
              key={product.id}
              className={`rounded-xl border px-2.5 py-2 ${
                selected[product.id]
                  ? 'border-amber-500/30 bg-amber-500/[.05]'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={!!selected[product.id]}
                  aria-label={`${selected[product.id] ? 'Remover' : 'Selecionar'} ${product.name} da compra`}
                  disabled={busy}
                  onClick={() => {
                    setSelected((value) => ({
                      ...value,
                      [product.id]:
                        !value[product.id],
                    }));

                    if (
                      quantities[product.id] ===
                      undefined
                    ) {
                      setQuantities((value) => ({
                        ...value,
                        [product.id]: String(
                          Number(
                            (
                              purchasePlan?.purchaseQuantity || 1
                            ).toFixed(3),
                          ),
                        ),
                      }));
                    }
                  }}
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                    selected[product.id]
                      ? 'border-amber-500 bg-amber-500 text-zinc-950'
                      : 'border-zinc-700 text-zinc-600'
                  }`}
                >
                  {selected[product.id] ? (
                    <Check size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-zinc-200">
                    {product.name}
                  </p>

                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${
                      operationPriority === 'ruptura'
                        ? 'border-red-500/25 bg-red-500/10 text-red-300'
                        : operationPriority === 'comprar_agora'
                          ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                          : operationPriority === 'planejar'
                            ? 'border-sky-500/25 bg-sky-500/10 text-sky-300'
                            : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                    }`}>
                      {stockOperationLabel(operationPriority)}
                    </span>
                  </div>

                  <p className="text-[9px] text-zinc-600">
                    Agora{' '}
                    {formatStockQuantity(
                      product.current_quantity,
                      product.unit,
                    )}{' '}
                    · alvo{' '}
                    {formatStockQuantity(
                      purchasePlan?.guard.configuredTarget ||
                        0,
                      product.unit,
                    )}
                  </p>


                  {suggestedQuantity > 0 && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1">
                      <p className="text-[9px] font-black text-amber-400">
                        Comprar{' '}
                        {(() => {
                          const plan = purchasePlan;
                          return plan
                            ? humanPurchasePlan({
                                purchaseQuantity:
                                  plan.purchaseQuantity,
                                baseQuantity: plan.net,
                                baseUnit: product.unit,
                                presentation:
                                  plan.presentation,
                              })
                            : formatStockQuantity(
                                suggestedQuantity,
                                product.unit,
                              );
                        })()}{' '}
                        · {purchasePlan?.guard.mode === 'configured'
                          ? 'baseado na meta'
                          : purchasePlan?.guard.mode === 'history'
                            ? 'histórico confiável'
                            : 'histórico parcial'}
                      </p>
                    </div>
                  )}

                  {purchasePlan &&
                    purchasePlan.rawNet > 0 &&
                    purchasePlan.net > purchasePlan.rawNet + 0.0001 && (
                      <p className="mt-1 text-[9px] text-zinc-600">
                        Necessidade matemática{' '}
                        {formatStockQuantity(
                          purchasePlan.rawNet,
                          product.unit,
                        )}{' '}
                        · arredondada para a forma real de compra
                      </p>
                    )}

                  {(purchasePlan?.committed || 0) > 0 && (
                    <p className="mt-1 text-[9px] font-bold text-emerald-400">
                      {formatStockQuantity(
                        purchasePlan?.committed || 0,
                        product.unit,
                      )}{' '}
                      já comprometido em compra aberta
                    </p>
                  )}
                </div>

              </div>

              <div className={`mt-1.5 grid gap-1.5 border-t border-zinc-800/70 pt-1.5 ${(product.presentations || []).filter((item) => item.active && item.conversion_quantity > 0).length > 1 ? "grid-cols-[minmax(0,1fr)_92px]" : "grid-cols-[92px]"}`}>
                {(product.presentations || []).filter((item) => item.active && item.conversion_quantity > 0).length > 1 && (
                  <div className="min-w-0">
                    <label className="mb-1 block text-[8px] font-black uppercase tracking-wider text-zinc-600">Forma de compra</label>
                    <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label={`Forma de compra de ${product.name}`}>
                      {(product.presentations || []).filter((item)=>item.active&&item.conversion_quantity>0).map((item)=>{const active=(presentationIds[product.id]||purchasePlan?.presentation?.id)===item.id;return <button type="button" role="radio" aria-checked={active} key={item.id} onClick={()=>{const id=item.id;setPresentationIds(value=>({...value,[product.id]:id}));const current=netRecommendationMap.get(product.id);const next=commercialPurchasePlan(product,current?.gross||0,current?.committed||0,id);setQuantities(value=>({...value,[product.id]:String(Number(next.purchaseQuantity.toFixed(3)))}))}} className={`min-h-11 shrink-0 rounded-xl border px-3 py-2 text-left text-[9px] font-bold ${active?'border-amber-500/40 bg-amber-500/10 text-amber-300':'border-zinc-800 bg-zinc-950 text-zinc-500'}`}><span className="block">{item.label}</span><span className="mt-0.5 block text-[8px] opacity-70">contém {item.conversion_quantity.toLocaleString('pt-BR',{maximumFractionDigits:3})} {product.unit}</span></button>})}
                    </div>
                  </div>
                )}

                <div className="w-[92px] shrink-0">
                  <p className="mb-1 text-[8px] font-black uppercase tracking-wider text-zinc-600">
                    Qtd. de compra
                  </p>
                  <input
                  inputMode="decimal"
                  value={
                    quantities[product.id] ??
                    String(
                      Number(
                        (
                          purchasePlan?.purchaseQuantity || 1
                        ).toFixed(3),
                      ),
                    )
                  }
                  onChange={(event) =>
                    setQuantities((value) => ({
                      ...value,
                      [product.id]:
                        event.target.value.replace(
                          /[^0-9.,]/g,
                          '',
                        ),
                    }))
                  }
                  onBlur={(event) => {
                    const parsed = parseStockQuantityInput(event.target.value);
                    const presentation = purchasePlan?.presentation;
                    const normalized = normalizeTypedPurchaseQuantity(
                      parsed,
                      presentation?.purchase_unit || product.unit,
                    );
                    setQuantities((value) => ({
                      ...value,
                      [product.id]: String(Number(Math.max(0, normalized).toFixed(3))),
                    }));
                  }}
                  aria-label={`Quantidade de compra de ${product.name}`}
                  aria-invalid={!!selected[product.id] && !validateStockPurchaseQuantity(quantities[product.id] ?? String(purchasePlan?.purchaseQuantity || 1), purchasePlan?.presentation?.purchase_unit || product.unit).valid}
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-right font-black text-zinc-100 outline-none aria-invalid:border-red-500/60"
                />
                </div>
              </div>

              {recommendation && (
                <details className="mt-1.5 border-t border-zinc-800/60 pt-1.5">
                  <summary className="cursor-pointer list-none text-[9px] font-bold text-zinc-500">
                    Por que esta sugestão?
                  </summary>
                  <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-500">Até o mínimo <b className="text-zinc-300">{operationTiming.minimum}</b> · até zerar <b className="text-zinc-300">{operationTiming.zero}</b> · reposição <b className="text-zinc-300">{operationTiming.lead}</b></p>
                  <p className="mt-1.5 text-[9px] leading-relaxed text-zinc-500">
                    {purchasePlan?.guard.reason}. {recommendation.explanation}
                    {` Prazo de reposição: ${recommendation.leadTimeDays.toLocaleString(
                      'pt-BR',
                      { maximumFractionDigits: 1 },
                    )} dia(s).`}
                    {(purchasePlan?.committed || 0) > 0
                      ? ` Já descontamos ${formatStockQuantity(
                          purchasePlan?.committed || 0,
                          product.unit,
                        )} de compras em andamento.`
                      : ''}
                  </p>
                </details>
              )}
            </article>
          );
        })}

        {displayed.length > renderedProducts.length && (
          <button type="button" onClick={() => setVisibleLimit(limit => limit + 35)} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/[.05] px-4 text-xs font-bold text-amber-300">
            Mostrar mais {Math.min(35, displayed.length - renderedProducts.length)} de {displayed.length} produtos
          </button>
        )}

        {!displayed.length && (
          <div className="rounded-2xl border border-dashed border-zinc-700/70 bg-zinc-900/30 px-4 py-12 text-center" role="status">
            <PackagePlus className="mx-auto text-emerald-500" />
            <p className="mt-3 text-sm font-bold text-zinc-300">
              {query ? 'Nenhum produto corresponde à busca' : showOnlySelected ? 'Nenhum item escolhido' : 'Nenhuma reposição sugerida agora'}
            </p>
            {query&&<button type="button" onClick={()=>setQuery('')} className="mt-3 min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 text-xs font-black text-amber-300">Limpar busca</button>}
            {!query&&showOnlySelected&&<button type="button" onClick={()=>setShowOnlySelected(false)} className="mt-3 min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-black text-zinc-300">Ver produtos</button>}
            {!query&&!showOnlySelected&&!showAll&&<button type="button" onClick={()=>setShowAll(true)} className="mt-3 min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-black text-zinc-300">Ver todos os produtos</button>}
          </div>
        )}
      </div>

      <a href="#dfl-purchase-review" className="mb-2 mt-5 flex min-h-10 items-center justify-center rounded-xl border border-zinc-800 text-[11px] font-bold text-zinc-400">Voltar à busca e revisão</a>
      <button
        type="button"
        onClick={create}
        disabled={busy || !selectedProducts.length}
        className="sticky bottom-[calc(var(--dfl-safe-bottom)+12px)] z-20 mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/40 bg-amber-500 font-black text-zinc-950 shadow-[0_8px_35px_rgba(0,0,0,.45)] disabled:opacity-40"
      >
        <Save size={18} />
        {busy
          ? 'Montando...'
          : invalidSelected.length
            ? `Revisar ${invalidSelected.length} quantidade(s)`
            : `Montar compra com ${chosen.length} item${
                chosen.length === 1 ? '' : 's'
              }`}
      </button>
    </div>
  );
}
