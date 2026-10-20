'use client';

import { useMemo, useState } from 'react';
import { ArchiveRestore, PackageX } from 'lucide-react';
import { toast } from '@/lib/operational-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAppStore } from '@/store/useAppStore';
import { SUPPLY_UNIT_LABELS } from '@/lib/stock-supply';

export default function ArchivedStock() {
  // Seletores do Zustand não podem fabricar arrays novos a cada leitura.
  const stockProducts = useAppStore((state) => state.stockProducts);
  const update = useAppStore((state) => state.updateStockProduct);
  const products = useMemo(
    () => stockProducts.filter((product) => !product.active),
    [stockProducts],
  );
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const restore = async (id: string) => {
    if (restoringId) return;
    setRestoringId(id);
    try {
      await update(id, { active: true });
      toast.success('Produto reativado.');
    } catch {
      toast.error('Não foi possível reativar. Tente novamente.');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="pb-28">
      <PageHeader title="Produtos arquivados" subtitle="Históricos preservados" to="/estoque" />
      <div className="space-y-3">
        {products.map((product) => (
          <article key={product.id} className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/45 p-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zinc-800 text-zinc-500"><PackageX size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-zinc-200">{product.name}</p>
              <p className="text-[10px] text-zinc-600">
                {product.current_quantity.toLocaleString('pt-BR')} {SUPPLY_UNIT_LABELS[product.unit]} preservados
              </p>
            </div>
            <button type="button" disabled={restoringId !== null} aria-busy={restoringId === product.id}
              onClick={() => void restore(product.id)}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-emerald-500/10 px-3 text-[10px] font-black text-emerald-400 disabled:opacity-50">
              <ArchiveRestore size={15} />{restoringId === product.id ? 'Restaurando...' : 'Reativar'}
            </button>
          </article>
        ))}
        {!products.length && (
          <p className="rounded-2xl border border-dashed border-zinc-800 py-14 text-center text-sm text-zinc-600">Nenhum produto arquivado.</p>
        )}
      </div>
    </div>
  );
}
