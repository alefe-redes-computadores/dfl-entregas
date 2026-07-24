'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, User, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import type { Route, Motoboy } from '@/types';

export default function NovaRotaPage() {
  const router = useRouter();
  const addRoute = useAppStore((state) => state.addRoute);
  const motoboys = useAppStore((state) => state.motoboys);
  const addMotoboy = useAppStore((state) => state.addMotoboy);
  
  const [name, setName] = useState('');
  const [motoboySelection, setMotoboySelection] = useState<string>('');
  const [changeMoney, setChangeMoney] = useState('');

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
      setMotoboySelection(trimmed); // Já deixa selecionado
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

    if (!name || !motoboySelection) {
      toast.error('Preencha o nome da rota e escolha o motoboy.');
      return;
    }

    const novaRota: Route = {
      id: Date.now().toString(),
      name,
      status: 'aberta',
      motoboy_name: motoboySelection, // Salva só o nome, mantendo a compatibilidade dos relatórios
      departure_time: new Date().toISOString(),
      change_money: changeMoney ? parseFloat(changeMoney) : 0,
      drinks_summary: ''
    };

    await addRoute(novaRota);
    toast.success('Rota aberta com sucesso!');
    router.push('/');
  };

  return (
    <div className="flex flex-col gap-6 relative">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => router.push('/')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 active:scale-95"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="font-heading text-xl font-bold text-zinc-50">Abrir Nova Rota</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 pb-10">
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

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
             <label className="text-sm font-semibold text-zinc-400">Selecione o Motoboy</label>
             <span className="text-[10px] text-zinc-500">Salvo no banco de dados</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {activeMotoboys.map((mb) => (
              <button
                key={mb.id}
                type="button"
                onClick={() => setMotoboySelection(mb.name)}
                className={`flex h-12 items-center justify-center gap-2 rounded-xl border font-semibold transition-all ${
                  motoboySelection === mb.name
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <User size={16} />
                {mb.name}
              </button>
            ))}
            
            {/* Botão de Adicionar Novo */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/30 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-500 transition-all font-semibold"
            >
              <Plus size={16} />
              Cadastrar Novo
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-zinc-800/80 pt-4">
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

      {/* MODAL DE CADASTRAR MOTOBOY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-heading font-bold text-zinc-50">Novo Motoboy</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveNewMotoboy} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-zinc-400">Nome (Ex: João Vitor)</label>
                <input 
                  type="text" 
                  value={newMotoboyName} 
                  onChange={(e) => setNewMotoboyName(e.target.value)} 
                  autoFocus
                  className="h-14 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-zinc-100 focus:border-emerald-500 focus:outline-none" 
                  required 
                />
              </div>
              <button 
                type="submit" 
                disabled={isSavingMotoboy} 
                className="mt-2 h-14 w-full rounded-xl bg-emerald-500 font-bold text-zinc-950 active:scale-95 disabled:opacity-60"
              >
                {isSavingMotoboy ? 'Salvando...' : 'Salvar Motoboy'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
