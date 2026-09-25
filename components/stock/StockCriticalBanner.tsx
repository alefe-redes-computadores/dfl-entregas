'use client';

import { AlertTriangle } from 'lucide-react';
import { stockLevel } from '@/lib/stock';
import { formatStockQuantity } from '@/lib/stock-quantity';
import type { StockProduct } from '@/types';

export function StockCriticalBanner({ products }: { products: StockProduct[] }) {
  const zero = products
    .filter((product) => product.active && stockLevel(product) === 'zero')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  if (!zero.length) return null;

  const visible = zero.slice(0, 3);
  const remaining = zero.length - visible.length;

  return (
    <section className="rounded-[22px] border border-red-500/25 bg-red-500/[.06] p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-400">
          <AlertTriangle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-red-400">Estoque zerado</p>
          <p className="mt-1 text-sm font-black text-zinc-100">
            {zero.length} {zero.length === 1 ? 'produto precisa' : 'produtos precisam'} de reposição
          </p>
          <div className="mt-3 space-y-1.5">
            {visible.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-950/45 px-3 py-2">
                <span className="truncate text-[11px] font-bold text-zinc-300">{product.name}</span>
                <span className="shrink-0 text-[10px] font-black text-red-300">
                  {formatStockQuantity(product.current_quantity, product.unit)}
                </span>
              </div>
            ))}
          </div>
          {remaining > 0 && <p className="mt-2 text-[9px] font-bold text-zinc-500">+ {remaining} {remaining === 1 ? 'produto zerado' : 'produtos zerados'}</p>}
        </div>
      </div>
    </section>
  );
}
