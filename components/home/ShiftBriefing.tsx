'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bike, Play, Store } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { dateKey } from '@/lib/operational-time';

function parseDateKey(value?: string) {
  if (!value) return null;
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

export function ShiftBriefing() {
  const settings = useAppStore((state) => state.storeSettings);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const updateStoreSettings = useAppStore((state) => state.updateStoreSettings);
  const motoboys = useAppStore((state) => state.motoboys);

  const today = dateKey(new Date());
  const selectedKey = dateKey(selectedDate);
  const storageKey = `dfl-shift-started:${today}`;

  const [seen, setSeen] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSeen(localStorage.getItem(storageKey) === '1');
  }, [storageKey]);

  const activeMotoboys = useMemo(
    () => motoboys.filter((item) => item.active),
    [motoboys],
  );

  const isScheduledToday = useMemo(() => {
    const index = new Date().getDay();
    const day = settings.schedule?.[index];
    return Boolean(day?.active && (day.shifts?.length ?? 0) > 0);
  }, [settings.schedule]);

  const pausedToday = useMemo(() => {
    return (settings.pauses || []).some((pause) => {
      const start = parseDateKey(
        String(
          (pause as { start_date?: string; startDate?: string }).start_date ??
          (pause as { start_date?: string; startDate?: string }).startDate ??
          '',
        ),
      );
      const end = parseDateKey(
        String(
          (pause as { end_date?: string; endDate?: string }).end_date ??
          (pause as { end_date?: string; endDate?: string }).endDate ??
          '',
        ),
      );

      if (!start) return false;
      return today >= start && today <= (end || start);
    });
  }, [settings.pauses, today]);

  if (
    seen ||
    settings.isOpen ||
    selectedKey !== today ||
    !isScheduledToday ||
    pausedToday
  ) {
    return null;
  }

  const start = async () => {
    if (busy) return;

    setBusy(true);

    try {
      await updateStoreSettings({ isOpen: true });
      localStorage.setItem(storageKey, '1');
      setSeen(true);
    } catch {
      toast.error('Não foi possível abrir a operação.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[22px] border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[.09] to-sky-500/[.035] p-3.5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/12 text-emerald-400">
          <Store size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[.16em] text-emerald-400">
            Operação de hoje
          </p>
          <h2 className="truncate font-heading text-base font-black text-zinc-100">
            Pronto para começar
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
            <Bike size={12} className="text-sky-400" />
            {activeMotoboys.length
              ? `${activeMotoboys.length} entregador${activeMotoboys.length === 1 ? '' : 'es'} ativo${activeMotoboys.length === 1 ? '' : 's'}`
              : 'Nenhum entregador ativo'}
          </p>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={start}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-[11px] font-black text-zinc-950 shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
        >
          <Play size={14} />
          {busy ? 'Abrindo...' : 'Abrir'}
        </button>
      </div>
    </section>
  );
}
