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
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { stockLevel } from '@/lib/stock';
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

  const products = useAppStore((state) =>
    state.stockProducts.filter(
      (product) => product.active,
    ),
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
          const gross =
            recommendationMap.get(product.id)
              ?.recommendedQuantity || 0;

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

  const displayed = showAll
    ? products
    : suggested;

  const chosen = products.filter(
    (product) =>
      selected[product.id] &&
      parseStockQuantityInput(
        quantities[product.id] || '0',
      ) > 0,
  );

  const create = async () => {
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
              className={`rounded-2xl border p-3 ${
                selected[product.id]
                  ? 'border-amber-500/30 bg-amber-500/[.05]'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
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
                      recommendation?.targetQuantity ||
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
                        · confiança {recommendation?.confidence}
                      </p>
                      {recommendation?.reorderDue && (
                        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[8px] font-black uppercase text-red-300">
                          Comprar agora
                        </span>
                      )}
                      {recommendation && !recommendation.reorderDue && (
                        <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[8px] font-black uppercase text-sky-300">
                          Compra planejável
                        </span>
                      )}
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

                {(product.presentations || []).filter((item) => item.active && item.conversion_quantity > 0).length > 1 && (
                  <div className="w-full sm:w-auto">
                    <label className="mb-1 block text-[8px] font-black uppercase tracking-wider text-zinc-600">Forma de compra</label>
                    <select value={presentationIds[product.id] || purchasePlan?.presentation?.id || ''} onChange={(event) => { const id=event.target.value; setPresentationIds((value)=>({...value,[product.id]:id})); const current=netRecommendationMap.get(product.id); const next=commercialPurchasePlan(product,current?.gross||0,current?.committed||0,id); setQuantities((value)=>({...value,[product.id]:String(Number(next.purchaseQuantity.toFixed(3)))})); }} className="h-11 max-w-[150px] rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-[10px] font-bold text-zinc-200 outline-none">
                      {(product.presentations || []).filter((item)=>item.active&&item.conversion_quantity>0).map((item)=><option key={item.id} value={item.id}>{item.label} · {item.conversion_quantity.toLocaleString('pt-BR',{maximumFractionDigits:3})} {product.unit}</option>)}
                    </select>
                  </div>
                )}

                <div className="shrink-0">
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
                  className="h-11 w-20 rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-right font-black text-zinc-100 outline-none"
                />
                </div>
              </div>

              {recommendation && (
                <p className="mt-2 border-t border-zinc-800/70 pt-2 text-[9px] leading-relaxed text-zinc-600">
                  {recommendation.explanation}
                  {` Prazo de reposição: ${recommendation.leadTimeDays.toLocaleString(
                    'pt-BR',
                    { maximumFractionDigits: 1 },
                  )} dia(s).`}
                  {(purchasePlan?.committed || 0) > 0
                    ? ` A sugestão líquida já desconta ${formatStockQuantity(
                        purchasePlan?.committed || 0,
                        product.unit,
                      )} de compras solicitadas/em andamento.`
                    : ''}
                </p>
              )}
            </article>
          );
        })}

        {!displayed.length && (
          <div className="py-16 text-center">
            <PackagePlus className="mx-auto text-emerald-500" />
            <p className="mt-3 text-sm font-bold text-zinc-300">
              Estoque em dia
            </p>
          </div>
        )}
      </div>

      <button
        onClick={create}
        disabled={busy || !chosen.length}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 font-black text-zinc-950 disabled:opacity-40"
      >
        <Save size={18} />
        {busy
          ? 'Montando...'
          : `Montar compra com ${chosen.length} item${
              chosen.length === 1 ? '' : 's'
            }`}
      </button>
    </div>
  );
}
