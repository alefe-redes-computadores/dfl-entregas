'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Bike, User, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';

export default function EditRoutePage() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get('id');
  const date = params.get('date') || '';
  const detailsReturn = id
    ? `/rotas/details?id=${id}${date ? `&date=${encodeURIComponent(date)}` : ''}`
    : '/rotas';

  const route = useAppStore((state) =>
    state.routes.find((item) => item.id === id),
  );
  const motoboys = useAppStore((state) =>
    state.motoboys.filter((item) => item.active),
  );
  const updateRoute = useAppStore((state) => state.updateRoute);

  const [name, setName] = useState('');
  const [motoboyId, setMotoboyId] = useState('');
  const [change, setChange] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!route) return;

    setName(route.name);
    setMotoboyId(
      route.motoboy_id ||
        motoboys.find((item) => item.name === route.motoboy_name)?.id ||
        '',
    );
    setChange(String(route.change_money || ''));
  }, [motoboys, route]);

  if (!route) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-zinc-600">
          <Bike size={24} />
        </div>
        <p className="mt-4 font-heading text-lg font-black text-zinc-300">
          Rota não encontrada
        </p>
        <button
          onClick={() => router.replace(detailsReturn)}
          className="mt-4 rounded-xl bg-zinc-800 px-4 py-3 text-xs font-black text-zinc-300"
        >
          Voltar
        </button>
      </div>
    );
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault();

    const motoboy = motoboys.find((item) => item.id === motoboyId);
    if (!name.trim() || !motoboy) {
      toast.error('Informe o nome e o motoboy.');
      return;
    }

    setSaving(true);
    try {
      await updateRoute(route.id, {
        name: name.trim(),
        motoboy_id: motoboy.id,
        motoboy_name: motoboy.name,
        change_money: Number(change || 0),
      });
      toast.success('Rota atualizada.');
      router.replace(
        `/rotas/details?id=${route.id}${date ? `&date=${encodeURIComponent(date)}` : ''}`,
      );
    } catch {
      toast.error('Não foi possível atualizar a rota.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-28 animate-in fade-in duration-300">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.replace(detailsReturn)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 active:scale-95"
          aria-label="Voltar à rota"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-500">
            Ajustes da rota
          </p>
          <h1 className="truncate font-heading text-xl font-black text-zinc-50">
            Editar {route.name}
          </h1>
        </div>
      </header>

      <form onSubmit={save} className="flex flex-col gap-5">
        <section className="rounded-[26px] border border-zinc-800 bg-zinc-900/45 p-4">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-500">
              01 · Identificação
            </p>
            <p className="mt-1 text-sm font-black text-zinc-200">
              Nome da rota
            </p>
          </div>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950/45 px-4 text-zinc-100 outline-none focus:border-sky-500"
          />
        </section>

        <section className="rounded-[26px] border border-zinc-800 bg-zinc-900/45 p-4">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
              02 · Responsável
            </p>
            <p className="mt-1 text-sm font-black text-zinc-200">
              Motoboy da rota
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {motoboys.map((motoboy) => (
              <button
                type="button"
                key={motoboy.id}
                onClick={() => setMotoboyId(motoboy.id)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black ${
                  motoboyId === motoboy.id
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                    : 'border-zinc-800 bg-zinc-950/35 text-zinc-500'
                }`}
              >
                <User size={15} />
                <span className="truncate">{motoboy.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[26px] border border-zinc-800 bg-zinc-900/45 p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Wallet size={17} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
                03 · Caixa da rota
              </p>
              <p className="mt-0.5 text-sm font-black text-zinc-200">
                Troco inicial
              </p>
            </div>
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-600">
              R$
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={change}
              onChange={(event) => setChange(event.target.value)}
              className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950/45 pl-12 pr-4 text-zinc-100 outline-none focus:border-emerald-500"
            />
          </div>
        </section>

        <button
          disabled={saving}
          className="h-14 w-full rounded-2xl bg-sky-500 font-black text-zinc-950 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>
    </div>
  );
}
