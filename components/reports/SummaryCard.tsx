// components/reports/SummaryCard.tsx
'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  variation?: number;
  accentColor?: 'emerald' | 'amber' | 'blue' | 'purple' | 'pink';
  delay?: number;
}

export function SummaryCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  variation, 
  accentColor = 'emerald',
  delay = 0 
}: SummaryCardProps) {
  const colorClasses = {
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
    pink: 'from-pink-500/20 to-pink-600/10 border-pink-500/20',
  };

  const iconColors = {
    emerald: 'text-emerald-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    pink: 'text-pink-500',
  };

  return (
    <div
      className={`rounded-[22px] border bg-gradient-to-br ${colorClasses[accentColor]} p-4 backdrop-blur-sm animate-fadeInUp`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
            {title}
          </div>
          <div
            className={`mt-2 whitespace-nowrap font-black tracking-tight text-zinc-100 ${
              String(value).length >= 11
                ? 'text-[clamp(1.15rem,5vw,1.7rem)]'
                : String(value).length >= 8
                  ? 'text-[clamp(1.3rem,5.5vw,1.85rem)]'
                  : 'text-[clamp(1.45rem,6.2vw,2rem)]'
            }`}
            title={String(value)}
          >
            {value}
          </div>
        </div>

        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950/35 ${iconColors[accentColor]}`}>
          {icon}
        </div>
      </div>

      {subtitle && (
        <div className="mt-2 text-[10px] font-semibold leading-relaxed text-zinc-500">
          {subtitle}
        </div>
      )}

      {variation !== undefined && variation !== 0 && (
        <div className={`mt-2 flex items-center gap-1 text-[10px] font-bold ${variation > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {variation > 0 ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>{Math.abs(variation)}%</span>
          <span className="text-zinc-500">vs período anterior</span>
        </div>
      )}
    </div>
  );
}