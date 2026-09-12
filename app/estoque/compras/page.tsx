'use client';

import {
  useMemo,
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
import {
  buildStockRecommendations,
} from '@/lib/stock-intelligence';
import { formatStockQuantity, parseStockQuantityInput } from '@/lib/stock-quantity';
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

  const addStockSupply = useAppStore(
    (state) => state.addStockSupply,
  );

  const user = useAppStore((state) => state.user);

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

  const suggested = useMemo(
    () =>
      products
        .filter(
          (product) =>
            (recommendationMap.get(product.id)
              ?.recommendedQuantity || 0) > 0,
        )
        .sort(prioritySort),
    [products, recommendationMap],
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
              recommendationMap.get(product.id)
                ?.recommendedQuantity || 0
            ).toFixed(3),
          ),
        ),
      ]),
    ),
  );

  const [busy, setBusy] = useState(false);

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
        items: chosen.map((product) => ({
          id: `item-${product.id}`,
          name: product.name,
          quantity: parseStockQuantityInput(
            quantities[product.id],
          ),
          unit: product.unit,
          stock_product_id: product.id,
        })),
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

          const suggestedQuantity =
            recommendation?.recommendedQuantity ||
            0;

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
                              suggestedQuantity || 1
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

                  {suggestedQuantity > 0 && (
                    <p className="mt-1 text-[9px] font-black text-amber-400">
                      Comprar{' '}
                      {formatStockQuantity(
                        suggestedQuantity,
                        product.unit,
                      )}{' '}
                      · confiança{' '}
                      {recommendation?.confidence}
                    </p>
                  )}
                </div>

                <input
                  inputMode="decimal"
                  value={
                    quantities[product.id] ??
                    String(
                      Number(
                        (
                          suggestedQuantity || 1
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
                  className="h-11 w-20 rounded-xl border border-zinc-700 bg-zinc-950 px-2 text-right font-black text-zinc-100 outline-none"
                />
              </div>

              {recommendation && (
                <p className="mt-2 border-t border-zinc-800/70 pt-2 text-[9px] leading-relaxed text-zinc-600">
                  {recommendation.explanation}
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
