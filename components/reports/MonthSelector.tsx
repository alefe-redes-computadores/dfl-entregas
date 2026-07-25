'use client';

import { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, Check, ChevronDown, Filter } from 'lucide-react';

interface MonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export function MonthSelector({ selectedMonth, onMonthChange }: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const months: string[] = ['all'];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    setAvailableMonths(months);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getMonthLabel = (month: string) => {
    if (month === 'all') return 'Período Completo';
    const [year, monthNum] = month.split('-');
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão Flutuante Elegante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-900/80 backdrop-blur-md border border-zinc-800/80 rounded-full text-zinc-200 text-sm font-bold shadow-lg active:scale-95 transition-all"
      >
        {selectedMonth === 'all' ? <Filter size={14} className="text-emerald-400" /> : <CalendarIcon size={14} className="text-emerald-400" />}
        {getMonthLabel(selectedMonth)}
        <ChevronDown size={14} className={`text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Menu Dropdown Moderno */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-3 w-56 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-[24px] shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 flex flex-col gap-1 max-h-72 overflow-y-auto custom-scrollbar">
            {availableMonths.map((month) => {
              const isSelected = month === selectedMonth;
              return (
                <button
                  key={month}
                  onClick={() => { onMonthChange(month); setIsOpen(false); }}
                  className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                    isSelected ? 'bg-emerald-500/15 text-emerald-400' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                  }`}
                >
                  {getMonthLabel(month)}
                  {isSelected && <Check size={16} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
      `}</style>
    </div>
  );
}
