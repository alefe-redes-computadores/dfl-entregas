'use client';

import { useMemo, useState } from 'react';
import {
  Boxes,
  Check,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAppStore } from '@/store/useAppStore';
import { stockLevel } from '@/lib/stock';
import { formatStockQuantity } from '@/lib/stock-quantity';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';
import { StockCategoryPicker } from '@/components/stock/StockCategoryPicker';
import { canonicalStockCategory, stockCategoryOrder, suggestStockCategory } from '@/lib/stock-categories';
import type {
  StockProduct,
  StockSupplyUnit,
} from '@/types';

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase('pt-BR');

const units = Object.entries(
  SUPPLY_UNIT_LABELS,
) as [StockSupplyUnit, string][];

export function StockProductPicker({
  products,
  value,
  onChange,
  invalid = false,
}: {
  products: StockProduct[];
  value?: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const addStockProduct = useAppStore(
    (state) => state.addStockProduct,
  );
  const allProducts = useAppStore(
    (state) => state.stockProducts,
  );

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Mercearia');
  const [unit, setUnit] =
    useState<StockSupplyUnit>('un');
  const [busy, setBusy] = useState(false);

  const selected =
    allProducts.find((product) => product.id === value) ||
    products.find((product) => product.id === value);

  const filtered = useMemo(
    () =>
      products
        .filter((product) =>
          normalize(product.name).includes(normalize(query)),
        )
        .sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR'),
        ),
    [products, query],
  );

  const groups = useMemo(
    () =>
      Object.entries(
        filtered.reduce<Record<string, StockProduct[]>>(
          (all, product) => {
            const key = canonicalStockCategory(
              product.category,
            );
            (all[key] ||= []).push(product);
            return all;
          },
          {},
        ),
      ).map(([categoryName, items]) => [
        categoryName,
        [...items].sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR'),
        ),
      ] as [string, StockProduct[]]).sort(([a], [b]) =>
        stockCategoryOrder(a) - stockCategoryOrder(b) ||
        a.localeCompare(b, 'pt-BR'),
      ),
    [filtered],
  );

  const canCreate =
    query.trim().length >= 2 &&
    !allProducts.some(
      (product) =>
        normalize(product.name) === normalize(query),
    );

  const create = async () => {
    const clean = (name || query).trim();

    if (clean.length < 2) {
      toast.error('Informe o nome do produto.');
      return;
    }

    setBusy(true);

    try {
      const now = new Date().toISOString();

      const product: StockProduct = {
        id: `stock-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
        name: clean,
        category: category.trim() || undefined,
        unit,
        current_quantity: 0,
        minimum_quantity: 0,
        ideal_quantity: 0,
        active: true,
        created_at: now,
        updated_at: now,
      };

      await addStockProduct(product);
      onChange(product.id);

      setOpen(false);
      setCreating(false);
      setQuery('');
      setName('');

      toast.success(
        'Produto cadastrado e vinculado à compra.',
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível cadastrar o produto.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-invalid={invalid}
        className={`mt-1 flex min-h-14 w-full items-center gap-3 rounded-2xl border bg-zinc-900 px-4 py-3 text-left ${
          invalid
            ? 'border-red-500/70'
            : 'border-zinc-800'
        }`}
      >
        <Boxes
          size={17}
          className={
            invalid ? 'text-red-400' : 'text-amber-400'
          }
        />
        <span className="min-w-0 flex-1">
          <b
            className={`block truncate text-sm ${
              selected
                ? 'text-zinc-200'
                : 'text-zinc-500'
            }`}
          >
            {selected?.name || 'Selecionar produto'}
          </b>

          {selected && (
            <small className="mt-0.5 block text-[9px] text-zinc-600">
              {formatStockQuantity(
                selected.current_quantity,
                selected.unit,
              )}{' '}
              em estoque · custo médio{' '}
              {(selected.average_cost || 0).toLocaleString(
                'pt-BR',
                {
                  style: 'currency',
                  currency: 'BRL',
                },
              )}
            </small>
          )}
        </span>
      </button>

      {open && (
        <div
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
          className="fixed inset-0 z-[120] flex items-end bg-black/85 px-3 pt-3 backdrop-blur-md"
        >
          <div className="mx-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[30px] border border-zinc-800 bg-zinc-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="sticky top-0 z-10 -mx-1 flex justify-between gap-3 bg-zinc-950/95 px-1 pb-3 backdrop-blur">
              <div>
                <h3 className="font-heading text-lg font-black text-zinc-100">
                  {creating
                    ? 'Cadastrar produto'
                    : 'Selecionar produto'}
                </h3>
                <p className="text-xs text-zinc-600">
                  {creating
                    ? 'Será salvo no estoque e selecionado agora.'
                    : 'Saldo e custo aparecem antes de adicionar.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (creating) {
                    setCreating(false);
                  } else {
                    setOpen(false);
                  }
                }}
                className="grid h-10 w-10 place-items-center rounded-full bg-zinc-900 text-zinc-400"
              >
                <X size={18} />
              </button>
            </div>

            {!creating ? (
              <>
                <div className="relative mt-4">
                  <Search
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
                  />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) =>
                      setQuery(event.target.value)
                    }
                    placeholder="Buscar produto ativo"
                    className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-11 pr-3 text-sm text-zinc-100 outline-none focus:border-amber-500"
                  />
                </div>

                {canCreate && (
                  <button
                    type="button"
                    onClick={() => {
                      setName(query.trim());
                      setCategory(suggestStockCategory(query.trim()));
                      setCreating(true);
                    }}
                    className="mt-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-amber-500/35 bg-amber-500/[.05] p-3 text-left text-sm font-black text-amber-300"
                  >
                    <Plus size={18} />
                    Cadastrar “{query.trim()}”
                  </button>
                )}

                <p className="mt-2 text-[9px] leading-relaxed text-zinc-600">Produtos arquivados não entram em novas compras. Se não encontrar um item, você pode cadastrá-lo aqui.</p><div className="mt-3 space-y-4">
                  {groups.map(
                    ([categoryName, items]) => (
                      <section key={categoryName}>
                        <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">
                          {categoryName}
                        </p>

                        <div className="space-y-2">
                          {items.map((product) => {
                            const level =
                              stockLevel(product);

                            return (
                              <button
                                type="button"
                                key={product.id}
                                onClick={() => {
                                  onChange(product.id);
                                  setOpen(false);
                                  setQuery('');
                                }}
                                className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/55 p-3 text-left"
                              >
                                <span
                                  className={`h-9 w-1 rounded-full ${
                                    level === 'zero'
                                      ? 'bg-red-500'
                                      : level === 'baixo'
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                  }`}
                                />

                                <span className="min-w-0 flex-1">
                                  <b className="block truncate text-sm text-zinc-200">
                                    {product.name}
                                  </b>
                                  <small className="block text-[9px] text-zinc-600">
                                    {formatStockQuantity(
                                      product.current_quantity,
                                      product.unit,
                                    )}{' '}
                                    · custo{' '}
                                    {(
                                      product.average_cost || 0
                                    ).toLocaleString(
                                      'pt-BR',
                                      {
                                        style: 'currency',
                                        currency: 'BRL',
                                      },
                                    )}
                                    /
                                    {SUPPLY_UNIT_LABELS[
                                      product.unit
                                    ].toLocaleLowerCase(
                                      'pt-BR',
                                    )}
                                  </small>
                                </span>

                                {value === product.id && (
                                  <Check
                                    size={16}
                                    className="text-emerald-400"
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ),
                  )}
                </div>
              </>
            ) : (
              <div className="mt-5 space-y-4">
                <label className="block text-xs font-bold text-zinc-400">
                  Produto
                  <input
                    autoFocus
                    value={name}
                    onChange={(event) =>
                      setName(event.target.value)
                    }
                    className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 text-base font-semibold text-zinc-100 outline-none focus:border-amber-500"
                  />
                </label>

                <label className="block text-xs font-bold text-zinc-400">
                  Categoria
                  <StockCategoryPicker
                    value={category}
                    onChange={setCategory}
                  />
                </label>

                <div>
                  <p className="mb-2 text-xs font-bold text-zinc-400">
                    Unidade de controle
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {units.map(([key, label]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setUnit(key)}
                        className={`min-h-12 rounded-2xl border px-3.5 py-2.5 text-xs font-bold ${
                          unit === key
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                            : 'border-zinc-800 text-zinc-500'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={create}
                  className="h-14 w-full rounded-2xl bg-amber-500 px-4 text-sm font-black text-zinc-950 shadow-lg shadow-amber-500/10 active:scale-[.99] disabled:opacity-40"
                >
                  {busy
                    ? 'Cadastrando...'
                    : 'Cadastrar e usar na compra'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
