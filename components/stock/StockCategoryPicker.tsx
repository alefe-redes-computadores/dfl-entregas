'use client';

import {
  useMemo,
  useState,
} from 'react';

import {
  Beef,
  Boxes,
  Wheat,
  Check,
  CupSoda,
  Flame,
  Leaf,
  Package,
  Search,
  Soup,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';

import { useAppStore } from '@/store/useAppStore';

import {
  DEFAULT_STOCK_CATEGORIES,
  canonicalStockCategory,
  stockCategoryIconKey,
  stockCategoryOrder,
  type StockCategoryIconKey,
} from '@/lib/stock-categories';

const ICONS: Record<
  StockCategoryIconKey,
  LucideIcon
> = {
  beef: Beef,
  cup: CupSoda,
  package: Package,
  flame: Flame,
  leaf: Leaf,
  sparkles: Sparkles,
  soup: Soup,
  bread: Wheat,
  boxes: Boxes,
};

const norm = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('pt-BR');

export function StockCategoryIcon({
  category,
  size = 18,
}: {
  category?: string;
  size?: number;
}) {
  const Icon =
    ICONS[stockCategoryIconKey(category)];

  return <Icon size={size} />;
}

export function StockCategoryPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const products = useAppStore(
    (state) => state.stockProducts,
  );

  const [open, setOpen] =
    useState(false);

  const [query, setQuery] =
    useState('');

  const categories = useMemo(() => {
    const map =
      new Map<string, string>();

    [
      ...DEFAULT_STOCK_CATEGORIES,
      ...products.map((product) =>
        canonicalStockCategory(
          product.category,
        ),
      ),
    ].forEach((category) => {
      const canonical =
        canonicalStockCategory(category);

      map.set(
        norm(canonical),
        canonical,
      );
    });

    return [...map.values()].sort(
      (a, b) =>
        stockCategoryOrder(a) -
          stockCategoryOrder(b) ||
        a.localeCompare(
          b,
          'pt-BR',
        ),
    );
  }, [products]);

  const filtered =
    categories.filter((category) =>
      norm(category).includes(
        norm(query),
      ),
    );

  const choose = (
    category: string,
  ) => {
    onChange(
      canonicalStockCategory(category),
    );

    setQuery('');
    setOpen(false);
  };

  const selected = value
    ? canonicalStockCategory(value)
    : '';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex h-14 w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-left active:scale-[.99]"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
          <StockCategoryIcon
            category={selected}
            size={17}
          />
        </span>

        <span
          className={
            selected
              ? 'flex-1 text-sm font-bold text-zinc-100'
              : 'flex-1 text-sm text-zinc-600'
          }
        >
          {selected ||
            'Selecionar categoria'}
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[150] flex items-end bg-black/85 px-3 pt-3 backdrop-blur-md sm:items-center sm:justify-center"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false);
            }
          }}
        >
          <section className="mx-auto max-h-[88dvh] w-full max-w-md overflow-hidden rounded-t-[30px] border border-zinc-800 bg-zinc-950 shadow-2xl sm:rounded-[30px]">
            <header className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">
                  Setor do estoque
                </p>

                <h2 className="mt-1 font-heading text-lg font-black text-zinc-100">
                  Escolher categoria
                </h2>

                <p className="mt-1 text-[10px] text-zinc-600">
                  A categoria é o pai; os
                  produtos ficam organizados
                  dentro dela.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setOpen(false)
                }
                className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-zinc-400"
              >
                <X size={18} />
              </button>
            </header>

            <div className="p-4">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
                />

                <input
                  autoFocus
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target.value,
                    )
                  }
                  placeholder="Buscar categoria"
                  className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-900 pl-11 pr-4 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="mt-3 max-h-[58dvh] space-y-2 overflow-y-auto pb-[calc(.5rem+env(safe-area-inset-bottom))]">
                {filtered.map(
                  (category) => (
                    <button
                      type="button"
                      key={category}
                      onClick={() =>
                        choose(category)
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${
                        selected === category
                          ? 'border-emerald-500/40 bg-emerald-500/[.08]'
                          : 'border-zinc-800 bg-zinc-900/50'
                      }`}
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-950 text-emerald-400">
                        <StockCategoryIcon
                          category={category}
                          size={17}
                        />
                      </span>

                      <span className="min-w-0 flex-1">
                        <b className="block text-sm text-zinc-200">
                          {category}
                        </b>

                        <small className="text-[9px] text-zinc-600">
                          {
                            products.filter(
                              (product) =>
                                canonicalStockCategory(
                                  product.category,
                                ) ===
                                category,
                            ).length
                          }{' '}
                          produto(s)
                          cadastrado(s)
                        </small>
                      </span>

                      {selected ===
                        category && (
                        <Check
                          size={17}
                          className="text-emerald-400"
                        />
                      )}
                    </button>
                  ),
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
