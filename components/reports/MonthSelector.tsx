// app/components/reports/MonthSelector.tsx
'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export function MonthSelector({ selectedMonth, onMonthChange }: MonthSelectorProps) {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  
  useEffect(() => {
    // Gerar meses disponíveis (últimos 12 meses)
    const months: string[] = ['all'];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthStr);
    }
    
    setAvailableMonths(months);
  }, []);

  const getMonthLabel = (month: string): string => {
    if (month === 'all') return 'Todos os meses';
    
    const [year, monthNum] = month.split('-');
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
  };

  const currentIndex = availableMonths.indexOf(selectedMonth);
  const canGoPrevious = currentIndex < availableMonths.length - 1;
  const canGoNext = currentIndex > 0;

  const handlePrevious = () => {
    if (canGoPrevious) {
      onMonthChange(availableMonths[currentIndex + 1]);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onMonthChange(availableMonths[currentIndex - 1]);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg p-1.5 border border-zinc-700/50">
      <button
        onClick={handlePrevious}
        disabled={!canGoPrevious}
        className="p-1.5 rounded hover:bg-zinc-700/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4 text-zinc-400" />
      </button>
      
      <select
        value={selectedMonth}
        onChange={(e) => onMonthChange(e.target.value)}
        className="bg-transparent text-zinc-200 text-sm font-medium px-2 py-1 rounded outline-none cursor-pointer hover:bg-zinc-700/30 transition-colors min-w-[140px] text-center"
      >
        {availableMonths.map(month => (
          <option key={month} value={month} className="bg-zinc-900 text-zinc-200">
            {getMonthLabel(month)}
          </option>
        ))}
      </select>
      
      <button
        onClick={handleNext}
        disabled={!canGoNext}
        className="p-1.5 rounded hover:bg-zinc-700/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        aria-label="Próximo mês"
      >
        <ChevronRight className="w-4 h-4 text-zinc-400" />
      </button>
    </div>
  );
}