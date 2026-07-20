'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import type { Route } from '@/types';

export default function NovaRotaPage() {
  const router = useRouter();
  const addRoute = useAppStore((state) => state.addRoute);
  
  const [name, setName] = useState('');
  const [motoboyName, setMotoboyName] = useState('');
  const [changeMoney, setChangeMoney] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !motoboyName) return;

    const novaRota: Route = {
      id: Date.now().toString(),
      name,
      status: 'aberta',
      motoboy_name: motoboyName,
      departure_time: new Date().toISOString(),
      change_money: changeMoney ? parseFloat(changeMoney) : 0,
      drinks_summary: ''
    };

    await addRoute(novaRota);
    toast.success('Rota aberta e salva na nuvem!');
    router.push('/');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.push('/')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-heading text-xl font-bold text-zinc-50">Abrir Nova Rota</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Nome da Rota</label>
          <input
            type="text"
            placeholder="Ex: Rota 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Nome do Motoboy</label>
          <input
            type="text"
            placeholder="Ex: Wesley"
            value={motoboyName}
            onChange={(e) => setMotoboyName(e.target.value)}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-zinc-400">Troco Inicial da Rota (R$ - Opcional)</label>
          <input
            type="number"
            placeholder="Ex: 50"
            value={changeMoney}
            onChange={(e) => setChangeMoney(e.target.value)}
            className="h-14 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="mt-4 h-14 w-full rounded-2xl bg-emerald-500 font-bold text-zinc-950 active:scale-[0.98]"
        >
          Abrir Rota
        </button>
      </form>
    </div>
  );
}
