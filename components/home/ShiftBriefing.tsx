'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Bike,
  PackageCheck,
  Play,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { dateKey } from '@/lib/operational-time';
import { supplyDate } from '@/lib/stock-supply';

export function ShiftBriefing() {
  const isStoreOpen = useAppStore(
    (state) => state.storeSettings.isOpen,
  );

  const updateStoreSettings = useAppStore(
    (state) => state.updateStoreSettings,
  );

  const motoboys = useAppStore(
    (state) => state.motoboys,
  );

  const supplies = useAppStore(
    (state) => state.stockSupplies,
  );

  const activeMotoboys = useMemo(
    () =>
      motoboys.filter(
        (item) => item.active,
      ),
    [motoboys],
  );

  const today = dateKey(new Date());
  const storageKey =
    `dfl-shift-started:${today}`;

  const [seen, setSeen] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSeen(
      localStorage.getItem(storageKey) === '1',
    );
  }, [storageKey]);

  const bought = useMemo(
    () =>
      supplies.filter(
        (item) =>
          dateKey(supplyDate(item)) === today,
      ).length,
    [supplies, today],
  );

  if (seen) return null;

  const start = async () => {
    if (busy) return;

    setBusy(true);

    try {
      await updateStoreSettings({
        isOpen: true,
      });

      localStorage.setItem(
        storageKey,
        '1',
      );

      setSeen(true);
    } catch (error) {
      toast.error(
        'Não foi possível abrir a operação.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[26px] border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[.10] to-sky-500/[.05] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <Store size={20} />
        </span>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">
            Primeira abertura do dia
          </p>

          <h2 className="font-heading text-lg font-black text-zinc-100">
            Começar expediente?
          </h2>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-zinc-950/45 p-3">
          <p className="flex items-center gap-1 text-[9px] font-black text-sky-400">
            <Bike size={11} />
            EQUIPE ATIVA
          </p>

          <p className="mt-1 line-clamp-2 text-xs font-bold text-zinc-300">
            {activeMotoboys.length
              ? `${activeMotoboys.length} entregador${
                  activeMotoboys.length === 1
                    ? ''
                    : 'es'
                } ativo${
                  activeMotoboys.length === 1
                    ? ''
                    : 's'
                }`
              : 'Nenhum motoboy ativo'}
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-950/45 p-3">
          <p className="flex items-center gap-1 text-[9px] font-black text-amber-400">
            <PackageCheck size={11} />
            COMPRAS HOJE
          </p>

          <p className="mt-1 text-xs font-bold text-zinc-300">
            {bought} registro
            {bought === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-black text-zinc-950 disabled:opacity-50"
      >
        <Play size={16} />
        {busy
          ? 'Abrindo operação...'
          : 'Abrir operação de hoje'}
      </button>

      {isStoreOpen && (
        <p className="mt-2 text-center text-[10px] text-zinc-500">
          A loja já está marcada como aberta;
          confirme para dispensar este resumo.
        </p>
      )}
    </section>
  );
}
