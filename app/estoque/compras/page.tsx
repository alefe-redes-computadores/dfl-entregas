'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  BrainCircuit,
  Check,
  PackagePlus,
  Plus,
  Save,
  Search,
  X,
  ShoppingBasket,
} from 'lucide-react';
import { toast } from '@/lib/operational-toast';

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
import { invalidStockPurchaseSelections, validateStockPurchaseQuantity } from '@/lib/stock-purchase-draft';
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
  const initializedSuggestions = useRef(new Set<string>());

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

  const selectedProducts = products.filter((product) => selected[product.id]);
  const purchaseUnitFor = (product: StockProduct) =>
    commercialPurchasePlan(product, 1, 0, presentationIds[product.id]).presentation?.purchase_unit || product.unit;
  const invalidSelected = invalidStockPurchaseSelections(
    products, selected, quantities, purchaseUnitFor,
  );
  const chosen = selectedProducts.filter((product) =>
    validateStockPurchaseQuantity(quantities[product.id], purchaseUnitFor(product)).valid,
  );

  const create = async () => {
    if (busy) return;
    if (invalidSelected.length) {
      toast.error(`Revise a quantidade de ${invalidSelected[0].name}. Nenhum item será omitido silenciosamente.`);
      return;
    }
    if (!chosen.length) {
      toast.error('Selecione ao menos um produto com quantidade válida.');
      return;
    }
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
        observation:
          'Compra montada pela reposição inteligente',
        created_at: now,
        updated_at: now,
      };

      await addStockSupply(supply);

      toast.success('Compra montada.');

      router.replace(
        `/abastecimentos/detalhes?id=${supply.id}`,
      );
    } catch {
      toast.error(
        'Não foi possível criar a compra.',
      );
      setBusy(false);
    }
  };

  const visibleIds = new Set(displayed.map((item) => item.id));
  const hiddenSelectedCount = selectedProducts.filter((item) => !visibleIds.has(item.id)).length;
  const selectableDisplayed = displayed.filter(product => !selected[product.id]);
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
      />

      <section className="mb-4 rounded-[24px] border border-amber-500/20 bg-amber-500/[.06] p-4">
        <div className="flex gap-3">
          <BrainCircuit
            size={20}
            className="text-amber-400"
          />
          <div>
            <p className="text-sm font-black text-zinc-100">
              {suggested.length}{' '}
              {suggested.length === 1
                ? 'reposição sugerida'
                : 'reposições sugeridas'}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-zinc-500">
              A inteligência combina seus níveis
              configurados com consumo real quando
              existe amostra suficiente. Nada é
              comprado automaticamente.
            </p>
          </div>
        </div>
      </section>

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
        {!!displayed.length && <div role="group" aria-label="Seleção em lote de produtos" className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-2">
          <span role="status" aria-live="polite" className="text-[11px] text-zinc-400">{displayed.length} visíveis · {selectedDisplayedCount} selecionados nesta lista</span>
          <button type="button" onClick={toggleVisibleSelection} disabled={busy} className="min-h-11 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] font-bold text-amber-300 disabled:opacity-50">{selectableDisplayed.length ? 'Selecionar visíveis' : 'Desmarcar visíveis'}</button>
        </div>}
        {hiddenSelectedCount > 0 && !showOnlySelected && <button type="button" onClick={()=>{setShowOnlySelected(true);setShowAll(true);setQuery('')}} className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 text-left text-[11px] font-semibold text-amber-200"><span>{hiddenSelectedCount} item(ns) escolhidos fora do filtro</span><span className="font-black">Revisar agora →</span></button>}
      </section>

      <div className="space-y-2">
        {displayed.map((product) => {
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
              className={`rounded-2xl border px-3 py-2.5 ${
                selected[product.id]
                  ? 'border-amber-500/30 bg-amber-500/[.05]'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center gap-3">
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

                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
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

                  {recommendation && (
                    <p className="mt-1 text-[9px] text-zinc-500">
                      Até o mínimo <b className="text-zinc-300">{operationTiming.minimum}</b>
                      {' · '}até zerar <b className="text-zinc-300">{operationTiming.zero}</b>
                      {' · '}reposição <b className="text-zinc-300">{operationTiming.lead}</b>
                    </p>
                  )}

                  {suggestedQuantity > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
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

              <div className={`mt-2 grid gap-2 border-t border-zinc-800/70 pt-2 ${(product.presentations || []).filter((item) => item.active && item.conversion_quantity > 0).length > 1 ? "grid-cols-[minmax(0,1fr)_92px]" : "grid-cols-[92px]"}`}>
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
                <details className="mt-2 border-t border-zinc-800/60 pt-2">
                  <summary className="cursor-pointer list-none text-[9px] font-bold text-zinc-500">
                    Por que esta sugestão?
                  </summary>
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
