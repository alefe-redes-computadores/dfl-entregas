'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  selectedDate: Date;
  selectedDateKey: string;
  datesWithOperation: Set<string>;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (date: Date) => void;
}

const TZ = 'America/Sao_Paulo';

function keyOf(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function fromKey(key: string) {
  return new Date(`${key}T12:00:00-03:00`);
}

function label(date: Date) {
  const today = keyOf(new Date());
  if (keyOf(date) === today) return 'Hoje';
  return date.toLocaleDateString('pt-BR', {
    timeZone: TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export function OperationalDatePicker({
  selectedDate,
  selectedDateKey,
  datesWithOperation,
  onPrevious,
  onNext,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

  const days = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = first.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const cells: Array<Date | null> = Array.from({ length: startOffset }, () => null);
    for (let day = 1; day <= lastDay; day += 1) cells.push(new Date(year, month, day, 12));
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [cursor]);

  const todayKey = keyOf(new Date());

  return (
    <>
      <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center rounded-[22px] border border-zinc-800 bg-zinc-900/45 p-1.5">
        <button onClick={onPrevious} className="flex h-9 w-9 items-center justify-center rounded-2xl text-zinc-400 active:scale-90" aria-label="Dia anterior">
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => {
            setCursor(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
            setOpen(true);
          }}
          className="min-w-0 rounded-2xl px-3 py-2 text-center active:bg-zinc-800/60"
        >
          <span className="flex items-center justify-center gap-2 text-sm font-black text-zinc-100">
            <CalendarDays size={15} className="text-emerald-400" />
            {label(selectedDate)}
          </span>
          <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600">
            toque para escolher a data
          </span>
        </button>
        <button onClick={onNext} className="flex h-9 w-9 items-center justify-center rounded-2xl text-zinc-400 active:scale-90" aria-label="Próximo dia">
          <ChevronRight size={18} />
        </button>
      </div>

      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-[90] flex items-end bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:justify-center">
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-[30px] border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-500">Calendário operacional</p>
                <h3 className="mt-1 font-heading text-lg font-black text-zinc-100">
                  {cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h3>
              </div>
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-zinc-500"><X size={17}/></button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[9px] font-black uppercase text-zinc-600">
              {['D','S','T','Q','Q','S','S'].map((day,index) => <span key={index}>{day}</span>)}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {days.map((date,index) => {
                if (!date) return <span key={`blank-${index}`} className="aspect-square" />;
                const key = keyOf(date);
                const selected = key === selectedDateKey;
                const today = key === todayKey;
                const hasOperation = datesWithOperation.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      onSelect(fromKey(key));
                      setOpen(false);
                    }}
                    className={`relative flex aspect-square items-center justify-center rounded-xl text-xs font-black transition active:scale-90 ${
                      selected
                        ? 'bg-emerald-500 text-zinc-950'
                        : today
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'text-zinc-400 hover:bg-zinc-900'
                    }`}
                  >
                    {date.getDate()}
                    {hasOperation && (
                      <span className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? 'bg-zinc-950' : 'bg-sky-400'}`} />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1))} className="h-10 rounded-xl bg-zinc-900 px-4 text-xs font-black text-zinc-400">Anterior</button>
              <button onClick={() => { onSelect(new Date()); setOpen(false); }} className="h-10 rounded-xl bg-emerald-500/10 px-4 text-xs font-black text-emerald-400">Hoje</button>
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1))} className="h-10 rounded-xl bg-zinc-900 px-4 text-xs font-black text-zinc-400">Próximo</button>
            </div>
            <p className="mt-3 text-center text-[9px] text-zinc-600">Ponto azul = dia com operação registrada.</p>
          </div>
        </div>
      )}
    </>
  );
}
