'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Store, Power, Users, Clock, 
  Bike, ChevronRight, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/store/useAppStore';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PageHeader } from '@/components/layout/PageHeader';

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function LojaPage() {
  const router = useRouter();
  
  const storeSettings = useAppStore((state) => state.storeSettings);
  const updateStoreSettings = useAppStore((state) => state.updateStoreSettings);

  const [isOpen, setIsOpen] = useState(storeSettings?.isOpen ?? true);
  const [openingTime, setOpeningTime] = useState(storeSettings?.openingTime || '18:00');
  const [closingTime, setClosingTime] = useState(storeSettings?.closingTime || '23:30');
  const [activeDays, setActiveDays] = useState<number[]>(storeSettings?.activeDays || [1, 2, 3, 4, 5, 6, 0]);

  const handleToggleStore = async () => {
    const newStatus = !isOpen;
    setIsOpen(newStatus);
    
    await updateStoreSettings({ isOpen: newStatus });
    toast.success(newStatus ? 'Loja Aberta para Entregas!' : 'Loja Fechada com sucesso.');

    // Se aberto, agenda notificação de fechamento se estiver no Capacitor
    if (newStatus && Capacitor.isNativePlatform()) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'Aviso da Loja - DFL Entregas',
              body: 'A loja está aberta. Lembre-se de conferir os acertos e fechamentos.',
              id: 999,
              schedule: { at: new Date(Date.now() + 1000 * 60 * 60) }, // 1 hora
            },
          ],
        });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateStoreSettings({
      openingTime,
      closingTime,
      activeDays,
    });
    toast.success('Horários e expediente atualizados!');
  };

  const toggleDay = (dayIndex: number) => {
    if (activeDays.includes(dayIndex)) {
      setActiveDays(activeDays.filter(d => d !== dayIndex));
    } else {
      setActiveDays([...activeDays, dayIndex]);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-24 relative animate-in fade-in duration-300">
      
      {/* CABEÇALHO PADRÃO COM VOLTAR PARA A HOME */}
      <PageHeader 
        title="Central da Loja" 
        subtitle="Controle de expediente, status e gestão" 
        to="/"
      />

      {/* STATUS DA LOJA (ABERTO / FECHADO) */}
      <div className={`flex items-center justify-between p-5 rounded-[28px] border transition-all ${isOpen ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-md ${isOpen ? 'bg-emerald-500 text-zinc-950' : 'bg-red-500 text-white'}`}>
            <Power size={28} strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-zinc-50">
              {isOpen ? 'Loja Aberta' : 'Loja Fechada'}
            </h2>
            <p className="text-xs text-zinc-400">
              {isOpen ? 'Aceitando novas rotas e entregas' : 'Expediente encerrado temporariamente'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleStore}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${isOpen ? 'bg-emerald-500' : 'bg-zinc-700'}`}
        >
          <span className={`inline-block h-6 w-6 transform rounded-full bg-zinc-950 shadow-md transition-transform duration-300 ${isOpen ? 'translate-x-7' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* ATALHOS RÁPIDOS PARA MOTOBOYS E CLIENTES */}
      <div className="flex flex-col gap-2">
        <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Gestão e Operação
        </h3>
        <div className="flex flex-col gap-3">
          
          {/* CARD MOTOBOYS */}
          <button
            onClick={() => router.push('/motoboys')}
            className="flex items-center justify-between p-4 rounded-[24px] border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 transition-all active:scale-[0.98] text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold shrink-0">
                <Bike size={22} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-zinc-100 text-base group-hover:text-sky-400 transition-colors">
                  Equipe de Motoboys
                </span>
                <span className="text-xs text-zinc-500">
                  Acertos diários, regras e caixas
                </span>
              </div>
            </div>
            <ChevronRight size={20} className="text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
          </button>

          {/* CARD CLIENTES */}
          <button
            onClick={() => router.push('/clientes')}
            className="flex items-center justify-between p-4 rounded-[24px] border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/60 transition-all active:scale-[0.98] text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                <Users size={22} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-zinc-100 text-base group-hover:text-emerald-400 transition-colors">
                  Base de Clientes
                </span>
                <span className="text-xs text-zinc-500">
                  Endereços e códigos de confirmação iFood
                </span>
              </div>
            </div>
            <ChevronRight size={20} className="text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
          </button>
        </div>
      </div>

      {/* CONFIGURAÇÃO DE HORÁRIOS */}
      <div className="flex flex-col gap-2">
        <h3 className="px-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Expediente e Horários
        </h3>
        
        <form onSubmit={handleSaveSchedule} className="flex flex-col gap-4 rounded-[24px] border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                <Clock size={14} className="text-amber-500" /> Abertura
              </label>
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-amber-500 outline-none font-bold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                <Clock size={14} className="text-red-500" /> Fechamento
              </label>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="h-12 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-100 focus:border-red-500 outline-none font-bold"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/80">
            <label className="text-xs font-semibold text-zinc-400">Dias de Funcionamento</label>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS_OF_WEEK.map((day, index) => {
                const isActive = activeDays.includes(index);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={`flex h-10 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                      isActive 
                        ? 'bg-amber-500 text-zinc-950 shadow-md' 
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-600'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 h-12 w-full rounded-xl bg-zinc-800 hover:bg-zinc-700 font-bold text-zinc-100 text-sm active:scale-[0.98] transition-all border border-zinc-700 cursor-pointer"
          >
            Salvar Alterações de Expediente
          </button>
        </form>
      </div>
    </div>
  );
}
