// components/reports/MonthSelector.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  X,
  Check,
  ChevronDown
} from 'lucide-react';

interface MonthSelectorProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
}

export function MonthSelector({ selectedMonth, onMonthChange }: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getMonthLabel = (month: string): string => {
    if (month === 'all') return 'Todos os meses';
    
    const [year, monthNum] = month.split('-');
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
  };

  const getShortMonthLabel = (month: string): string => {
    if (month === 'all') return 'Todos';
    
    const [year, monthNum] = month.split('-');
    const shortNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${shortNames[parseInt(monthNum) - 1]}/${year.slice(-2)}`;
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

  const toggleDropdown = () => setIsOpen(!isOpen);

  const selectMonth = (month: string) => {
    onMonthChange(month);
    setIsOpen(false);
  };

  // Obter o ícone do mês atual para exibição
  const getMonthEmoji = (month: string): string => {
    if (month === 'all') return '📅';
    const monthNum = parseInt(month.split('-')[1]);
    const emojis = ['❄️', '☀️', '🌸', '🌺', '🌻', '☀️', '☀️', '🌻', '🍂', '🍂', '❄️', '❄️'];
    return emojis[monthNum - 1] || '📅';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão principal */}
      <button
        onClick={toggleDropdown}
        className={`
          flex items-center gap-2 px-4 py-2.5
          bg-zinc-800/50 hover:bg-zinc-800/80
          border ${isOpen ? 'border-emerald-500/50' : 'border-zinc-700/50'}
          rounded-xl transition-all duration-300
          text-zinc-200 text-sm font-medium
          hover:border-zinc-600/50
          focus:outline-none focus:ring-2 focus:ring-emerald-500/20
          group
        `}
      >
        <span className="text-base">{getMonthEmoji(selectedMonth)}</span>
        <span className="hidden sm:inline">{getMonthLabel(selectedMonth)}</span>
        <span className="sm:hidden">{getShortMonthLabel(selectedMonth)}</span>
        <ChevronDown className={`
          w-4 h-4 text-zinc-400 transition-transform duration-300
          ${isOpen ? 'rotate-180' : ''}
        `} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="
          absolute top-full left-0 mt-2 w-72
          bg-zinc-900/95 backdrop-blur-xl
          border border-zinc-800/50
          rounded-2xl shadow-2xl shadow-black/50
          overflow-hidden z-50
          animate-fadeInDown
        ">
          {/* Header do dropdown */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
              Selecionar período
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-zinc-800/50 transition-colors"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          {/* Navegação rápida */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-zinc-800/30">
            <button
              onClick={handlePrevious}
              disabled={!canGoPrevious}
              className="p-1.5 rounded-lg hover:bg-zinc-800/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-400" />
            </button>
            
            <div className="flex-1 text-center">
              <span className="text-xs text-zinc-400">
                {selectedMonth === 'all' ? 'Todos os períodos' : getMonthLabel(selectedMonth)}
              </span>
            </div>
            
            <button
              onClick={handleNext}
              disabled={!canGoNext}
              className="p-1.5 rounded-lg hover:bg-zinc-800/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>

          {/* Lista de meses */}
          <div className="max-h-64 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {availableMonths.map((month, index) => {
              const isSelected = month === selectedMonth;
              const isFirst = index === 0;
              
              return (
                <button
                  key={month}
                  onClick={() => selectMonth(month)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5
                    rounded-xl transition-all duration-200
                    ${isSelected 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'hover:bg-zinc-800/50 text-zinc-300 hover:text-zinc-100'
                    }
                    ${isFirst ? 'border-b border-zinc-800/30 mb-1' : ''}
                  `}
                >
                  <span className="text-lg">
                    {month === 'all' ? '📅' : getMonthEmoji(month)}
                  </span>
                  
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium">
                      {month === 'all' ? 'Todos os meses' : getMonthLabel(month)}
                    </div>
                    {month !== 'all' && (
                      <div className="text-[10px] text-zinc-500">
                        {month.split('-')[0]}
                      </div>
                    )}
                  </div>
                  
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer do dropdown */}
          <div className="px-4 py-2 border-t border-zinc-800/50">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>Últimos 12 meses disponíveis</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {availableMonths.length - 1} meses
              </span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-fadeInDown {
          animation: fadeInDown 0.2s ease-out forwards;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 9999px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `}</style>
    </div>
  );
}