// lib/stock-suppliers.ts
import type { StockSupplierType } from '@/types';

export const STOCK_SUPPLIER_TYPE_LABELS: Record<StockSupplierType, string> = {
  supermercado: 'Supermercado / atacadista', embalagens: 'Embalagens', acougue: 'Açougue',
  gas: 'Gás', hortifruti: 'Hortifrúti', distribuidor: 'Distribuidor', outro: 'Outro',
};

export const STOCK_SUPPLIER_STYLE: Record<StockSupplierType, { icon: string; className: string }> = {
  supermercado: { icon: 'shopping-cart', className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  embalagens: { icon: 'package', className: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  acougue: { icon: 'beef', className: 'text-red-400 bg-red-500/10 border-red-500/20' },
  gas: { icon: 'flame', className: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  hortifruti: { icon: 'leaf', className: 'text-lime-400 bg-lime-500/10 border-lime-500/20' },
  distribuidor: { icon: 'truck', className: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  outro: { icon: 'store', className: 'text-zinc-400 bg-zinc-800 border-zinc-700' },
};
