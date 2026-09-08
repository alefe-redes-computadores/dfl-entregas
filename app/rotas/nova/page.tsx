'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, User, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import type { Route, Motoboy } from '@/types';

export default function NovaRotaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnDate = searchParams.get('date') || '';
  const routesReturn = returnDate ? `/rotas?date=${encodeURIComponent(returnDate)}` : '/rotas';
  const addRoute = useAppStore((state) => state.addRoute);
  const motoboys = useAppStore((state) => state.motoboys);
  const addMotoboy = useAppStore((state) => state.addMotoboy);
  
  const [name, setName] = useState('');
  const [motoboySelection, setMotoboySelection] = useState<string>('');
  const [changeMoney, setChangeMoney] = useState('');
  const [isSavingRoute, setIsSavingRoute] = useState(false);

  // Estados do Modal de Novo Motoboy
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMotoboyName, setNewMotoboyName] = useState('');
  const [isSavingMotoboy, setIsSavingMotoboy] = useState(false);

  // Filtra apenas motoboys ativos para exibir na lista
  const activeMotoboys = motoboys.filter(m => m.active);

  const handleSaveNewMotoboy = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMotoboyName.trim();
    if (!trimmed) return;

    // Evitar duplicidade
    const alreadyExists = motoboys.find(m => m.name.toLowerCase() === trimmed.toLowerCase());
    if (alreadyExists) {
      toast.error('Esse motoboy já está cadastrado!');
      return;
    }

    setIsSavingMotoboy(true);
    try {
      const novoMotoboy: Motoboy = {
        id: Date.now().toString(),
        name: trimmed,
        active: true,
        createdAt: new Date().toISOString()
      };
      
      await addMotoboy(novoMotoboy);
      setMotoboySelection(novoMotoboy.id);
      toast.success(`${trimmed} cadastrado com sucesso!`);
      setIsModalOpen(false);
      setNewMotoboyName('');
    } catch (error) {
      toast.error('Erro ao salvar motoboy.');
    } finally {
      setIsSavingMotoboy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedMotoboy = motoboys.find((motoboy) => motoboy.id === motoboySelection);
    if (!name.trim() || !selectedMotoboy) {
      toast.error('Preencha o nome da rota e escolha o motoboy.');
      return;
    }

    setIsSavingRoute(true);
    try {
      const now = new Date().toISOString();
      const novaRota: Route = {
        id: Date.now().toString(),
        name: name.trim(),
        status: 'aberta',
        motoboy_id: selectedMotoboy.id,
        motoboy_name: selectedMotoboy.name,
        change_money: changeMoney ? Number(changeMoney) : 0,
        drinks_summary: '',
        created_at: now,
        updated_at: now,
      };
      await addRoute(novaRota);
      toast.success('Rota criada e pronta para receber entregas.');
      router.replace(`/rotas/details?id=${novaRota.id}${returnDate ? `&date=${encodeURIComponent(returnDate)}` : ''}`);
    } catch (error) {
      console.error('Erro ao criar rota:', error);
      toast.error('Não foi possível criar a rota.');
    } finally {
      setIsSavingRoute(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-5 pb-28 animate-in fade-in duration-300">
      <header className="flex items-center gap-3">
        <button
          onClick={() => router.replace(routesReturn)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-400 active:scale-95"
          aria-label="Voltar às rotas"
        >
          <ChevronLeft size={21} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-500">
            Nova rota
          </p>
          <h1 className="font-heading text-xl font-black text-zinc-50">
            Abrir rota operacional
          </h1>
          <p className="mt-0.5 text-[11px] text-zinc-600">
            Escolha o responsável e prepare a saída
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <section className="rounded-[26px] border border-zinc-800 bg-zinc-900/45 p-4">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-500">
              01 · Identificação
            </p>
            <p className="mt-1 text-sm font-black text-zinc-200">
              Nome da rota
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Use um nome curto que seja fácil de reconhecer durante a operação.
            </p>
          </div>

          <input
            type="text"
            placeholder="Ex.: Rota 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950/45 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500 focus:outline-none"
            required
          />
        </section>

        <section className="rounded-[26px] border border-zinc-800 bg-zinc-900/45 p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
                02 · Responsável
              </p>
              <p className="mt-1 text-sm font-black text-zinc-200">
                Motoboy da rota
              </p>
            </div>
            <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[9px] font-black text-zinc-500">
              {activeMotoboys.length} ativo{activeMotoboys.length === 1 ? '' : 's'}
            </span>
          </div>

          {activeMotoboys.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {activeMotoboys.map((mb) => (
                <button
                  key={mb.id}
                  type="button"
                  onClick={() => setMotoboySelection(mb.id)}
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition-all ${
                    motoboySelection === mb.id
                      ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                      : 'border-zinc-800 bg-zinc-950/35 text-zinc-500'
                  }`}
                >
                  <User size={15} />
                  <span className="truncate">{mb.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 py-7 text-center">
              <User className="mx-auto text-zinc-700" size={21} />
              <p className="mt-2 text-xs font-bold text-zinc-500">
                Nenhum motoboy ativo
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/30 text-xs font-black text-zinc-500 active:scale-95"
          >
            <Plus size={15} />
            Cadastrar motoboy
          </button>
        </section>

        <section className="rounded-[26px] border border-zinc-800 bg-zinc-900/45 p-4">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">
              03 · Caixa da rota
            </p>
            <p className="mt-1 text-sm font-black text-zinc-200">
              Troco inicial
            </p>
            <p className="mt-1 text-[11px] text-zinc-600">
              Opcional. Registre somente o dinheiro entregue ao motoboy na saída.
            </p>
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-600">
              R$
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={changeMoney}
              onChange={(e) => setChangeMoney(e.target.value)}
              className="h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-950/45 pl-12 pr-4 text-zinc-100 placeholder:text-zinc-700 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </section>

        <button
          type="submit"
          disabled={isSavingRoute}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-sky-500 font-black text-zinc-950 active:scale-[0.98] disabled:opacity-50"
        >
          {isSavingRoute ? 'Criando rota...' : 'Criar rota'}
        </button>
      </form>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full max-w-sm rounded-[28px] border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">
                  Equipe
                </p>
                <h2 className="mt-1 font-heading text-lg font-black text-zinc-50">
                  Cadastrar motoboy
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-zinc-500"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNewMotoboy} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-zinc-500">Nome</label>
                <input
                  type="text"
                  value={newMotoboyName}
                  onChange={(e) => setNewMotoboyName(e.target.value)}
                  placeholder="Ex.: João Vitor"
                  autoFocus
                  className="mt-2 h-14 w-full rounded-2xl border border-zinc-800 bg-zinc-900/55 px-4 text-zinc-100 placeholder:text-zinc-700 focus:border-violet-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSavingMotoboy}
                className="h-13 w-full rounded-xl bg-violet-500 py-3.5 font-black text-white active:scale-95 disabled:opacity-50"
              >
                {isSavingMotoboy ? 'Salvando...' : 'Salvar motoboy'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
